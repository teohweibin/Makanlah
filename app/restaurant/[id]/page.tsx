import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  ChainPanelSkeleton,
  CrossRestaurantRecognition,
  RewardLedger,
} from '@/components/ChainPanels';
import { CampaignTrigger } from '@/components/CampaignTrigger';
import { dashboardMetrics, evaluateRestaurant, recomputeSustainedReturn } from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import type { ReasonType } from '@/lib/types';
import { Card, EvidenceBadge, InterventionTag, StatusBadge, evidenceHint } from '@/components/ui';

const REASON_LABEL: Record<ReasonType, string> = {
  dish_issue: 'Something was wrong with a dish',
  wait_time: 'Waited too long',
  declining_spend: 'Spending less each visit',
  silent_churn: 'Looking, not ordering',
  no_signal: 'Reason unknown',
  none: '—',
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const days = (n: number | null) => (n === null ? '—' : `${Number.isInteger(n) ? n : n.toFixed(1)}d`);

export default async function RestaurantDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ds = loadDataset();
  const restaurant = ds.restaurants.find((r) => r.id === id);
  if (!restaurant) notFound();

  const flagged = evaluateRestaurant(ds, id);
  const metrics = dashboardMetrics(ds, id);
  const sustained = recomputeSustainedReturn(ds).filter((r) => r.restaurant_id === id);
  const dinerName = (dinerId: string) =>
    ds.diners.find((d) => d.id === dinerId)?.name ?? dinerId;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      {/* ── header ─────────────────────────────────────────────────────── */}
      <header className="mb-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {ds.restaurants.map((r) => (
            <Link
              key={r.id}
              href={`/restaurant/${r.id}`}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                r.id === id
                  ? 'border-stone-800 bg-stone-800 text-white'
                  : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
              }`}
            >
              {r.name}
            </Link>
          ))}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900">{restaurant.name}</h1>
        <p className="mt-1 text-stone-500">{restaurant.tagline}</p>
        {restaurant.is_struggling && (
          <Link
            href="/discover"
            className="mt-3 inline-block rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-900 underline decoration-amber-300 underline-offset-4 ring-1 ring-amber-200 transition hover:bg-amber-100"
          >
            Flagged as struggling — included in the Discover &amp; Support pool &rarr;
          </Link>
        )}
      </header>

      {/* ── metrics ────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Retention metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Win-back rate
            </div>
            <div className="mt-1 text-3xl font-semibold text-stone-900">
              {pct(metrics.win_back_rate)}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              {metrics.won_back} of {metrics.interventions_sent} interventions returned
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Sustained return
            </div>
            <div className="mt-1 text-3xl font-semibold text-stone-900">
              {metrics.sustained_evaluated ? pct(metrics.sustained_return_rate) : '—'}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              {metrics.sustained_recovered} of {metrics.sustained_evaluated} back to normal cadence
              {metrics.sustained_pending > 0 && ` · ${metrics.sustained_pending} pending`}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Currently flagged
            </div>
            <div className="mt-1 text-3xl font-semibold text-stone-900">{flagged.length}</div>
            <div className="mt-1 text-sm text-stone-500">
              {flagged.filter((f) => f.flag.evidence_strength === 'strong').length} with a verified
              reason
            </div>
          </Card>
        </div>

        {/* sustained return detail — the metric that separates a real fix from a coupon */}
        <Card className="mt-4 overflow-hidden">
          <div className="border-b border-stone-200 px-4 py-3">
            <h3 className="font-medium text-stone-900">Sustained return trend</h3>
            <p className="mt-0.5 text-sm text-stone-500">
              Did they stay, or did they take the reward and leave? Measured 30 days after a
              win-back order — recovered means their cadence is back within &plusmn;
              {pct(ds.config.sustained_return_tolerance)} of baseline.
            </p>
          </div>
          {sustained.length === 0 ? (
            <p className="px-4 py-6 text-sm text-stone-500">No win-back history yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-2 font-medium">Diner</th>
                  <th className="px-4 py-2 font-medium">Baseline</th>
                  <th className="px-4 py-2 font-medium">After win-back</th>
                  <th className="px-4 py-2 font-medium">Target band</th>
                  <th className="px-4 py-2 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {sustained.map((r) => {
                  const lo = r.baseline_cadence * (1 - ds.config.sustained_return_tolerance);
                  const hi = r.baseline_cadence * (1 + ds.config.sustained_return_tolerance);
                  const tone =
                    r.status === 'recovered'
                      ? 'text-emerald-700'
                      : r.status === 'not_recovered'
                        ? 'text-rose-700'
                        : 'text-stone-500';
                  return (
                    <tr key={r.diner_id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 text-stone-800">{dinerName(r.diner_id)}</td>
                      <td className="px-4 py-2.5 text-stone-600">{days(r.baseline_cadence)}</td>
                      <td className="px-4 py-2.5 text-stone-600">
                        {days(r.post_win_back_cadence_30d)}
                      </td>
                      <td className="px-4 py-2.5 text-stone-500">
                        {days(lo)} – {days(hi)}
                      </td>
                      <td className={`px-4 py-2.5 font-medium ${tone}`}>
                        {r.status.replace('_', ' ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      {/* ── one-tap campaign ───────────────────────────────────────────── */}
      {flagged.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Win-back campaign
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Pick a group, send in one tap — each diner still gets the intervention their own
            evidence earned.
          </p>
          <Card className="p-4">
            <CampaignTrigger
              targets={flagged.map(({ flag, diner, intervention_type }) => {
                const p = ds.interventionLookup.presentation[intervention_type];
                return {
                  diner_id: diner.id,
                  name: diner.name,
                  avatar_emoji: diner.avatar_emoji,
                  evidence_strength: flag.evidence_strength,
                  status: flag.status,
                  intervention_type,
                  icon: p.icon,
                  tag_label: p.tag_label,
                  notify_opt_in: diner.notify_opt_in,
                };
              })}
            />
          </Card>
        </section>
      )}

      {/* ── on-chain ───────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
          On-chain rewards
        </h2>
        <p className="mb-4 text-sm text-stone-500">
          Everything in this section is a live devnet query. Our JSON is not consulted for
          redemption status.
        </p>
        <div className="space-y-4">
          <Suspense fallback={<ChainPanelSkeleton label="reward redemption status" />}>
            <RewardLedger restaurantId={id} />
          </Suspense>
          <Suspense fallback={<ChainPanelSkeleton label="wallet holdings" />}>
            <CrossRestaurantRecognition restaurantId={id} />
          </Suspense>
        </div>
      </section>

      {/* ── at-risk list ───────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Diners at risk
        </h2>
        <p className="mb-4 text-sm text-stone-500">
          Sorted by evidence strength — the ones who actually told us why come first.
        </p>

        {flagged.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-stone-600">No diners flagged here.</p>
            <p className="mt-1 text-sm text-stone-500">
              Diners need at least {ds.config.min_orders_for_baseline} orders before a baseline
              cadence exists — without one we deliberately do not guess.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {flagged.map(({ flag, diner, intervention_type, headline }) => {
              const p = ds.interventionLookup.presentation[intervention_type];
              return (
                <li key={flag.id}>
                  <Card className="p-4 transition hover:border-stone-300">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl" aria-hidden>
                          {diner.avatar_emoji}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-stone-900">{diner.name}</span>
                            <StatusBadge status={flag.status} />
                            <EvidenceBadge strength={flag.evidence_strength} />
                          </div>
                          <p className="mt-1 text-stone-700">{REASON_LABEL[flag.reason_type]}</p>
                          <p className="mt-1 max-w-2xl text-sm text-stone-500">
                            {flag.evidence_note}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-sm text-stone-500">
                        <div>
                          Last order <span className="text-stone-800">{flag.days_since_last_order}d</span> ago
                        </div>
                        <div>
                          Usually every{' '}
                          <span className="text-stone-800">{days(flag.baseline_cadence)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-stone-100 pt-3">
                      <InterventionTag icon={p.icon} label={p.tag_label} color={p.tag_color} />
                      <span className="text-sm text-stone-700">&ldquo;{headline}&rdquo;</span>
                      <Link
                        href={`/restaurant/${id}/diner/${diner.id}`}
                        className="ml-auto text-sm font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900"
                      >
                        Why this diner &rarr;
                      </Link>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-4 text-xs text-stone-400">
          {evidenceHint('strong')} · {evidenceHint('weak')} · {evidenceHint('none')}
        </p>
      </section>
    </main>
  );
}
