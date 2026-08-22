// Plain-English renderings of the engine's output.
//
// The engine speaks in `at_risk`, `evidence_strength`, `baseline_cadence`. A restaurant
// owner should never have to learn that vocabulary — this file is the single place where
// the machine's words become a person's words, so the two never drift apart in the UI.

import type { EvidenceStrength, ReasonType, RiskStatus } from './types';

/** "about every two weeks" — never "baseline_cadence = 14". */
export function plainCadence(days: number | null): string {
  if (days === null) return 'now and then';
  if (days <= 2) return 'almost every day';
  if (days <= 4) return 'every few days';
  if (days <= 9) return 'about once a week';
  if (days <= 17) return 'about every two weeks';
  if (days <= 24) return 'about every three weeks';
  if (days <= 45) return 'about once a month';
  return 'every couple of months';
}

/** "over six weeks ago" — never "days_since_last_order = 46". */
export function plainGap(days: number | null): string {
  if (days === null) return 'a while ago';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `about ${weeks} weeks ago`;
  }
  const months = Math.round(days / 30);
  return `about ${months} month${months === 1 ? '' : 's'} ago`;
}

export interface PlainFlag {
  /** Short status line shown beside the diner's name. */
  headline: string;
  /** One sentence of what we actually know, in the owner's language. */
  detail: string;
  /** Colour of the little dot. Warm, never alarming. */
  tone: 'amber' | 'slate';
}

/**
 * The three cases an owner needs to tell apart:
 *   they told us why · they're browsing but silent · they've simply been gone a while.
 */
export function plainFlag(
  status: RiskStatus,
  evidence: EvidenceStrength,
  reason: ReasonType,
  toldUs: string | null,
): PlainFlag {
  if (evidence === 'strong') {
    return {
      headline: 'Needs attention',
      detail: toldUs ? `They told you: ${toldUs}` : 'They told you what went wrong.',
      tone: 'amber',
    };
  }
  if (status === 'silent_churn' || reason === 'silent_churn') {
    return {
      headline: 'Browsing but not ordering',
      detail: 'They keep opening the app without ordering — reason unclear.',
      tone: 'amber',
    };
  }
  return {
    headline: 'Just been a while',
    detail: 'Long gap, no reason found — send a gentle invite.',
    tone: 'slate',
  };
}

/** What the diner actually said, phrased for the owner. */
export function plainToldUs(reason: ReasonType, dishName: string | null): string | null {
  switch (reason) {
    case 'dish_issue':
      return dishName ? `something was off with the ${dishName}` : 'something was off with a dish';
    case 'wait_time':
      return 'they waited too long';
    case 'declining_spend':
      return 'it felt pricey for what they got';
    default:
      return null;
  }
}
