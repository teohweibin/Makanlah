// Makanlah — core logic engine.
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

export interface MerchantActionItemLink {
  dinerId: string;
  dinerName: string;
  reviewId: string;
  orderId: string;
  daysAgo: number;
}

export interface MerchantActionItem {
  id: string;
  issueText: string;
  count: number;
  fixed: boolean;
  linkedDiners: MerchantActionItemLink[];
  linkedMessageTemplate: string;
}

/**
 * Groups confirmed guided-review issues by issue type for a merchant.
 * This checklist is intentionally limited to diner-reported guided tags only:
 * silent churn and no-signal states are inferred from app behavior, not from a diner
 * telling us what went wrong, so they are deliberately excluded here. If this filter is
 * removed, the action list starts mixing real complaints with generic churn signals.
 */
export function getMerchantActionItems(ds: Dataset, merchantId: string): MerchantActionItem[] {
  const grouped = new Map<string, {
    id: string;
    issueText: string;
    reasonType: ReasonType;
    linkedDiners: MerchantActionItemLink[];
  }>();

  for (const review of ds.reviews.filter((r) => r.restaurant_id === merchantId)) {
    const diner = ds.diners.find((d) => d.id === review.diner_id);

    for (const rawTag of review.guided_tags) {
      const { tag } = parseGuidedTag(rawTag, ds.guidedReviewTags);
      // Keep this to explicit diner-reported guided-review issues only; do not include
      // inferred churn/no-signal states or positive feedback tags.
      if (
        !tag ||
        tag.reason_type === 'none' ||
        tag.reason_type === 'silent_churn' ||
        tag.reason_type === 'no_signal'
      ) continue;

      const key = tag.id;
      const current = grouped.get(key) ?? {
        id: `${merchantId}-${tag.id}`,
        issueText: tag.label,
        reasonType: tag.reason_type,
        linkedDiners: [],
      };

      current.linkedDiners.push({
        dinerId: review.diner_id,
        dinerName: diner?.name ?? review.diner_id,
        reviewId: review.id,
        orderId: review.order_id,
        daysAgo: review.days_ago,
      });

      grouped.set(key, current);
    }
  }

  return [...grouped.values()]
    .map((entry) => {
      const interventionType = selectIntervention(entry.reasonType, 'strong', ds.interventionLookup);
      return {
        id: entry.id,
        issueText: entry.issueText,
        count: entry.linkedDiners.length,
        fixed: false,
        linkedDiners: entry.linkedDiners,
        linkedMessageTemplate: ds.interventionLookup.presentation[interventionType].headline_template,
      } satisfies MerchantActionItem;
    })
    .sort((a, b) => b.count - a.count || a.issueText.localeCompare(b.issueText));
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
