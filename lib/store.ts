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
const globalStore = globalThis as unknown as { __makanlagi_store?: Store };
const store: Store = (globalStore.__makanlagi_store ??= { reviews: [], invites: [] });
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

const prefs = (globalStore.__makanlagi_store as Store & {
  nudgePrefs?: Record<string, boolean>;
}).nudgePrefs ??= {};

export function setNudgePreference(dinerId: string, optIn: boolean): void {
  prefs[dinerId] = optIn;
}

export function getNudgePreference(dinerId: string): boolean | undefined {
  return prefs[dinerId];
}

/* ── categorized dish feedback ───────────────────────────────────────────── */
//
// Every review is broken down per-dish so an agent/dashboard can pull all feedback
// for a specific dish across all diners. This is the structured data that powers
// improvement suggestions.

export interface DishFeedbackEntry {
  dish_id: string;
  dish_name: string;
  category: 'food' | 'beverage';
  tag_ids: string[];
  tag_labels: string[];
  diner_id: string;
  restaurant_id: string;
  order_id: string;
  submitted_at: number; // Date.now()
}

const dishFeedback = ((globalStore.__makanlagi_store as Store & {
  dishFeedback?: DishFeedbackEntry[];
}).dishFeedback ??= []);

export function addDishFeedback(entries: DishFeedbackEntry[]): void {
  dishFeedback.push(...entries);
}

/** All feedback for a specific dish — what the agent reads to suggest improvements. */
export function getFeedbackForDish(dishId: string): DishFeedbackEntry[] {
  return dishFeedback.filter((f) => f.dish_id === dishId);
}

/** All feedback for a restaurant, grouped by dish. */
export function getFeedbackByDish(restaurantId: string): Record<string, DishFeedbackEntry[]> {
  const grouped: Record<string, DishFeedbackEntry[]> = {};
  for (const entry of dishFeedback) {
    if (entry.restaurant_id !== restaurantId) continue;
    const key = entry.dish_id;
    (grouped[key] ??= []).push(entry);
  }
  return grouped;
}

/** All feedback for a restaurant, flat list. */
export function getAllFeedbackForRestaurant(restaurantId: string): DishFeedbackEntry[] {
  return dishFeedback.filter((f) => f.restaurant_id === restaurantId);
}

/* ── fix notifications ───────────────────────────────────────────────────── */
//
// When a restaurant owner marks a pain point as fixed, we queue a notification
// for every diner who flagged that issue. Next time they open the app, they see
// "We fixed X — come try it again" with an attached reward.

export interface FixNotification {
  id: string;
  diner_id: string;
  restaurant_id: string;
  restaurant_name: string;
  dish_id: string | null;
  dish_name: string | null;
  message: string;
  reward_percent: number;
  created_at: number;
  seen: boolean;
}

const notifications = ((globalStore.__makanlagi_store as Store & {
  notifications?: FixNotification[];
}).notifications ??= []);

export function addFixNotification(notif: FixNotification): void {
  // Don't duplicate for same diner + dish
  const exists = notifications.some(
    (n) => n.diner_id === notif.diner_id && n.dish_id === notif.dish_id && n.restaurant_id === notif.restaurant_id,
  );
  if (!exists) notifications.push(notif);
}

export function getNotificationsForDiner(dinerId: string): FixNotification[] {
  return notifications.filter((n) => n.diner_id === dinerId && !n.seen);
}

export function markNotificationSeen(notifId: string): void {
  const notif = notifications.find((n) => n.id === notifId);
  if (notif) notif.seen = true;
}

export function getAllNotifications(): FixNotification[] {
  return [...notifications];
}

/* ── Invitations (accept-before-mint) ────────────────────────────────────── */

import type { Invitation, InvitationStatus } from './types';

const invitations = ((globalStore.__makanlagi_store as Store & {
  invitations?: Invitation[];
}).invitations ??= []);

export function addInvitation(inv: Invitation): void {
  // One pending invitation per diner+restaurant+dish combo
  const existing = invitations.findIndex(
    (i) => i.diner_id === inv.diner_id && i.restaurant_id === inv.restaurant_id
      && i.dish_id === inv.dish_id && i.status === 'pending',
  );
  if (existing >= 0) invitations[existing] = inv;
  else invitations.push(inv);
}

export function getInvitationsForDiner(dinerId: string): Invitation[] {
  const now = Date.now();
  return invitations.filter((i) => {
    if (i.diner_id !== dinerId) return false;
    // Auto-expire
    if (i.status === 'pending' && now - i.created_at > i.validity_days * 86_400_000) {
      i.status = 'expired';
    }
    return i.status === 'pending';
  });
}

export function getInvitation(id: string): Invitation | undefined {
  return invitations.find((i) => i.id === id);
}

export function updateInvitationStatus(
  id: string,
  status: InvitationStatus,
  mint?: { mint_address: string; mint_signature: string },
): void {
  const inv = invitations.find((i) => i.id === id);
  if (!inv) return;
  inv.status = status;
  if (mint) {
    inv.mint_address = mint.mint_address;
    inv.mint_signature = mint.mint_signature;
  }
}

export function getAcceptedInvitations(dinerId: string): Invitation[] {
  return invitations.filter((i) => i.diner_id === dinerId && i.status === 'accepted');
}

export function getAllInvitations(): Invitation[] {
  return [...invitations];
}
