'use server';

import { revalidatePath } from 'next/cache';
import {
  aiEvidenceToStrength,
  aiIssueToReason,
  evaluateDiner,
  selectIntervention,
  checkReviewCap,
} from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import {
  isChainConfigured,
  issueRewardToken,
  readRedemption,
  redeemRewardToken,
} from '@/lib/solana';
import { createRedemptionCode, lookupCode, markCodeUsed } from '@/lib/redemption';
import { knownRewards } from '@/lib/rewards';
import {
  addAcceptedInvite,
  addSubmittedReview,
  addDishFeedback,
  setNudgePreference,
  addFixNotification,
  markNotificationSeen,
  getFeedbackForDish,
  addInvitation,
  getInvitation,
  updateInvitationStatus,
} from '@/lib/store';
import type { DishFeedbackEntry } from '@/lib/store';
import { type CombinedEvidence, reviewRewardPercent, winBackRewardPercent } from '@/lib/reward';
import type { Invitation, Review } from '@/lib/types';

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
 */
export async function submitReview(input: ReviewSubmission) {
  const { loadDataset } = await import('@/lib/fixtures');
  const ds = loadDataset();
  const order =
    ds.orders.find((o) => o.id === input.order_id) ??
    ds.activeOrders.find((o) => o.id === input.order_id);
  if (!order) throw new Error(`Unknown order ${input.order_id}`);

  // Fraud prevention: check review rate limit.
  const capError = checkReviewCap(order.diner_id, ds.config);
  if (capError) {
    return { ok: false as const, error: capError };
  }

  const restaurant = ds.restaurants.find((r) => r.id === order.restaurant_id);
  const reason = aiIssueToReason(input.analysis.issue_category);
  const evidence = aiEvidenceToStrength(input.analysis.combined_evidence_strength);

  // Resolve the dish the AI named back to an id we own.
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

  // Issue the reward on devnet.
  let mint_address: string | null = null;
  let mint_signature: string | null = null;
  let token_account: string | null = null;
  let chain_error: string | null = null;

  const diner = ds.diners.find((d) => d.id === order.diner_id);
  if (reward_percent === 0) {
    chain_error = null;
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

  // Store categorized per-dish feedback if a dish was identified.
  if (relatedDishId && restaurant) {
    const dish = restaurant.known_dishes.find((d) => d.id === relatedDishId);
    if (dish) {
      addDishFeedback([{
        dish_id: relatedDishId,
        dish_name: dish.name,
        category: dish.category ?? 'food',
        tag_ids: [input.analysis.issue_category],
        tag_labels: [input.analysis.owner_summary],
        diner_id: order.diner_id,
        restaurant_id: order.restaurant_id,
        order_id: order.id,
        submitted_at: Date.now(),
      }]);
    }
  }

  revalidatePath(`/restaurant/${order.restaurant_id}`);
  revalidatePath(`/restaurant/${order.restaurant_id}/diner/${order.diner_id}`);
  revalidatePath(`/diner/${order.diner_id}`);

  return { ok: true as const, intervention_type, related_dish_id: relatedDishId, reward_percent };
}

/**
 * The diner accepts a win-back invitation.
 */
export async function acceptWinBack(input: { diner_id: string; restaurant_id: string }) {
  const { loadDataset } = await import('@/lib/fixtures');
  const ds = loadDataset();
  const diner = ds.diners.find((d) => d.id === input.diner_id);
  if (!diner) throw new Error(`Unknown diner ${input.diner_id}`);

  const flag = evaluateDiner(ds, input.diner_id, input.restaurant_id);
  if (!flag) throw new Error('No active invitation for this diner');
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

/** Settings toggle. */
export async function updateNudgePreference(input: { diner_id: string; opt_in: boolean }) {
  setNudgePreference(input.diner_id, input.opt_in);
  revalidatePath('/diner');
  revalidatePath(`/diner/${input.diner_id}`);
  revalidatePath('/restaurant/rest_warung_mama');
  revalidatePath('/restaurant/rest_kedai_pakcik');
  return { ok: true as const };
}

/**
 * Restaurant owner marks a dish issue as fixed. Creates a PENDING INVITATION
 * for each affected diner — the token is NOT minted until they accept.
 */
export async function markIssueFixed(input: {
  restaurant_id: string;
  dish_id: string;
  message?: string;
}) {
  const ds = loadDataset();
  const restaurant = ds.restaurants.find((r) => r.id === input.restaurant_id);
  if (!restaurant) throw new Error('Unknown restaurant');

  const dish = restaurant.known_dishes.find((d) => d.id === input.dish_id);
  const feedback = getFeedbackForDish(input.dish_id);

  // Also include diners from seeded action items (for demo)
  const { default: seedItems } = await import('@/data/action_items_seed.json');
  const seededDiners = (seedItems as Array<{ dishId: string | null; restaurantId: string; dinerId: string }>)
    .filter((s) => s.dishId === input.dish_id && s.restaurantId === input.restaurant_id)
    .map((s) => s.dinerId);

  const affectedDinerIds = [...new Set([...feedback.map((f) => f.diner_id), ...seededDiners])];

  const rewardPercent = 5;
  const rewardDescription = dish
    ? `We improved the ${dish.name} — come try it again!`
    : 'We made improvements based on your feedback!';
  const rewardValue = '5% off';
  const defaultMessage = dish
    ? `We heard you about the ${dish.name} and made changes. We\u2019d love for you to try it again \u2014 your opinion matters to us.`
    : 'We listened to your feedback and made improvements. Come see for yourself!';

  let invited = 0;
  for (const dinerId of affectedDinerIds) {
    const diner = ds.diners.find((d) => d.id === dinerId);
    if (!diner?.notify_opt_in) continue;

    const code = `FIX-${input.dish_id.slice(-4).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

    addInvitation({
      id: `inv_${input.restaurant_id}_${input.dish_id}_${dinerId}`,
      diner_id: dinerId,
      restaurant_id: input.restaurant_id,
      restaurant_name: restaurant.name,
      reason: 'dish_fix',
      message: input.message ?? defaultMessage,
      reward_description: rewardDescription,
      reward_value: rewardValue,
      reward_percent: rewardPercent,
      redemption_instructions: 'Show this screen to the cashier or mention your code.',
      redemption_code: code,
      dish_id: input.dish_id,
      dish_name: dish?.name ?? null,
      created_at: Date.now(),
      validity_days: 14,
      status: 'pending',
      mint_address: null,
      mint_signature: null,
      chain_error: null,
    });
    invited++;
  }

  for (const dinerId of affectedDinerIds) {
    revalidatePath(`/diner?as=${dinerId}`);
    revalidatePath(`/diner/${dinerId}`);
  }
  revalidatePath(`/restaurant/${input.restaurant_id}`);

  return { ok: true as const, invited };
}

/**
 * Diner accepts an invitation — NOW we mint the token to their wallet.
 */
export async function acceptInvitation(input: { invitation_id: string; diner_id: string }) {
  const ds = loadDataset();
  const inv = getInvitation(input.invitation_id);
  if (!inv) throw new Error('Invitation not found');
  if (inv.diner_id !== input.diner_id) throw new Error('Not your invitation');
  if (inv.status !== 'pending') throw new Error(`Invitation is ${inv.status}`);

  const expired = Date.now() - inv.created_at > inv.validity_days * 86_400_000;
  if (expired) {
    updateInvitationStatus(inv.id, 'expired');
    return { ok: false as const, error: 'This invitation has expired.' };
  }

  const diner = ds.diners.find((d) => d.id === input.diner_id);
  let mint_address: string | null = null;
  let mint_signature: string | null = null;
  let chain_error: string | null = null;

  if (!isChainConfigured()) {
    chain_error = 'Devnet not configured';
  } else if (!diner?.wallet_address || diner.wallet_address.startsWith('MOCK_')) {
    chain_error = 'No wallet configured';
  } else {
    try {
      const issued = await issueRewardToken(diner.wallet_address);
      mint_address = issued.mint_address;
      mint_signature = issued.mint_signature;
    } catch (e) {
      chain_error = e instanceof Error ? e.message : 'Mint failed';
    }
  }

  updateInvitationStatus(inv.id, 'accepted', mint_address && mint_signature ? { mint_address, mint_signature } : undefined);
  if (chain_error) {
    const invRef = getInvitation(inv.id);
    if (invRef) invRef.chain_error = chain_error;
  }

  revalidatePath(`/diner?as=${input.diner_id}`);
  revalidatePath(`/diner/${input.diner_id}`);
  revalidatePath(`/diner/${input.diner_id}/wallet`);

  return { ok: true as const, mint_address, chain_error };
}

/** Diner declines an invitation. */
export async function declineInvitation(input: { invitation_id: string; diner_id: string }) {
  const inv = getInvitation(input.invitation_id);
  if (!inv || inv.diner_id !== input.diner_id) return { ok: false as const };
  updateInvitationStatus(inv.id, 'declined');
  revalidatePath(`/diner?as=${input.diner_id}`);
  revalidatePath(`/diner/${input.diner_id}`);
  return { ok: true as const };
}

/** Mark a fix notification as seen. */
export async function dismissNotification(input: { notification_id: string; diner_id: string }) {
  markNotificationSeen(input.notification_id);
  revalidatePath(`/diner?as=${input.diner_id}`);
  revalidatePath(`/diner/${input.diner_id}`);
  return { ok: true as const };
}

/* ── reward redemption ───────────────────────────────────────────────────── */

/** Diner taps "Use Reward": issue a short-lived code. The token is NOT burned yet. */
export async function issueRedemptionCode(input: { diner_id: string; mint_address: string }) {
  const ds = loadDataset();
  const diner = ds.diners.find((d) => d.id === input.diner_id);
  if (!diner) throw new Error('Unknown diner');

  // Only hand out a code for a token this wallet actually still holds. Asking the chain
  // rather than our records means a token burned elsewhere cannot be offered again.
  const status = await readRedemption(input.mint_address, diner.wallet_address);
  if (status.status !== 'unredeemed') {
    return { ok: false as const, reason: 'not_available' as const, status: status.status };
  }

  const entry = createRedemptionCode(input.mint_address, input.diner_id);
  return { ok: true as const, code: entry.code, expires_at: entry.expires_at };
}

export type RedeemResult =
  | {
      ok: true;
      diner_name: string;
      reward_label: string;
      issuer_name: string;
      signature: string;
    }
  | { ok: false; reason: string };

/**
 * Restaurant enters the code: burn the token on devnet, then mark the code spent.
 *
 * Order matters. The code is only consumed after the burn confirms, so a failed burn
 * leaves the diner able to try again rather than losing the reward to a network blip.
 */
export async function redeemWithCode(input: { code: string }): Promise<RedeemResult> {
  const found = lookupCode(input.code);
  if (!found.ok) {
    return {
      ok: false,
      reason:
        found.reason === 'not_found'
          ? 'That code does not match any reward.'
          : found.reason === 'expired'
            ? 'That code has expired — ask the diner to tap Use Reward again.'
            : 'That code has already been used.',
    };
  }

  const ds = loadDataset();
  const diner = ds.diners.find((d) => d.id === found.entry.diner_id);
  if (!diner) return { ok: false, reason: 'Unknown diner for that code.' };

  const known = knownRewards(ds).find((r) => r.mint_address === found.entry.mint_address);
  const issuer = known ? ds.restaurants.find((r) => r.id === known.restaurant_id) : undefined;
  // Phrase it fully here so the UI never has to append the word "reward" and end up
  // with "reward reward" for a token we did not issue.
  const rewardLabel = known
    ? `${ds.interventionLookup.presentation[known.intervention_type].icon} ` +
      `${ds.interventionLookup.presentation[known.intervention_type].tag_label} reward`
    : 'reward';

  try {
    const { signature } = await redeemRewardToken(found.entry.mint_address, found.entry.diner_id);
    markCodeUsed(found.entry.code);

    // Both sides read the chain, so both should re-query now.
    revalidatePath('/diner');
    revalidatePath(`/diner/${found.entry.diner_id}`);
    for (const r of ds.restaurants) revalidatePath(`/restaurant/${r.id}`);

    return {
      ok: true,
      diner_name: diner.name.replace(' (demo profile)', ''),
      reward_label: rewardLabel,
      issuer_name: issuer?.name ?? 'another restaurant',
      signature,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? `Could not burn the token: ${e.message}` : 'Burn failed.',
    };
  }
}

/** Reset all runtime demo data — fresh start for a new demo run. */
export async function resetDemoData() {
  const { resetStore } = await import('@/lib/store');
  const { clearRuntime } = await import('@/lib/persist');
  resetStore();
  clearRuntime();
  revalidatePath('/');
  revalidatePath('/diner');
  revalidatePath('/restaurant/rest_warung_mama');
  revalidatePath('/restaurant/rest_kedai_pakcik');
  return { ok: true as const };
}
