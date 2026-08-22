'use server';

import { revalidatePath } from 'next/cache';
import {
  aiEvidenceToStrength,
  aiIssueToReason,
  evaluateDiner,
  selectIntervention,
} from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import { isChainConfigured, issueRewardToken } from '@/lib/solana';
import { addAcceptedInvite, addSubmittedReview, setNudgePreference } from '@/lib/store';
import { type CombinedEvidence, reviewRewardPercent, winBackRewardPercent } from '@/lib/reward';
import type { Review } from '@/lib/types';

export interface ReviewSubmission {
  order_id: string;
  free_text: string;
  rating: number;
  /** The AI's verdict, as returned by /api/analyze-review. */
  analysis: {
    issue_category: string;
    combined_evidence_strength: string;
    specific_dish_mentioned: string | null;
    owner_summary: string;
    photo_verdict: string;
  };
  /** Follow-up options the diner tapped, in the AI's own wording. */
  followups: string[];
  had_photo: boolean;
  /** Base64 photo, no data: prefix. Retained in memory for the owner's detail view. */
  photo_base64?: string | null;
}

/**
 * Records an AI-analysed review and issues the instant reward.
 *
 * Reward size comes from lib/reward.ts, never from the model's own `reward_multiplier`
 * — the model proposes evidence quality, our code decides what that is worth.
 */
export async function submitReview(input: ReviewSubmission) {
  const ds = loadDataset();
  // Tonight's open order is reviewable too, not just order history.
  const order =
    ds.orders.find((o) => o.id === input.order_id) ??
    ds.activeOrders.find((o) => o.id === input.order_id);
  if (!order) throw new Error(`Unknown order ${input.order_id}`);

  const restaurant = ds.restaurants.find((r) => r.id === order.restaurant_id);
  const reason = aiIssueToReason(input.analysis.issue_category);
  const evidence = aiEvidenceToStrength(input.analysis.combined_evidence_strength);

  // Resolve the dish the AI named back to an id we own, so the dashboard can use it.
  const relatedDishId =
    (input.analysis.specific_dish_mentioned &&
      restaurant?.known_dishes.find(
        (d) =>
          d.name.toLowerCase() === input.analysis.specific_dish_mentioned!.toLowerCase() ||
          d.name.toLowerCase().includes(input.analysis.specific_dish_mentioned!.toLowerCase()),
      )?.id) ||
    null;

  const intervention_type = selectIntervention(reason, evidence, ds.interventionLookup);
  const reward_percent = reviewRewardPercent(
    input.analysis.combined_evidence_strength as CombinedEvidence,
    input.analysis.photo_verdict,
    ds.config,
  );

  const review: Review = {
    id: `rev_live_${input.order_id}`,
    order_id: order.id,
    diner_id: order.diner_id,
    restaurant_id: order.restaurant_id,
    days_ago: 0,
    free_text: input.free_text,
    guided_tags: [],
    rating: input.rating,
    ai: {
      issue_category: input.analysis.issue_category,
      combined_evidence_strength: input.analysis.combined_evidence_strength,
      specific_dish_id: relatedDishId,
      owner_summary: input.analysis.owner_summary,
      photo_verdict: input.analysis.photo_verdict,
      had_photo: input.had_photo,
      followups: input.followups,
    },
  };

  // Issue the reward on devnet. A chain failure must not lose the diner their reward —
  // the review is still recorded and the error is shown rather than swallowed.
  let mint_address: string | null = null;
  let mint_signature: string | null = null;
  let token_account: string | null = null;
  let chain_error: string | null = null;

  const diner = ds.diners.find((d) => d.id === order.diner_id);
  if (reward_percent === 0) {
    chain_error = null; // Nothing was earned, so there is nothing to mint.
  } else if (!isChainConfigured()) {
    chain_error = 'Devnet not configured — run scripts/solana-setup.mjs';
  } else if (!diner?.wallet_address || diner.wallet_address.startsWith('MOCK_WALLET')) {
    chain_error = 'No devnet wallet for this diner — run scripts/solana-setup.mjs';
  } else {
    try {
      const issued = await issueRewardToken(diner.wallet_address);
      mint_address = issued.mint_address;
      mint_signature = issued.mint_signature;
      token_account = issued.token_account;
    } catch (e) {
      chain_error = e instanceof Error ? e.message : 'Mint failed';
    }
  }

  addSubmittedReview({
    review,
    intervention_type,
    reward_percent,
    reward_token_id: `tok_live_${order.id}`,
    evidence: input.analysis.combined_evidence_strength,
    owner_summary: input.analysis.owner_summary,
    photo_verdict: input.analysis.photo_verdict,
    had_photo: input.had_photo,
    photo_base64: input.photo_base64 ?? null,
    mint_address,
    mint_signature,
    token_account,
    chain_error,
  });

  // The dashboard reads the same dataset, so it should reflect this immediately.
  revalidatePath(`/restaurant/${order.restaurant_id}`);
  revalidatePath(`/restaurant/${order.restaurant_id}/diner/${order.diner_id}`);
  revalidatePath(`/diner/${order.diner_id}`);

  return { ok: true as const, intervention_type, related_dish_id: relatedDishId, reward_percent };
}

/**
 * The diner accepts a win-back invitation. Issues the reward that the invitation
 * promised, through the same devnet path as a review reward — one issuance mechanism,
 * not two.
 */
export async function acceptWinBack(input: { diner_id: string; restaurant_id: string }) {
  const ds = loadDataset();
  const diner = ds.diners.find((d) => d.id === input.diner_id);
  if (!diner) throw new Error(`Unknown diner ${input.diner_id}`);

  const flag = evaluateDiner(ds, input.diner_id, input.restaurant_id);
  if (!flag) throw new Error('No active invitation for this diner');

  // Someone who has turned nudges off does not get one, and does not get a reward
  // issued behind their back either.
  if (!diner.notify_opt_in) throw new Error('This diner has nudges turned off');

  const intervention_type = selectIntervention(
    flag.reason_type,
    flag.evidence_strength,
    ds.interventionLookup,
  );
  const presentation = ds.interventionLookup.presentation[intervention_type];

  let mint_address: string | null = null;
  let mint_signature: string | null = null;
  let chain_error: string | null = null;

  if (!isChainConfigured()) {
    chain_error = 'Devnet not configured — run scripts/solana-setup.mjs';
  } else if (!diner.wallet_address || diner.wallet_address.startsWith('MOCK_WALLET')) {
    chain_error = 'No devnet wallet for this diner — run scripts/solana-setup.mjs';
  } else {
    try {
      const issued = await issueRewardToken(diner.wallet_address);
      mint_address = issued.mint_address;
      mint_signature = issued.mint_signature;
    } catch (e) {
      chain_error = e instanceof Error ? e.message : 'Mint failed';
    }
  }

  addAcceptedInvite({
    diner_id: input.diner_id,
    restaurant_id: input.restaurant_id,
    intervention_type,
    reward_percent: winBackRewardPercent(presentation.reward_percent, ds.config),
    reward_token_id: `tok_winback_${input.diner_id}_${input.restaurant_id}`,
    mint_address,
    mint_signature,
    chain_error,
  });

  revalidatePath(`/diner/${input.diner_id}`);
  revalidatePath(`/diner/${input.diner_id}/invite/${input.restaurant_id}`);
  revalidatePath(`/restaurant/${input.restaurant_id}`);

  return { ok: true as const };
}

/** Settings toggle: "Receive nudges from restaurants I haven't visited in a while". */
export async function updateNudgePreference(input: { diner_id: string; opt_in: boolean }) {
  setNudgePreference(input.diner_id, input.opt_in);
  revalidatePath('/diner');
  revalidatePath(`/diner/${input.diner_id}`);
  // Campaign targeting on the restaurant side reads the same flag.
  revalidatePath('/restaurant/rest_warung_mama');
  revalidatePath('/restaurant/rest_kedai_pakcik');
  return { ok: true as const };
}
