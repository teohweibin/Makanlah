// Loads the JSON fixtures in /data into a single Dataset.
//
// Server-side only (uses fs) — that is deliberate: the dashboard renders in server
// components and the engine is pure, so client components receive plain props and
// never need the fixtures themselves. Swapping this file for Supabase queries later
// is the only change required; nothing else touches storage.

import fs from 'node:fs';
import path from 'node:path';
import type { Dataset } from './engine';
import { getNudgePreference, getRuntimeReviews } from './store.ts';
import type { Diner, Review } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

function read<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf8')) as T;
}

/** Fixture arrays may carry a leading `_comment` key on the first row — strip it. */
function clean<T extends { id?: string }>(rows: T[]): T[] {
  return rows.map(({ ...row }) => {
    delete (row as Record<string, unknown>)._comment;
    return row as T;
  });
}

export function loadDataset(): Dataset {
  return {
    config: read('config'),
    restaurants: read('restaurants'),
    // Settings-toggle choices override the fixture default for this session.
    diners: read<Diner[]>('diners').map((d) => ({
      ...d,
      notify_opt_in: getNudgePreference(d.id) ?? d.notify_opt_in,
    })),
    orders: clean(read('orders')),
    appOpenEvents: clean(read('app_open_events')),
    // Reviews left during this demo session sit on top of the fixture history, so a
    // review submitted at the diner screen shows up on the restaurant dashboard live.
    reviews: [...clean(read<Review[]>('reviews')), ...getRuntimeReviews()],
    guidedReviewTags: read('guided_review_tags'),
    interventionLookup: read('intervention_lookup'),
    interventions: clean(read('interventions')),
    rewardTokens: clean(read('reward_tokens')),
    activeOrders: clean(read('active_orders')),
    discoverPool: clean(read('discover_pool')),
    sustainedReturnRecords: read('sustained_return_records'),
  };
}

export const ANCHOR_RESTAURANT_ID = 'rest_warung_mama';
export const SECOND_RESTAURANT_ID = 'rest_kedai_pakcik';
