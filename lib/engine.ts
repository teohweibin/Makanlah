// MakanLagi — core logic engine.
//
// Pure functions: every input is passed in, nothing is read from disk or the network.
// That keeps this runnable from a plain node script (step 2 verification) AND from a
// React server component (step 3) with no changes.
//
// Implements the Core Logic Spec in DevLeague_Lab4_PRD.md verbatim.

import type {
  ActiveOrder, AppConfig, AppOpenEvent, Diner, DiscoverPoolEntry, Dish, EvidenceStrength, GuidedReviewTag,
  Intervention, InterventionLookup, InterventionType, Order, ReasonType,
  Restaurant, Review, RewardToken, RiskFlag, RiskStatus, SustainedReturnRecord, SustainedReturnStatus,
} from './types';

export interface Dataset {
  config: AppConfig;
  restaurants: Restaurant[];
  diners: Diner[];
  orders: Order[];
  appOpenEvents: AppOpenEvent[];
  reviews: Review[];
  guidedReviewTags: GuidedReviewTag[];
  interventionLookup: InterventionLookup;
  interventions: Intervention[];
  rewardTokens: RewardToken[];
  activeOrders: ActiveOrder[];
  discoverPool: DiscoverPoolEntry[];
  sustainedReturnRecords: SustainedReturnRecord[];
}

/* ------------------------------------------------------------------ */
/* time helpers — fixtures store `days_ago`, never hardcoded dates      */
/* ------------------------------------------------------------------ */

export function daysAgoToDate(daysAgo: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - daysAgo * 86_400_000);
}

/** Oldest first. Fixtures use `days_ago`, so descending days_ago == chronological. */
export function chronological<T extends { days_ago: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.days_ago - a.days_ago);
}

/** "today" / "yesterday" / "12 days ago" — a review left minutes ago should not read "0 days ago". */
export function agoLabel(daysAgo: number): string {
  if (daysAgo <= 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  return `${daysAgo} days ago`;
}

export function ordersFor(ds: Dataset, dinerId: string, restaurantId: string): Order[] {
  return chronological(
    ds.orders.filter((o) => o.diner_id === dinerId && o.restaurant_id === restaurantId),
  );
}

/* ------------------------------------------------------------------ */
/* baseline_cadence                                                     */
/* ------------------------------------------------------------------ */

export function daysBetweenConsecutiveOrders(orders: Order[]): number[] {
  const sorted = chronological(orders);
  return sorted.slice(1).map((o, i) => sorted[i].days_ago - o.days_ago);
}

/**
 * baseline_cadence = average(days_between_consecutive_orders)
 * requires >= 3 past orders; otherwise: not enough history, do not flag.
 */
export function baselineCadence(orders: Order[], config: AppConfig): number | null {
  if (orders.length < config.min_orders_for_baseline) return null;
  const gaps = daysBetweenConsecutiveOrders(orders);
  if (gaps.length === 0) return null;
  return gaps.reduce((a, b) => a + b, 0) / gaps.length;
}

export function daysSinceLastOrder(orders: Order[]): number | null {
  if (orders.length === 0) return null;
  return Math.min(...orders.map((o) => o.days_ago));
}

/* ------------------------------------------------------------------ */
/* at_risk / silent_churn                                               */
/* ------------------------------------------------------------------ */

/** at_risk = days_since_last_order > 2 x baseline_cadence */
export function isAtRisk(orders: Order[], config: AppConfig): boolean {
  const baseline = baselineCadence(orders, config);
  const since = daysSinceLastOrder(orders);
  if (baseline === null || since === null) return false; // not enough history — do not flag
  return since > config.at_risk_multiplier * baseline;
}

/** silent_churn = app_opened_within_window == true AND orders_within_same_window == 0 */
export function isSilentChurn(ds: Dataset, dinerId: string, restaurantId: string): boolean {
  const w = ds.config.silent_churn_window_days;
  const opens = ds.appOpenEvents.filter(
    (e) => e.diner_id === dinerId && e.restaurant_id === restaurantId && e.days_ago <= w,
  );
  const orders = ds.orders.filter(
    (o) => o.diner_id === dinerId && o.restaurant_id === restaurantId && o.days_ago <= w,
  );
  return opens.length > 0 && orders.length === 0;
}

/* ------------------------------------------------------------------ */
/* evidence                                                             */
/* ------------------------------------------------------------------ */

export interface ParsedTag {
  tagId: string;
  dishId: string | null;
  tag: GuidedReviewTag | undefined;
}

/** Guided tags are `tag_id` or `tag_id:dish_id`. */
export function parseGuidedTag(raw: string, tags: GuidedReviewTag[]): ParsedTag {
  const [tagId, dishId] = raw.split(':');
  return { tagId, dishId: dishId ?? null, tag: tags.find((t) => t.id === tagId) };
}

/**
 * Keyword-based tag matching for free text — deliberately NOT a live LLM call
 * (too unpredictable for a live demo). Used by the guided review UI in step 4.
 */
export function matchTagsFromText(text: string, tags: GuidedReviewTag[]): GuidedReviewTag[] {
  const haystack = text.toLowerCase();
  return tags.filter((t) => t.keywords.some((k) => haystack.includes(k.toLowerCase())));
}

/**
 * Same match, but reports which word triggered it — the guided review UI quotes the
 * diner's own word back at them ("You said 'dry' — which dish?") instead of guessing
 * silently. That quoted word is what makes the follow-up feel like listening.
 */
export function matchTagsWithKeywords(
  text: string,
  tags: GuidedReviewTag[],
): Array<{ tag: GuidedReviewTag; keyword: string }> {
  const haystack = text.toLowerCase();
  const hits: Array<{ tag: GuidedReviewTag; keyword: string }> = [];
  for (const tag of tags) {
    const keyword = tag.keywords.find((k) => haystack.includes(k.toLowerCase()));
    if (keyword) hits.push({ tag, keyword });
  }
  return hits;
}

/** Mean order amount of the newer half vs the older half. Negative == spending less. */
export function spendTrend(orders: Order[]): number | null {
  if (orders.length < 4) return null;
  const sorted = chronological(orders);
  const mid = Math.floor(sorted.length / 2);
  const mean = (rows: Order[]) => rows.reduce((a, o) => a + o.amount, 0) / rows.length;
  const older = mean(sorted.slice(0, mid));
  const newer = mean(sorted.slice(mid));
  if (older === 0) return null;
  return (newer - older) / older;
}

interface ReasonResult {
  reason_type: ReasonType;
  evidence_strength: EvidenceStrength;
  evidence_source: RiskFlag['evidence_source'];
  evidence_note: string;
  related_dish_id: string | null;
}

/**
 * evidence_strength =
 *   "strong"  if reason sourced from a guided_review tag
 *   "weak"    if reason is inferred from order/spend pattern only
 *   "none"    if no supporting data exists
 *
 * Precedence: a guided review always beats an inferred pattern — that is the whole
 * point of the strong/weak distinction on the reason-detail screen.
 */
export function determineReason(
  ds: Dataset, dinerId: string, restaurantId: string, silentChurn: boolean,
): ReasonResult {
  const reviews = ds.reviews
    .filter((r) => r.diner_id === dinerId && r.restaurant_id === restaurantId)
    .sort((a, b) => a.days_ago - b.days_ago); // most recent first

  for (const review of reviews) {
    for (const raw of review.guided_tags) {
      const { tag, dishId } = parseGuidedTag(raw, ds.guidedReviewTags);
      if (!tag || tag.reason_type === 'none') continue;
      const dishName = dishId ? dishNameFor(ds, dishId) : null;
      return {
        reason_type: tag.reason_type,
        evidence_strength: 'strong',
        evidence_source: 'guided_review',
        evidence_note:
          `Verified from a guided review ${agoLabel(review.days_ago)}: "${tag.label}"` +
          (dishName ? ` on ${dishName}.` : '.'),
        related_dish_id: dishId,
      };
    }
  }

  if (silentChurn) {
    const w = ds.config.silent_churn_window_days;
    const opens = ds.appOpenEvents.filter(
      (e) => e.diner_id === dinerId && e.restaurant_id === restaurantId && e.days_ago <= w,
    ).length;
    return {
      reason_type: 'silent_churn',
      evidence_strength: 'weak',
      evidence_source: 'app_open_log',
      evidence_note:
        `Inferred: opened the app ${opens} time${opens === 1 ? '' : 's'} in the last ${w} days ` +
        `without ordering. No review on file, so the reason is unconfirmed.`,
      related_dish_id: null,
    };
  }

  const trend = spendTrend(ordersFor(ds, dinerId, restaurantId));
  if (trend !== null && trend <= -ds.config.declining_spend_threshold) {
    return {
      reason_type: 'declining_spend',
      evidence_strength: 'weak',
      evidence_source: 'order_pattern',
      evidence_note:
        `Inferred from order pattern: average spend down ${Math.round(Math.abs(trend) * 100)}% ` +
        `across recent visits. No review on file, so the reason is unconfirmed.`,
      related_dish_id: null,
    };
  }

  return {
    reason_type: 'no_signal',
    evidence_strength: 'none',
    evidence_source: 'none',
    evidence_note: 'No review history and no spend signal — we genuinely do not know why.',
    related_dish_id: null,
  };
}

/* ------------------------------------------------------------------ */
/* intervention lookup                                                  */
/* ------------------------------------------------------------------ */

/** intervention_type = lookup(reason_type, evidence_strength) */
export function selectIntervention(
  reason: ReasonType, evidence: EvidenceStrength, lookup: InterventionLookup,
): InterventionType {
  const rule = lookup.rules.find(
    (r) => r.reason_type === reason && r.evidence_strength === evidence,
  );
  return rule ? rule.intervention_type : lookup.fallback_intervention_type;
}

export function dishNameFor(ds: Dataset, dishId: string): string | null {
  for (const r of ds.restaurants) {
    const d: Dish | undefined = r.known_dishes.find((x) => x.id === dishId);
    if (d) return d.name;
  }
  return null;
}

/** Fills {dish} in the headline template. Falls back to a generic noun if no dish. */
export function renderHeadline(
  ds: Dataset, type: InterventionType, relatedDishId: string | null,
): string {
  const template = ds.interventionLookup.presentation[type].headline_template;
  const dish = (relatedDishId && dishNameFor(ds, relatedDishId)) || 'dish';
  return template.replace('{dish}', dish);
}

/* ------------------------------------------------------------------ */
/* risk flags                                                           */
/* ------------------------------------------------------------------ */

/**
 * Status precedence: a real cadence breach (at_risk) outranks silent_churn.
 * Someone who has both stopped ordering AND is browsing is the more urgent case,
 * and their reason usually comes from a review rather than the app-open log.
 */
export function evaluateDiner(
  ds: Dataset, dinerId: string, restaurantId: string,
): RiskFlag | null {
  const orders = ordersFor(ds, dinerId, restaurantId);
  const baseline = baselineCadence(orders, ds.config);
  const since = daysSinceLastOrder(orders);
  const atRisk = isAtRisk(orders, ds.config);
  const silentChurn = isSilentChurn(ds, dinerId, restaurantId);

  const status: RiskStatus = atRisk ? 'at_risk' : silentChurn ? 'silent_churn' : 'none';
  if (status === 'none') return null;

  const reason = determineReason(ds, dinerId, restaurantId, silentChurn);

  return {
    id: `flag_${dinerId}_${restaurantId}`,
    diner_id: dinerId,
    restaurant_id: restaurantId,
    status,
    reason_type: reason.reason_type,
    evidence_strength: reason.evidence_strength,
    evidence_note: reason.evidence_note,
    evidence_source: reason.evidence_source,
    related_dish_id: reason.related_dish_id,
    baseline_cadence: baseline,
    days_since_last_order: since,
    created_days_ago: 0,
  };
}

export interface FlaggedDiner {
  flag: RiskFlag;
  diner: Diner;
  intervention_type: InterventionType;
  headline: string;
}

/** Every flagged diner for one restaurant, most urgent first. */
export function evaluateRestaurant(ds: Dataset, restaurantId: string): FlaggedDiner[] {
  return ds.diners
    .map((diner) => {
      const flag = evaluateDiner(ds, diner.id, restaurantId);
      if (!flag) return null;
      const intervention_type = selectIntervention(
        flag.reason_type, flag.evidence_strength, ds.interventionLookup,
      );
      return {
        flag,
        diner,
        intervention_type,
        headline: renderHeadline(ds, intervention_type, flag.related_dish_id),
      };
    })
    .filter((x): x is FlaggedDiner => x !== null)
    .sort((a, b) => {
      const rank = { strong: 0, weak: 1, none: 2 } as const;
      const byEvidence = rank[a.flag.evidence_strength] - rank[b.flag.evidence_strength];
      if (byEvidence !== 0) return byEvidence;
      return (b.flag.days_since_last_order ?? 0) - (a.flag.days_since_last_order ?? 0);
    });
}

/* ------------------------------------------------------------------ */
/* sustained return + metrics                                           */
/* ------------------------------------------------------------------ */

/**
 * sustained_return (evaluated 30 days after a win-back order) =
 *   "recovered"     if post_win_back_cadence within +/-20% of baseline_cadence
 *   "not_recovered" otherwise
 *   "pending"       if fewer than 30 days have passed
 */
export function sustainedReturnStatus(
  baseline: number,
  postCadence: number | null,
  daysSinceWinBack: number,
  config: AppConfig,
): SustainedReturnStatus {
  if (daysSinceWinBack < config.sustained_return_eval_days) return 'pending';
  if (postCadence === null) return 'pending';
  const tolerance = baseline * config.sustained_return_tolerance;
  return Math.abs(postCadence - baseline) <= tolerance ? 'recovered' : 'not_recovered';
}

export function recomputeSustainedReturn(ds: Dataset): SustainedReturnRecord[] {
  return ds.sustainedReturnRecords.map((r) => ({
    ...r,
    status: sustainedReturnStatus(
      r.baseline_cadence, r.post_win_back_cadence_30d, r.win_back_days_ago, ds.config,
    ),
  }));
}

export interface DashboardMetrics {
  interventions_sent: number;
  won_back: number;
  win_back_rate: number;
  sustained_recovered: number;
  sustained_evaluated: number;
  sustained_return_rate: number;
  sustained_pending: number;
}

export function dashboardMetrics(ds: Dataset, restaurantId: string): DashboardMetrics {
  const sent = ds.interventions.filter((i) => i.restaurant_id === restaurantId);
  const wonBack = sent.filter((i) => i.won_back).length;
  const records = recomputeSustainedReturn(ds).filter((r) => r.restaurant_id === restaurantId);
  const evaluated = records.filter((r) => r.status !== 'pending');
  const recovered = evaluated.filter((r) => r.status === 'recovered').length;
  return {
    interventions_sent: sent.length,
    won_back: wonBack,
    win_back_rate: sent.length ? wonBack / sent.length : 0,
    sustained_recovered: recovered,
    sustained_evaluated: evaluated.length,
    sustained_return_rate: evaluated.length ? recovered / evaluated.length : 0,
    sustained_pending: records.length - evaluated.length,
  };
}

/* ------------------------------------------------------------------ */
/* fraud prevention: trust score                                        */
/* ------------------------------------------------------------------ */

export interface TrustScore {
  score: number;
  level: 'high' | 'medium' | 'low';
  factors: string[];
}

/**
 * Trust score — a simple, transparent metric that answers "how reliable is this
 * diner's review history?" Higher = more trustworthy.
 *
 * Factors:
 *   base: 50
 *   +15 if they have 3+ past reviews (established reviewer)
 *   +10 if reviews use guided tags (specific, not vague)
 *   +10 if reviews span multiple visits (not a burst)
 *   +10 if order history >= 5 (real customer)
 *   +5  if they opted in to nudges (engaged)
 *   -20 if all reviews are from same day (suspicious burst)
 *
 * Deliberately simple — the point is visibility, not a black-box ML score.
 */
export function computeTrustScore(ds: Dataset, dinerId: string): TrustScore {
  const factors: string[] = [];
  let score = 50;

  const diner = ds.diners.find((d) => d.id === dinerId);
  const reviews = ds.reviews.filter((r) => r.diner_id === dinerId);
  const orders = ds.orders.filter((o) => o.diner_id === dinerId);

  // Established reviewer
  if (reviews.length >= 3) {
    score += 15;
    factors.push(`${reviews.length} past reviews (+15)`);
  } else if (reviews.length > 0) {
    score += 5;
    factors.push(`${reviews.length} review${reviews.length > 1 ? 's' : ''} (+5)`);
  } else {
    factors.push('No review history (+0)');
  }

  // Guided tags used (specific feedback)
  const taggedReviews = reviews.filter((r) => r.guided_tags.length > 0);
  if (taggedReviews.length > 0) {
    score += 10;
    factors.push('Uses specific feedback tags (+10)');
  }

  // Reviews span multiple days (not a burst)
  if (reviews.length >= 2) {
    const uniqueDays = new Set(reviews.map((r) => r.days_ago));
    if (uniqueDays.size >= 2) {
      score += 10;
      factors.push('Reviews spread across visits (+10)');
    } else {
      score -= 20;
      factors.push('All reviews on the same day (-20)');
    }
  }

  // Order history depth
  if (orders.length >= 5) {
    score += 10;
    factors.push(`${orders.length} orders — real customer (+10)`);
  } else if (orders.length >= 3) {
    score += 5;
    factors.push(`${orders.length} orders (+5)`);
  }

  // Engagement
  if (diner?.notify_opt_in) {
    score += 5;
    factors.push('Opted in to communications (+5)');
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));
  const level: TrustScore['level'] = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return { score, level, factors };
}

/* ------------------------------------------------------------------ */
/* fraud prevention: review rate limiting                                */
/* ------------------------------------------------------------------ */

import { getRuntimeReviews } from './store';

/**
 * Check whether a diner has exceeded their daily review cap.
 * Returns null if OK, or a human-readable reason string if blocked.
 */
export function checkReviewCap(dinerId: string, config: AppConfig): string | null {
  const todayReviews = getRuntimeReviews().filter(
    (r) => r.diner_id === dinerId && r.days_ago === 0,
  );
  if (todayReviews.length >= config.max_reviews_per_day) {
    return `You've already left ${config.max_reviews_per_day} reviews today. Come back tomorrow — we limit reviews to keep feedback genuine.`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* restaurant affordability: budget checks                              */
/* ------------------------------------------------------------------ */

export interface BudgetStatus {
  daily_used_myr: number;
  daily_budget_myr: number;
  daily_remaining_myr: number;
  per_customer_used_myr: number;
  per_customer_cap_myr: number;
  is_over_daily: boolean;
  is_over_customer: boolean;
}

/**
 * How much of their daily rebate budget a restaurant has used.
 * Reads from runtime rewards issued today (days_ago === 0).
 */
export function checkBudget(
  ds: Dataset,
  restaurantId: string,
  dinerId: string,
): BudgetStatus {
  const config = ds.config;

  // Sum today's rewards from this restaurant (fixture + runtime)
  const todayRewards = ds.rewardTokens.filter(
    (t) => t.restaurant_id === restaurantId && t.issued_days_ago === 0,
  );
  const todayInterventions = ds.interventions.filter(
    (i) => i.restaurant_id === restaurantId && i.sent_days_ago === 0,
  );

  // Estimate daily spend: count rewards × average reward value
  // For simplicity, use the intervention presentation's reward_percent × average order
  const avgOrder = ds.orders.length > 0
    ? ds.orders.reduce((sum, o) => sum + o.amount, 0) / ds.orders.length
    : 20;

  let dailyUsed = 0;
  for (const t of todayRewards) {
    const pres = ds.interventionLookup.presentation[t.intervention_type];
    dailyUsed += (pres?.reward_percent ?? 10) / 100 * avgOrder;
  }

  // Per-customer: this month's rewards to this diner from this restaurant
  const monthRewards = ds.rewardTokens.filter(
    (t) => t.restaurant_id === restaurantId && t.diner_id === dinerId && t.issued_days_ago <= 30,
  );
  let customerUsed = 0;
  for (const t of monthRewards) {
    const pres = ds.interventionLookup.presentation[t.intervention_type];
    customerUsed += (pres?.reward_percent ?? 10) / 100 * avgOrder;
  }

  return {
    daily_used_myr: Math.round(dailyUsed * 100) / 100,
    daily_budget_myr: config.daily_rebate_budget_myr,
    daily_remaining_myr: Math.max(0, config.daily_rebate_budget_myr - dailyUsed),
    per_customer_used_myr: Math.round(customerUsed * 100) / 100,
    per_customer_cap_myr: config.per_customer_rebate_cap_myr,
    is_over_daily: dailyUsed >= config.daily_rebate_budget_myr,
    is_over_customer: customerUsed >= config.per_customer_rebate_cap_myr,
  };
}

/* ------------------------------------------------------------------ */
/* priority score — Quick Win / Worth Trying / Long Shot               */
/* ------------------------------------------------------------------ */

export type PriorityLabel = 'Quick Win' | 'Worth Trying' | 'Long Shot';

export interface PriorityScore {
  score: number; // 0–100
  label: PriorityLabel;
  returnChance: number; // percentage
  explanation: string;
}

/**
 * Priority score for a flagged diner — higher = easier to win back.
 *
 * Factors:
 *   +30 if evidence is strong (they told us what's wrong — we can fix it)
 *   +15 if evidence is weak (we have a guess)
 *   +25 if days_since_last_order < 2× baseline (still recent)
 *   +15 if days_since < 4× baseline (fading but not gone)
 *   +20 if order_count >= 5 (loyal, worth fighting for)
 *   +10 if order_count >= 3
 *
 * Score → label:
 *   >= 65 → Quick Win
 *   >= 40 → Worth Trying
 *   < 40  → Long Shot
 */
export function computePriority(
  flag: RiskFlag,
  orders: Order[],
): PriorityScore {
  let score = 0;
  const parts: string[] = [];

  // Evidence strength
  if (flag.evidence_strength === 'strong') {
    score += 30;
    parts.push('told us the reason (+30)');
  } else if (flag.evidence_strength === 'weak') {
    score += 15;
    parts.push('pattern suggests a reason (+15)');
  } else {
    parts.push('no signal on why (+0)');
  }

  // Recency — how overdue are they?
  const baseline = flag.baseline_cadence ?? 14;
  const since = flag.days_since_last_order ?? 30;
  const ratio = since / baseline;
  if (ratio < 2) {
    score += 25;
    parts.push(`only ${since}d gone, usually ${Math.round(baseline)}d (+25)`);
  } else if (ratio < 4) {
    score += 15;
    parts.push(`${since}d gone, usually ${Math.round(baseline)}d (+15)`);
  } else {
    parts.push(`${since}d gone, very overdue (+0)`);
  }

  // Loyalty depth
  if (orders.length >= 5) {
    score += 20;
    parts.push(`${orders.length} past orders — loyal (+20)`);
  } else if (orders.length >= 3) {
    score += 10;
    parts.push(`${orders.length} past orders (+10)`);
  } else {
    parts.push(`${orders.length} orders — new-ish (+0)`);
  }

  score = Math.min(100, Math.max(0, score));
  const label: PriorityLabel = score >= 65 ? 'Quick Win' : score >= 40 ? 'Worth Trying' : 'Long Shot';
  // Return chance is a friendlier version of the score
  const returnChance = Math.min(95, Math.max(15, score + Math.floor(Math.random() * 10)));

  return {
    score,
    label,
    returnChance,
    explanation: parts.join('. ') + '.',
  };
}
