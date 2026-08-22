// One view of every reward token we know about — seeded fixtures plus anything issued
// during this demo session. Our records say WHICH reward a mint is and who issued it;
// the chain says whether it has been used. Those are deliberately separate questions.

import type { Dataset } from './engine';
import { getAllSubmittedReviews } from './store.ts';
import type { InterventionType } from './types';

export interface KnownReward {
  id: string;
  diner_id: string;
  restaurant_id: string;
  intervention_type: InterventionType;
  mint_address: string | null;
  issued_days_ago: number;
  chain_error: string | null;
}

export function knownRewards(ds: Dataset): KnownReward[] {
  const seeded: KnownReward[] = ds.rewardTokens
    .filter((t) => !!t.id)
    .map((t) => ({
      id: t.id,
      diner_id: t.diner_id,
      restaurant_id: t.restaurant_id,
      intervention_type: t.intervention_type,
      mint_address: t.mint_address,
      issued_days_ago: t.issued_days_ago,
      chain_error: null,
    }));

  const live: KnownReward[] = getAllSubmittedReviews().map((s) => ({
    id: s.reward_token_id,
    diner_id: s.review.diner_id,
    restaurant_id: s.review.restaurant_id,
    intervention_type: s.intervention_type,
    mint_address: s.mint_address,
    issued_days_ago: 0,
    chain_error: s.chain_error,
  }));

  return [...live, ...seeded].sort((a, b) => a.issued_days_ago - b.issued_days_ago);
}

/** Which restaurant issued a given mint, if we issued it at all. */
export function issuerOf(ds: Dataset, mintAddress: string): string | null {
  return knownRewards(ds).find((r) => r.mint_address === mintAddress)?.restaurant_id ?? null;
}
