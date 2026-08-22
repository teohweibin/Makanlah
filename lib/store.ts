// Runtime store for reviews submitted during a demo session.
//
// Deliberately in-memory rather than written back to /data: the fixtures are tuned so
// each diner lands on a specific flag path, and rewriting them mid-demo would make the
// dashboard non-reproducible on the second run. A server restart resets to a clean state.
// Production note: this is the seam where Supabase writes would go.

import type { InterventionType, Review } from './types';

export interface SubmittedReview {
  review: Review;
  intervention_type: InterventionType;
  reward_percent: number;
  reward_token_id: string;
  /** AI evidence tier, decides the reward copy and size. */
  evidence: string;
  owner_summary: string;
  photo_verdict: string;
  had_photo: boolean;
  /**
   * The photo itself, base64, kept in memory only so the owner can see what the diner
   * saw. Never written to disk or git — it dies with the server, like every other
   * runtime review in this demo.
   */
  photo_base64: string | null;
  /** Real devnet SPL mint, filled once the token is issued on chain. */
  mint_address: string | null;
  mint_signature: string | null;
  token_account: string | null;
  /** Why the mint failed, if it did — surfaced in the UI rather than swallowed. */
  chain_error: string | null;
}

/** A win-back invitation the diner actually accepted, with the reward it carried. */
export interface AcceptedInvite {
  diner_id: string;
  restaurant_id: string;
  intervention_type: InterventionType;
  reward_percent: number;
  reward_token_id: string;
  mint_address: string | null;
  mint_signature: string | null;
  chain_error: string | null;
}

interface Store {
  reviews: SubmittedReview[];
  invites: AcceptedInvite[];
}

// Survives hot-reload in dev, which module-level state would not.
const globalStore = globalThis as unknown as { __makanlah_store?: Store };
const store: Store = (globalStore.__makanlah_store ??= { reviews: [], invites: [] });
store.invites ??= [];

export function addSubmittedReview(entry: SubmittedReview): void {
  // One review per order — a resubmit replaces the previous answer.
  store.reviews = store.reviews.filter((r) => r.review.order_id !== entry.review.order_id);
  store.reviews.push(entry);
}

export function getSubmittedReview(orderId: string): SubmittedReview | undefined {
  return store.reviews.find((r) => r.review.order_id === orderId);
}

export function getRuntimeReviews(): Review[] {
  return store.reviews.map((r) => r.review);
}

export function addAcceptedInvite(invite: AcceptedInvite): void {
  store.invites = store.invites.filter(
    (i) => !(i.diner_id === invite.diner_id && i.restaurant_id === invite.restaurant_id),
  );
  store.invites.push(invite);
}

export function getAcceptedInvite(
  dinerId: string,
  restaurantId: string,
): AcceptedInvite | undefined {
  return store.invites.find((i) => i.diner_id === dinerId && i.restaurant_id === restaurantId);
}

export function getAllAcceptedInvites(): AcceptedInvite[] {
  return [...store.invites];
}

export function resetStore(): void {
  store.reviews = [];
  store.invites = [];
}

export function getAllSubmittedReviews(): SubmittedReview[] {
  return [...store.reviews];
}

/* ── nudge preference ────────────────────────────────────────────────────── */
//
// The Settings toggle writes here and `loadDataset` folds it over the fixture value,
// so flipping it off genuinely removes the diner from win-back campaigns rather than
// just hiding a banner.

const prefs = (globalStore.__makanlah_store as Store & {
  nudgePrefs?: Record<string, boolean>;
}).nudgePrefs ??= {};

export function setNudgePreference(dinerId: string, optIn: boolean): void {
  prefs[dinerId] = optIn;
}

export function getNudgePreference(dinerId: string): boolean | undefined {
  return prefs[dinerId];
}
