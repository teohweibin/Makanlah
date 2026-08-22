// Who decides how big a reward is.
//
// Two systems wanted to answer that question and would have multiplied each other:
// intervention_lookup.json carries a `reward_percent` per intervention type (100% for
// dish_fix_reward), and the AI returns a `reward_multiplier` of 1.5 / 1.0 / 0.5. Naively
// combining them yields a 150% discount — the restaurant paying the diner to eat.
//
// The fix is to notice they belong to two different moments:
//
//   INSTANT review reward  — earned by leaving a review just now. Size scales with how
//                            well evidenced the review is. Small: 5–15%.
//   WIN-BACK reward        — offered to someone who already drifted away. Size is set by
//                            the intervention type in the lookup table. Larger.
//
// So the lookup table keeps owning WHICH intervention (and its message), and the AI
// multiplier only scales the instant reward. Nothing multiplies anything twice.

import type { AppConfig } from './types';

/** Evidence tiers the AI returns in `combined_evidence_strength`. */
export type CombinedEvidence = 'verified_with_photo' | 'strong' | 'weak' | 'none';

/**
 * Matches the multipliers in the Gemini prompt exactly. Kept here as the authority so
 * the app never depends on the model returning the right number — if the model returns
 * a multiplier we disagree with, this table wins.
 */
export const EVIDENCE_MULTIPLIER: Record<CombinedEvidence, number> = {
  verified_with_photo: 1.5,
  strong: 1.0,
  weak: 0.5,
  none: 0.5,
};

/** Photo verdicts that mean we could not trust the image. */
const UNTRUSTED_PHOTO = new Set(['rejected', 'suspicious']);

/**
 * Instant reward for leaving a review, in percent off the current bill.
 *
 *   verified_with_photo  -> 15%
 *   strong               -> 10%
 *   weak / none          ->  0%   (vague feedback earns nothing)
 *   any untrusted photo  ->  0%   (a photo we could not trust voids the reward)
 *
 * Rewarding vague or unverifiable feedback teaches diners that noise pays, and the
 * dashboard fills with claims nobody can act on. Nothing here rejects the review
 * itself — it is still recorded and still reaches the owner.
 */
export function reviewRewardPercent(
  evidence: CombinedEvidence,
  photoVerdict: string,
  config: AppConfig,
): number {
  if (UNTRUSTED_PHOTO.has(photoVerdict)) return 0;
  if (evidence === 'weak' || evidence === 'none') return 0;

  const base = config.review_reward_base_percent;
  const multiplier = EVIDENCE_MULTIPLIER[evidence] ?? 0;
  return clampPercent(Math.round(base * multiplier), config);
}

/**
 * Win-back reward: the intervention type owns the size, and evidence does NOT scale it.
 * A diner who is already gone is not offered less because their reason was inferred —
 * that would penalise them for our uncertainty rather than their behaviour.
 */
export function winBackRewardPercent(
  interventionRewardPercent: number,
  config: AppConfig,
): number {
  return clampPercent(interventionRewardPercent, config);
}

/** Nothing may ever exceed the cap, whatever a fixture or a model asks for. */
export function clampPercent(percent: number, config: AppConfig): number {
  const capped = Math.min(percent, config.max_reward_percent);
  return Math.max(0, capped);
}
