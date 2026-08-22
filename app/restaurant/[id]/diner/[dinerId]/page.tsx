
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  daysBetweenConsecutiveOrders,
  evaluateDiner,
  ordersFor,
  parseGuidedTag,
  renderHeadline,
  selectIntervention,
  computeTrustScore,
} from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import { getAllSubmittedReviews } from '@/lib/store';
import { Card, EvidenceBadge, InterventionTag, StatusBadge } from '@/components/ui';
import { evidenceHint, evidenceLabel } from '@/lib/plain';

const days = (n: number | null) => (n === null ? '—' : `${Number.isInteger(n) ? n : n.toFixed(1)}d`);

export default async function DinerReasonDetail({
  params,
}: {
  params: Promise<{ id: string; dinerId: string }>;
}) {
  const { id, dinerId } = await params;
  const ds = loadDataset();
  const restaurant = ds.restaurants.find((r) => r.id === id);
  const diner = ds.diners.find((d) => d.id === dinerId);
  if (!restaurant || !diner) notFound();

  const flag = evaluateDiner(ds, dinerId, id);
  if (!flag) notFound();

  const interventionType = selectIntervention(
    flag.reason_type,
    flag.evidence_strength,
    ds.interventionLookup,
  );
  const presentation = ds.interventionLookup.presentation[interventionType];
  const headline = renderHeadline(ds, interventionType, flag.related_dish_id);

  const orders = ordersFor(ds, dinerId, id);
  const gaps = daysBetweenConsecutiveOrders(orders);
  const reviews = ds.reviews
    .filter((r) => r.diner_id === dinerId && r.restaurant_id === id)
    .sort((a, b) => a.days_ago - b.days_ago);
  const opens = ds.appOpenEvents
    .filter((e) => e.diner_id === dinerId && e.restaurant_id === id)
    .sort((a, b) => a.days_ago - b.days_ago);
  // The AI-analysed review for this diner at this restaurant, if they left one today.
  const live = getAllSubmittedReviews().find(
    (s) => s.review.diner_id === dinerId && s.review.restaurant_id === id,
  );

  const relatedPain = restaurant.known_pain_points.find(
    (p) =>
      p.reason_type === flag.reason_type &&
      (p.related_dish_id === null || p.related_dish_id === flag.related_dish_id),
  );

  const trust = computeTrustScore(ds, dinerId);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <Link
        href={`/restaurant/${id}`}
        className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
      >
        &larr; {restaurant.name} dashboard
      </Link>

      <header className="mt-4 mb-8 flex items-start gap-4">
        <span className="text-4xl" aria-hidden>
          {diner.avatar_emoji}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{diner.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={flag.status} />
            <EvidenceBadge strength={flag.evidence_strength} />
            <span
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                trust.level === 'high'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : trust.level === 'medium'
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-rose-300 bg-rose-50 text-rose-900'
              }`}
            >
              Trust {trust.score}/100
            </span>
          </div>
        </div>
      </header>

      {/* What the diner actually said, showed, and what it means — in one place. */}
      {live && (
        <Card className="mb-5 overflow-hidden">
          <div className="border-b border-stone-100 px-5 py-3">
            <h2 className="font-medium text-stone-900">What they told you</h2>
            <p className="mt-0.5 text-sm text-stone-500">
              Their words, their photo, and what it adds up to.
            </p>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr]">
            {live.photo_base64 ? (
              <figure className="sm:w-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${live.photo_base64}`}
                  alt={`Photo sent by ${diner.name}`}
                  className="w-full rounded-lg border border-stone-200 object-cover sm:h-44"
                />
                <figcaption className="mt-1.5 text-xs text-stone-500">
                  {live.photo_verdict === 'verified_with_photo'
                    ? '📷 Checked and genuine'
                    : live.photo_verdict === 'rejected'
                      ? '📷 Rejected — did not look like this meal'
                      : '📷 Could not be confirmed'}
                </figcaption>
              </figure>
            ) : (
              <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-stone-200 text-sm text-stone-400 sm:h-44 sm:w-44">
                No photo
              </div>
            )}

            <div className="min-w-0">
              {live.review.free_text && (
                <blockquote className="border-l-2 border-stone-300 pl-3 text-stone-700 italic">
                  &ldquo;{live.review.free_text}&rdquo;
                </blockquote>
              )}
              {live.review.ai?.followups?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {live.review.ai.followups.map((f) => (
                    <span
                      key={f}
                      className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-700"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-4 rounded-lg bg-stone-50 px-3 py-2.5 text-stone-800">
                {live.owner_summary}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {evidenceLabel(flag.evidence_strength)} · reward given{' '}
                {live.reward_percent}% off
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* why we flagged them */}
      <Card className="mb-5 p-5">
        <h2 className="font-medium text-stone-900">Why we flagged this</h2>
        <p className="mt-2 text-stone-700">{flag.evidence_note}</p>
        <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
          <span className="font-medium">
            {evidenceLabel(flag.evidence_strength)}
          </span>{' '}
          — {evidenceHint(flag.evidence_strength)}. Source:{' '}
          <code className="text-stone-700">{flag.evidence_source}</code>
        </p>
        {relatedPain && (
          <p className="mt-3 text-sm text-stone-600">
            Matches a known pain point: <span className="text-stone-800">{relatedPain.label}</span>{' '}
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 ring-1 ring-emerald-200">
              {relatedPain.status}
            </span>
            {relatedPain.fixed_note && ` — ${relatedPain.fixed_note}`}
          </p>
        )}
      </Card>

      {/* trust score breakdown */}
      <Card className="mb-5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-stone-900">Reviewer Trust</h2>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              trust.level === 'high'
                ? 'bg-emerald-100 text-emerald-900'
                : trust.level === 'medium'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-rose-100 text-rose-900'
            }`}
          >
            {trust.score}/100
          </span>
        </div>
        {/* progress bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full transition-all ${
              trust.level === 'high'
                ? 'bg-emerald-500'
                : trust.level === 'medium'
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
            }`}
            style={{ width: `${trust.score}%` }}
          />
        </div>
        <ul className="mt-3 space-y-1">
          {trust.factors.map((f) => (
            <li key={f} className="text-sm text-stone-600">
              • {f}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-stone-400">
          This score decides whether a reward is issued at full value. Low-trust reviewers
          may receive capped rewards to prevent gaming.
        </p>
      </Card>

      {/* the cadence maths, shown openly */}
      <Card className="mb-5 p-5">
        <h2 className="font-medium text-stone-900">Ordering pattern</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-stone-500">Orders</dt>
            <dd className="text-lg text-stone-900">{orders.length}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Baseline cadence</dt>
            <dd className="text-lg text-stone-900">{days(flag.baseline_cadence)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Days since last</dt>
            <dd className="text-lg text-stone-900">{flag.days_since_last_order}</dd>
          </div>
          <div>
            <dt className="text-stone-500">At-risk threshold</dt>
            <dd className="text-lg text-stone-900">
              {days(flag.baseline_cadence === null ? null : flag.baseline_cadence * ds.config.at_risk_multiplier)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-stone-500">
          Gaps between orders: {gaps.length ? gaps.map((g) => `${g}d`).join(' · ') : '—'}
        </p>

        <ol className="mt-4 space-y-1.5 text-sm">
          {[...orders].reverse().map((o) => (
            <li key={o.id} className="flex justify-between gap-4 border-b border-stone-100 pb-1.5 last:border-0">
              <span className="text-stone-700">
                {o.dish_ids
                  .map((dishId) =>
                    ds.restaurants
                      .flatMap((r) => r.known_dishes)
                      .find((d) => d.id === dishId)?.name ?? dishId,
                  )
                  .join(', ')}
              </span>
              <span className="shrink-0 text-stone-500">
                {ds.config.currency} {o.amount.toFixed(2)} · {o.days_ago}d ago
              </span>
            </li>
          ))}
        </ol>
      </Card>

      {/* raw signals */}
      <div className="mb-5 grid gap-5 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-medium text-stone-900">Guided reviews</h2>
          {reviews.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">
              None on file — this is why the reason is unverified.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {reviews.map((r) => (
                <li key={r.id}>
                  <div className="flex flex-wrap gap-1.5">
                    {r.guided_tags.map((raw) => {
                      const { tag, dishId } = parseGuidedTag(raw, ds.guidedReviewTags);
                      const dishName = dishId
                        ? ds.restaurants.flatMap((x) => x.known_dishes).find((d) => d.id === dishId)?.name
                        : null;
                      return (
                        <span
                          key={raw}
                          className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-700"
                        >
                          {tag?.label ?? raw}
                          {dishName ? ` · ${dishName}` : ''}
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-stone-600 italic">&ldquo;{r.free_text}&rdquo;</p>
                  <p className="text-xs text-stone-400">{r.days_ago}d ago · {r.rating}/5</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-medium text-stone-900">App opens</h2>
          <p className="mt-1 text-xs text-stone-500">
            Tracked separately from orders — this is what makes silent churn visible at all.
          </p>
          {opens.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No app opens on record.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm text-stone-600">
              {opens.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      e.days_ago <= ds.config.silent_churn_window_days
                        ? 'bg-violet-500'
                        : 'bg-stone-300'
                    }`}
                  />
                  Opened {e.days_ago}d ago
                  {e.days_ago <= ds.config.silent_churn_window_days && ' · inside the window'}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* what the diner will see */}
      <Card className="p-5">
        <h2 className="font-medium text-stone-900">Chosen intervention</h2>
        <p className="mt-1 text-sm text-stone-500">
          <code className="text-stone-700">
            lookup({flag.reason_type}, {flag.evidence_strength})
          </code>{' '}
          &rarr; <code className="text-stone-700">{interventionType}</code>
        </p>
        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <div className="mb-2">
            <InterventionTag
              icon={presentation.icon}
              label={presentation.tag_label}
              color={presentation.tag_color}
            />
          </div>
          <p className="text-lg font-medium text-stone-900">{headline}</p>
          <p className="mt-1 text-stone-600">{presentation.body}</p>
          <p className="mt-3 text-sm text-stone-500">
            Reward: {presentation.reward_percent}% off · issued as an on-chain token when claimed
          </p>
        </div>
        <Link
          href={`/diner/${dinerId}/invite/${id}`}
          className="mt-3 inline-block text-sm font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          Preview exactly what {diner.name.split(' ')[0]} receives &rarr;
        </Link>
      </Card>
    </main>
  );
}
