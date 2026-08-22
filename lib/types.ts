// MakanLagi — data model.
// Timestamps are stored in fixtures as `days_ago` offsets (never hardcoded dates)
// so the dataset never goes stale if the demo runs later than planned.

export type ReasonType =
  | 'dish_issue'
  | 'wait_time'
  | 'declining_spend'
  | 'silent_churn'
  | 'no_signal'
  | 'none';

/**
 * 'verified_with_photo' is a stronger tier than 'strong': the diner's claim is backed by
 * a photo the AI judged genuine. The Reason->Intervention table is only keyed on
 * strong/weak/none, so selectIntervention() normalises it down to 'strong' when matching
 * rules — the extra tier changes reward size and what the owner sees, not which
 * intervention is chosen.
 */
export type EvidenceStrength = 'verified_with_photo' | 'strong' | 'weak' | 'none';

export type RiskStatus = 'at_risk' | 'silent_churn' | 'none';

export type InterventionType =
  | 'dish_fix_reward'
  | 'priority_seating'
  | 'value_bundle'
  | 'reorder_nudge'
  | 'neutral_invite';

export type SustainedReturnStatus = 'recovered' | 'not_recovered' | 'pending';

export interface Dish {
  id: string;
  name: string;
  price: number;
  category: 'food' | 'beverage';
}

export interface PainPoint {
  id: string;
  reason_type: ReasonType;
  label: string;
  related_dish_id: string | null;
  status: 'open' | 'mitigated' | 'fixed';
  fixed_note: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  tagline: string;
  is_struggling: boolean;
  is_anchor: boolean;
  support_multiplier?: number;
  known_dishes: Dish[];
  known_pain_points: PainPoint[];
}

export interface Diner {
  id: string;
  name: string;
  avatar_emoji: string;
  /** Mock placeholder until step 5 mints against a real devnet wallet. Never commit a private key. */
  wallet_address: string;
  notify_opt_in: boolean;
  demo_role: string;
  expected_flag: {
    status: RiskStatus;
    reason_type: ReasonType;
    evidence_strength: EvidenceStrength;
    intervention_type: InterventionType;
  };
}

export interface Order {
  id: string;
  diner_id: string;
  restaurant_id: string;
  dish_ids: string[];
  days_ago: number;
  amount: number;
}

/** Separate from Order on purpose — this is what makes silent-churn detection possible. */
export interface AppOpenEvent {
  id: string;
  diner_id: string;
  restaurant_id: string;
  days_ago: number;
}

export interface GuidedReviewTag {
  id: string;
  label: string;
  reason_type: ReasonType;
  requires_dish: boolean;
  /** Which dish category this tag applies to. null = applies to any / not dish-specific. */
  dish_category: 'food' | 'beverage' | null;
  keywords: string[];
}

/** What the AI concluded about a review. Present only on AI-analysed reviews. */
export interface ReviewAnalysis {
  issue_category: string;
  combined_evidence_strength: string;
  specific_dish_id: string | null;
  owner_summary: string;
  photo_verdict: string;
  had_photo: boolean;
  /** The follow-up options the diner actually tapped, in the AI's own words. */
  followups: string[];
}

export interface Review {
  id: string;
  order_id: string;
  diner_id: string;
  restaurant_id: string;
  days_ago: number;
  free_text: string;
  /** Either `tag_id` or `tag_id:dish_id` (e.g. `dish_dry:dish_ayam_percik`). */
  guided_tags: string[];
  rating: number;
  /** Set when Gemini analysed this review; the engine prefers it over guided tags. */
  ai?: ReviewAnalysis;
}

export interface RiskFlag {
  id: string;
  diner_id: string;
  restaurant_id: string;
  status: RiskStatus;
  reason_type: ReasonType;
  evidence_strength: EvidenceStrength;
  /** Human-readable "why", labeled verified-from-review vs inferred, for the reason-detail screen. */
  evidence_note: string;
  evidence_source: 'guided_review' | 'order_pattern' | 'app_open_log' | 'none';
  /** Plain-English sentence from the AI, written for the restaurant owner. Null if not AI-analysed. */
  owner_summary: string | null;
  related_dish_id: string | null;
  baseline_cadence: number | null;
  days_since_last_order: number | null;
  created_days_ago: number;
}

export interface Intervention {
  id: string;
  risk_flag_id: string;
  diner_id: string;
  restaurant_id: string;
  type: InterventionType;
  reward_token_id: string | null;
  sent_days_ago: number;
  won_back?: boolean;
  historical?: boolean;
}

export interface RewardToken {
  id: string;
  diner_id: string;
  restaurant_id: string;
  intervention_type: InterventionType;
  /** Filled at step 5 by the devnet mint. */
  mint_address: string | null;
  issued_days_ago: number;
  /** Fallback only — the dashboard reads redemption from the chain. */
  redeemed: boolean;
  source_of_truth: 'chain';
}

export interface SustainedReturnRecord {
  diner_id: string;
  restaurant_id: string;
  baseline_cadence: number;
  post_win_back_cadence_30d: number | null;
  win_back_days_ago: number;
  status: SustainedReturnStatus;
}

export interface InterventionPresentation {
  icon: string;
  tag_label: string;
  tag_color: string;
  tailwind: { bg: string; text: string; border: string };
  headline_template: string;
  body: string;
  reward_percent: number;
}

export interface InterventionLookup {
  rules: Array<{
    reason_type: ReasonType;
    evidence_strength: EvidenceStrength;
    intervention_type: InterventionType;
  }>;
  fallback_intervention_type: InterventionType;
  presentation: Record<InterventionType, InterventionPresentation>;
}

export interface AppConfig {
  at_risk_multiplier: number;
  min_orders_for_baseline: number;
  silent_churn_window_days: number;
  sustained_return_eval_days: number;
  sustained_return_tolerance: number;
  declining_spend_threshold: number;
  /** Base percent for the instant review reward, before the evidence multiplier. */
  review_reward_base_percent: number;
  /** Hard ceiling on any reward percent, whatever a fixture or the model asks for. */
  max_reward_percent: number;
  currency: string;
  max_reviews_per_day: number;
  max_rebate_per_customer_per_month_myr: number;
  daily_rebate_budget_myr: number;
  per_customer_rebate_cap_myr: number;
}

/**
 * An open order — the meal in front of the diner right now.
 * Deliberately NOT part of `Order` history: cadence and silent-churn maths read
 * `orders` only, so reviewing tonight's meal never rewrites a diner's risk flag.
 */
export interface ActiveOrder {
  id: string;
  diner_id: string;
  restaurant_id: string;
  dish_ids: string[];
  days_ago: number;
  amount: number;
  table: string;
}

/** Static curated entry for the Discover & Support pool. */
export interface DiscoverPoolEntry {
  id: string;
  /** Set when the entry maps to a real restaurant in this demo; null for display-only. */
  restaurant_id: string | null;
  name: string;
  tagline: string;
  distance: string;
  multiplier: number;
  reason: string;
  signature_dish: string;
}

/* ── Invitation (accept-before-mint flow) ────────────────────────────────── */

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface Invitation {
  id: string;
  diner_id: string;
  restaurant_id: string;
  restaurant_name: string;
  /** What triggered this invitation. */
  reason: 'dish_fix' | 'win_back' | 'priority_seating' | 'value_bundle' | 'reorder_nudge';
  /** Human-friendly message shown to the diner. */
  message: string;
  /** What the reward actually is. */
  reward_description: string;
  /** Monetary value or percentage. */
  reward_value: string;
  /** Percentage discount (for calculations). */
  reward_percent: number;
  /** How to redeem. */
  redemption_instructions: string;
  /** Short code the cashier can verify. */
  redemption_code: string;
  /** Dish that was fixed (if applicable). */
  dish_id: string | null;
  dish_name: string | null;
  /** When created. */
  created_at: number;
  /** Days until expiry from creation. */
  validity_days: number;
  /** Current status. */
  status: InvitationStatus;
  /** Filled ONLY after acceptance — the on-chain mint. */
  mint_address: string | null;
  mint_signature: string | null;
  chain_error: string | null;
}
