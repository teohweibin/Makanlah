'use server';

import { revalidatePath } from 'next/cache';
import { evaluateDiner, parseGuidedTag, selectIntervention } from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import { isChainConfigured, issueRewardToken } from '@/lib/solana';
import { addAcceptedInvite, addSubmittedReview, setNudgePreference } from '@/lib/store';
import type { EvidenceStrength, ReasonType, Review } from '@/lib/types';

export interface ReviewSubmission {
  order_id: string;
  free_text: string;
  /** `tag_id` or `tag_id:dish_id` */
  guided_tags: string[];
  rating: number;
}

/**
 * Scores a freshly submitted review through the SAME reason -> intervention lookup the
 * restaurant dashboard uses. One table, two moments: it picks the instant thank-you
 * reward here, and the win-back intervention there.
 */
export async function submitReview(input: ReviewSubmission) {
  const ds = loadDataset();
  // Tonight's open order is reviewable too, not just order history.
  const order =
    ds.orders.find((o) => o.id === input.order_id) ??
    ds.activeOrders.find((o) => o.id === input.order_id);
  if (!order) throw new Error(`Unknown order ${input.order_id}`);

  // A tap-selected tag is first-hand testimony, so evidence is strong by definition.
  let reason: ReasonType = 'no_signal';
  let evidence: EvidenceStrength = 'none';
  let relatedDishId: string | null = null;

  for (const raw of input.guided_tags) {
    const { tag, dishId } = parseGuidedTag(raw, ds.guidedReviewTags);
    if (!tag || tag.reason_type === 'none') continue;
    reason = tag.reason_type;
    evidence = 'strong';
    relatedDishId = dishId;
    break;
  }

  const intervention_type = selectIntervention(reason, evidence, ds.interventionLookup);
  const presentation = ds.interventionLookup.presentation[intervention_type];

  const review: Review = {
    id: `rev_live_${input.order_id}`,
    order_id: order.id,
    diner_id: order.diner_id,
    restaurant_id: order.restaurant_id,
    days_ago: 0,
    free_text: input.free_text,
    guided_tags: input.guided_tags,
    rating: input.rating,
  };

  // Issue the reward on devnet. A chain failure must not lose the diner their reward —
  // the review is still recorded and the error is shown rather than swallowed.
  let mint_address: string | null = null;
  let mint_signature: string | null = null;
  let token_account: string | null = null;
  let chain_error: string | null = null;

  const diner = ds.diners.find((d) => d.id === order.diner_id);
  if (!isChainConfigured()) {
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
    reward_percent: presentation.reward_percent,
    reward_token_id: `tok_live_${order.id}`,
    mint_address,
    mint_signature,
    token_account,
    chain_error,
  });

  // The dashboard reads the same dataset, so it should reflect this immediately.
  revalidatePath(`/restaurant/${order.restaurant_id}`);
  revalidatePath(`/restaurant/${order.restaurant_id}/diner/${order.diner_id}`);
  revalidatePath(`/diner/${order.diner_id}`);

  return { ok: true as const, intervention_type, related_dish_id: relatedDishId };
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
    reward_percent: presentation.reward_percent,
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
