// POST /api/analyze-review
//
// The only way the app reaches Gemini. This runs on the server so GEMINI_API_KEY never
// reaches the browser — a client-side call would ship the key in the JS bundle, and a
// key in a public repo's bundle is a key you have to rotate.
//
// The client sends an order id, not a restaurant name and dish list. The server derives
// those from the fixtures, so a caller cannot claim they ordered a dish they didn't and
// fish for a photo-verified reward on it.

import { NextResponse } from 'next/server';
import { analyzeReview } from '@/lib/analyzeReview';
import { loadDataset } from '@/lib/fixtures';

// Needs the Node runtime: the fixtures loader reads from disk.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Gemini took 8–14s for text and longer with an image in testing, with wide variance.
 * Vision needs a bigger budget than text — a single shared timeout either cuts photo
 * analysis off mid-flight or makes text reviews wait far longer than they need to.
 * Past the budget we stop waiting and let the caller degrade.
 */
const TEXT_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 15_000);
const PHOTO_TIMEOUT_MS = Number(process.env.GEMINI_PHOTO_TIMEOUT_MS ?? 30_000);
const MAX_TEXT_CHARS = 2_000;
/** ~4MB of base64 ≈ a 3MB photo. Bigger than this is a mistake, not a meal. */
const MAX_IMAGE_CHARS = 4_000_000;

/** Mirrors analyzeReview's own fallback so callers always get the same shape. */
const FALLBACK = (reason: string) => ({
  sentiment: 'neutral',
  issue_category: 'none',
  specific_dish_mentioned: null,
  suggested_followup_options: [],
  text_evidence_strength: 'weak',
  photo_verdict: 'no_photo',
  photo_matches_order: null,
  combined_evidence_strength: 'weak',
  reward_multiplier: 0.5,
  reason_for_multiplier: reason,
  owner_summary: 'Review submitted but could not be analysed automatically.',
});

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_key_here') {
    return NextResponse.json(
      { ok: false, reason: 'not_configured', analysis: FALLBACK('AI analysis is not configured') },
      { status: 503 },
    );
  }

  let body: {
    orderId?: unknown;
    reviewText?: unknown;
    base64ImageData?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  const reviewText = typeof body.reviewText === 'string' ? body.reviewText.trim() : '';

  if (!orderId) {
    return NextResponse.json({ ok: false, reason: 'missing_order_id' }, { status: 400 });
  }
  if (reviewText.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ ok: false, reason: 'text_too_long' }, { status: 413 });
  }

  // Strip a data: URL prefix if the client sent one, then sanity-check the payload.
  let base64ImageData: string | undefined;
  if (typeof body.base64ImageData === 'string' && body.base64ImageData.length > 0) {
    const raw = body.base64ImageData.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    if (raw.length > MAX_IMAGE_CHARS) {
      return NextResponse.json({ ok: false, reason: 'image_too_large' }, { status: 413 });
    }
    if (!/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
      return NextResponse.json({ ok: false, reason: 'image_not_base64' }, { status: 400 });
    }
    base64ImageData = raw;
  }

  if (!reviewText && !base64ImageData) {
    return NextResponse.json({ ok: false, reason: 'nothing_to_analyse' }, { status: 400 });
  }

  // Server-side truth about what was actually ordered.
  const ds = loadDataset();
  const order =
    ds.orders.find((o) => o.id === orderId) ?? ds.activeOrders.find((o) => o.id === orderId);
  if (!order) {
    return NextResponse.json({ ok: false, reason: 'unknown_order' }, { status: 404 });
  }
  const restaurant = ds.restaurants.find((r) => r.id === order.restaurant_id);
  if (!restaurant) {
    return NextResponse.json({ ok: false, reason: 'unknown_restaurant' }, { status: 404 });
  }
  const dishesOrdered = order.dish_ids
    .map((id) => restaurant.known_dishes.find((d) => d.id === id)?.name)
    .filter((n): n is string => !!n);

  const timeoutMs = base64ImageData ? PHOTO_TIMEOUT_MS : TEXT_TIMEOUT_MS;
  const startedAt = Date.now();
  try {
    // A hung model call must not hang the diner's review. The caller degrades instead.
    const analysis = await Promise.race([
      analyzeReview({
        restaurantName: restaurant.name,
        dishesOrdered,
        reviewText,
        base64ImageData,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      ),
    ]);

    return NextResponse.json({
      ok: true,
      analysis,
      had_photo: !!base64ImageData,
      latency_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.message === 'timeout';
    // Log the failure, never the key or the image payload.
    console.error(
      `[analyze-review] ${timedOut ? 'timed out' : 'failed'} after ${Date.now() - startedAt}ms:`,
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json(
      {
        ok: false,
        reason: timedOut ? 'timeout' : 'upstream_error',
        analysis: FALLBACK(timedOut ? 'AI analysis timed out' : 'AI analysis unavailable'),
        latency_ms: Date.now() - startedAt,
      },
      { status: 200 }, // 200: the review itself is fine, only the enrichment failed.
    );
  }
}
