// Restaurant owner dashboard.
//
// Ordering principle: what to DO comes first, who it concerns second, how it's going
// third, and the receipts last. An owner between lunch and dinner service should be able
// to act correctly from the top of this page without reading the rest of it.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  ChainPanelSkeleton,
  CrossRestaurantRecognition,
  RewardLedger,
} from '@/components/ChainPanels';
import { CampaignTrigger } from '@/components/CampaignTrigger';
import { TodaysAction, type ActionGroup } from '@/components/TodaysAction';
import { dashboardMetrics, evaluateRestaurant, recomputeSustainedReturn } from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import { plainCadence, plainFlag, plainGap, plainToldUs } from '@/lib/plain';
import { Card } from '@/components/ui';


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
    (ds.diners.find((d) => d.id === dinerId)?.name ?? dinerId).replace(' (demo profile)', '');

  /* ── decide the one thing worth doing today ───────────────────────────── */

  const rows = flagged.map((f) => {
    const dishName = f.flag.related_dish_id
      ? (restaurant.known_dishes.find((d) => d.id === f.flag.related_dish_id)?.name ?? null)
      : null;
    const toldUs = plainToldUs(f.flag.reason_type, dishName);
    return {
      ...f,
      dishName,
      toldUs,
      plain: plainFlag(f.flag.status, f.flag.evidence_strength, f.flag.reason_type, toldUs),
      presentation: ds.interventionLookup.presentation[f.intervention_type],
    };
  });

  // Opted-out diners can never be in an action group — the Settings toggle is binding.
  const reachable = rows.filter((r) => r.diner.notify_opt_in);
  const buckets: Array<{ key: ActionGroup['key']; members: typeof reachable }> = [
    { key: 'told_us', members: reachable.filter((r) => r.flag.evidence_strength === 'strong') },
    { key: 'browsing', members: reachable.filter((r) => r.flag.status === 'silent_churn') },
    {
      key: 'been_a_while',
      members: reachable.filter(
        (r) => r.flag.evidence_strength !== 'strong' && r.flag.status !== 'silent_churn',
      ),
    },
  ];
  const top = buckets.find((b) => b.members.length > 0);
  const actionGroup: ActionGroup | null = top
    ? {
        key: top.key,
        diner_names: top.members.map((m) => m.diner.name.replace(' (demo profile)', '')),
        spread: [
          ...top.members
            .reduce((acc, m) => {
              const cur = acc.get(m.intervention_type);
              if (cur) cur.n += 1;
              else
                acc.set(m.intervention_type, {
                  icon: m.presentation.icon,
                  label: m.presentation.tag_label,
                  n: 1,
                });
              return acc;
            }, new Map<string, { icon: string; label: string; n: number }>())
            .values(),
        ],
      }
    : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      {/* ── header ─────────────────────────────────────────────────────── */}
      <header className="mb-7">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-stone-300 bg-white px-3 py-1 text-sm text-stone-500 transition hover:border-stone-400"
          >
            &larr; Makanlah
          </Link>
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
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{restaurant.name}</h1>
        <p className="mt-0.5 text-stone-500">{restaurant.tagline}</p>
      </header>

      {/* ── 1. today's action ──────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Today&rsquo;s action
        </h2>
        <TodaysAction group={actionGroup} />
      </section>

      {/* ── 2. who needs attention ─────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-stone-900">
          Regulars who&rsquo;ve drifted
        </h2>
        <p className="mb-4 text-sm text-stone-500">
          The ones who told you why come first — those are the easiest to win back.
        </p>

        {rows.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-stone-600">Nobody&rsquo;s drifting right now.</p>
            <p className="mt-1 text-sm text-stone-500">
              We only flag someone once they have enough visits for us to know their rhythm.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {rows.map(({ flag, diner, headline, plain, presentation, toldUs }) => (
              <li key={flag.id}>
                <Card className="overflow-hidden">
                  {/* the human part, first and biggest */}
                  <div className="flex items-start gap-3 px-4 pt-4">
                    <span className="text-2xl" aria-hidden>
                      {diner.avatar_emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-stone-900">
                          {diner.name.replace(' (demo profile)', '')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm text-stone-500">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              plain.tone === 'amber' ? 'bg-amber-500' : 'bg-stone-400'
                            }`}
                            aria-hidden
                          />
                          {plain.headline}
                        </span>
                        {!diner.notify_opt_in && (
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">
                            nudges off
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-stone-600">{plain.detail}</p>
                    </div>
                  </div>

                  {/* the message they'd receive — the most human thing here */}
                  <div className="mx-4 mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                      What we&rsquo;d send them
                    </p>
                    <p className="mt-1 flex items-start gap-2 text-lg font-medium leading-snug text-stone-900">
                      <span aria-hidden>{presentation.icon}</span>
                      <span>&ldquo;{headline}&rdquo;</span>
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 px-4 py-2.5 text-sm text-stone-500">
                    <span>Last visit {plainGap(flag.days_since_last_order)}</span>
                    <span>Usually {plainCadence(flag.baseline_cadence)}</span>
                    <Link
                      href={`/restaurant/${id}/diner/${diner.id}`}
                      className="ml-auto font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900"
                    >
                      See the full story &rarr;
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── 3. reach a group ───────────────────────────────────────────── */}
      {rows.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-stone-900">
            Reach a group instead
          </h2>
          <p className="mb-4 text-sm text-stone-500">
            Pick who to contact, and we&rsquo;ll write each message to fit their reason.
          </p>
          <Card className="p-4">
            <CampaignTrigger
              targets={rows.map(({ flag, diner, intervention_type, presentation }) => ({
                diner_id: diner.id,
                name: diner.name,
                avatar_emoji: diner.avatar_emoji,
                evidence_strength: flag.evidence_strength,
                status: flag.status,
                intervention_type,
                icon: presentation.icon,
                tag_label: presentation.tag_label,
                notify_opt_in: diner.notify_opt_in,
              }))}
            />
          </Card>
        </section>
      )}

      {/* ── 4. how it's going ──────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-stone-900">
          How it&rsquo;s going
        </h2>

        <div className="space-y-3">
          <Card className="flex items-center gap-4 p-4">
            <span className="text-2xl" aria-hidden>
              💌
            </span>
            <p className="text-stone-800">
              <span className="font-medium text-stone-900">
                {metrics.won_back} out of {metrics.interventions_sent}
              </span>{' '}
              came back after you reached out
            </p>
          </Card>

          <Card className="flex items-center gap-4 p-4">
            <span className="text-2xl" aria-hidden>
              🔁
            </span>
            <p className="text-stone-800">
              {metrics.sustained_evaluated > 0 ? (
                <>
                  <span className="font-medium text-stone-900">
                    {metrics.sustained_recovered} out of {metrics.sustained_evaluated}
                  </span>{' '}
                  are still coming regularly — not just once
                </>
              ) : (
                'No one has reached the 30-day mark yet — check back soon'
              )}
              {metrics.sustained_pending > 0 && (
                <span className="text-stone-500">
                  {' '}
                  ({metrics.sustained_pending} still too early to tell)
                </span>
              )}
            </p>
          </Card>

          <Card className="flex items-center gap-4 p-4">
            <span className="text-2xl" aria-hidden>
              👋
            </span>
            <p className="text-stone-800">
              <span className="font-medium text-stone-900">{rows.length} regulars</span> need your
              attention
            </p>
          </Card>
        </div>

        {/* the detail an owner can open if they want it, closed by default */}
        {sustained.length > 0 && (
          <details className="mt-3 rounded-xl border border-stone-200 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm text-stone-600">
              Show me who those numbers are
            </summary>
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {sustained.map((r) => (
                <li key={r.diner_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="text-stone-800">{dinerName(r.diner_id)}</span>
                  <span className="text-stone-500">
                    used to come {plainCadence(r.baseline_cadence)}
                  </span>
                  <span
                    className={`ml-auto font-medium ${
                      r.status === 'recovered'
                        ? 'text-emerald-700'
                        : r.status === 'not_recovered'
                          ? 'text-rose-700'
                          : 'text-stone-500'
                    }`}
                  >
                    {r.status === 'recovered'
                      ? 'back to normal'
                      : r.status === 'not_recovered'
                        ? 'came once, then quiet'
                        : 'too early to tell'}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-400">
              &ldquo;Back to normal&rdquo; means they&rsquo;re visiting about as often as they
              used to, measured a month after they returned — not just one visit.
            </p>
          </details>
        )}
      </section>

      {/* ── 5. receipts, last ──────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-stone-900">
          Reward History
        </h2>
        <p className="mb-4 text-sm text-stone-500">
          Every reward you&rsquo;ve given, and whether it&rsquo;s been used. Checked against the
          diner&rsquo;s own wallet, so it can&rsquo;t be quietly changed.
        </p>
        <div className="space-y-4">
          <Suspense fallback={<ChainPanelSkeleton label="checking rewards" />}>
            <RewardLedger restaurantId={id} />
          </Suspense>
          <Suspense fallback={<ChainPanelSkeleton label="checking wallets" />}>
            <CrossRestaurantRecognition restaurantId={id} />
          </Suspense>
        </div>
      </section>

      {restaurant.is_struggling && (
        <Link
          href="/discover"
          className="mt-8 block rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100"
        >
          You&rsquo;re listed in Discover &amp; Support — diners earn extra rewards for eating
          here &rarr;
        </Link>
      )}
    </main>
  );
}
