// Restaurant owner dashboard — 3 zones: Quick Stats, Kitchen To-Do, Insights.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  ChainPanelSkeleton,
  CrossRestaurantRecognition,
  RewardLedger,
} from '@/components/ChainPanels';
import { KitchenToDoCard, type DishIssueGroup } from '@/components/KitchenToDoCard';
import { DonutChart } from '@/components/DonutChart';
import { RedeemPanel } from '@/components/RedeemPanel';
import {
  dashboardMetrics,
  evaluateRestaurant,
  checkBudget,
} from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import { getFeedbackByDish, getAllInvitations } from '@/lib/store';
import { findRecommendation } from '@/lib/recommendation-engine';
import { Card } from '@/components/ui';
import actionItemsSeed from '@/data/action_items_seed.json';

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
  const budget = checkBudget(ds, id, '');
  const allInvitations = getAllInvitations();

  // ── Build dish-grouped issue cards ──────────────────────────────────────
  // Combine: runtime feedback + seeded action items
  const runtimeFeedback = getFeedbackByDish(id);
  const dinerLookup = (dinerId: string) => ds.diners.find((d) => d.id === dinerId);

  const dishGroups: DishIssueGroup[] = [];

  // From runtime dish feedback (submitted during this session)
  for (const [dishId, entries] of Object.entries(runtimeFeedback)) {
    const dish = restaurant.known_dishes.find((d) => d.id === dishId);
    const dishName = dish?.name ?? dishId;

    // Get recommendation from engine using combined complaint text
    const combinedText = entries.map((e) => e.tag_labels.join(', ')).join('. ');
    const rec = findRecommendation(combinedText, [dishName]);

    // Check if already resolved (invitation sent for this dish)
    const isResolved = allInvitations.some(
      (inv) => inv.dish_id === dishId && inv.restaurant_id === id && (inv.status === 'accepted' || inv.status === 'pending'),
    );

    dishGroups.push({
      dishId,
      dishName,
      restaurantId: id,
      complaints: entries.map((e) => ({
        dinerId: e.diner_id,
        dinerName: dinerLookup(e.diner_id)?.name.replace(' (demo profile)', '') ?? e.diner_id,
        dinerEmoji: dinerLookup(e.diner_id)?.avatar_emoji ?? '\uD83D\uDC64',
        quote: e.tag_labels.join(', '),
        tags: e.tag_ids,
      })),
      recommendation: {
        title: `Fix ${dishName}: ${rec.rootCause.split(' or ')[0].toLowerCase()}`,
        action: rec.action,
        rootCause: rec.rootCause,
        priority: rec.priority as 'quick' | 'medium' | 'urgent',
      },
      isResolved,
    });
  }

  // From seeded action items (pre-populated for demo)
  for (const seed of actionItemsSeed) {
    if (seed.restaurantId !== id) continue;
    // Don't duplicate if runtime already has this dish
    if (dishGroups.some((g) => g.dishId === seed.dishId)) continue;

    const isResolved = allInvitations.some(
      (inv) => inv.dish_id === seed.dishId && inv.restaurant_id === id && (inv.status === 'accepted' || inv.status === 'pending'),
    );

    dishGroups.push({
      dishId: seed.dishId ?? `seed_${seed.id}`,
      dishName: seed.dishName ?? 'Service',
      restaurantId: id,
      complaints: [{
        dinerId: seed.dinerId,
        dinerName: seed.dinerName,
        dinerEmoji: dinerLookup(seed.dinerId)?.avatar_emoji ?? '\uD83D\uDC64',
        quote: seed.customerQuote,
        tags: [],
      }],
      recommendation: {
        title: seed.title,
        action: seed.expertAction,
        rootCause: seed.rootCause,
        priority: seed.priority as 'quick' | 'medium' | 'urgent',
      },
      isResolved,
    });
  }

  // Sort: urgent first, then quick, then medium
  const priorityRank = { urgent: 0, quick: 1, medium: 2 };
  dishGroups.sort((a, b) => priorityRank[a.recommendation.priority] - priorityRank[b.recommendation.priority]);

  const pendingGroups = dishGroups.filter((g) => !g.isResolved);
  const resolvedGroups = dishGroups.filter((g) => g.isResolved);

  const budgetPercent = Math.min(100, (budget.daily_used_myr / budget.daily_budget_myr) * 100);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      {/* HEADER */}
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-[var(--color-ink)]/10 bg-white px-3 py-1 text-sm text-[var(--color-muted)] transition hover:border-[var(--color-ink)]/25"
          >
            &larr; MakanLagi
          </Link>
          {ds.restaurants.map((r) => (
            <Link
              key={r.id}
              href={`/restaurant/${r.id}`}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                r.id === id
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-[var(--color-ink)]/10 bg-white text-[var(--color-muted)] hover:border-[var(--color-ink)]/25'
              }`}
            >
              {r.name}
            </Link>
          ))}
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--color-ink)]">
          {restaurant.name}
        </h1>
        {/* budget bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-ink)]/5">
            <div
              className={`h-full rounded-full transition-all ${
                budgetPercent < 60 ? 'bg-[var(--color-success)]' : budgetPercent < 90 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-danger)]'
              }`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-[var(--color-muted)]">
            Budget: RM {budget.daily_used_myr.toFixed(0)}/{budget.daily_budget_myr}
          </span>
        </div>
      </header>

      {/* ZONE 1: QUICK STATS */}
      <section className="mb-8 grid grid-cols-3 gap-3">
        <StatCard value={pendingGroups.length} label="issues" color="var(--color-danger)" />
        <StatCard value={metrics.won_back} label="won back" color="var(--color-success)" />
        <StatCard
          value={metrics.sustained_evaluated > 0 ? `${Math.round(metrics.sustained_return_rate * 100)}%` : '\u2014'}
          label="stayed"
          color="var(--color-violet)"
        />
      </section>

      {/* ── Redeem reward at counter ─────────────────────────────────── */}
      <section className="mb-8">
        <RedeemPanel restaurantName={restaurant.name} />
      </section>

      {/* ZONE 2: KITCHEN TO-DO */}
      <section className="mb-8">
        {pendingGroups.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-2xl">{'\uD83C\uDF89'}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
              All issues resolved!
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              No pending complaints. Keep it up.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingGroups.map((group) => (
              <KitchenToDoCard key={group.dishId} group={group} />
            ))}
          </div>
        )}

        {/* Resolved items */}
        {resolvedGroups.length > 0 && (
          <details className="mt-4 rounded-xl border border-[var(--color-ink)]/8 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {'\u2713'} Resolved ({resolvedGroups.length})
            </summary>
            <div className="space-y-2 border-t border-[var(--color-ink)]/5 p-4">
              {resolvedGroups.map((g) => (
                <div key={g.dishId} className="flex items-center gap-2 text-sm text-[var(--color-success)]">
                  <span>{'\u2713'}</span>
                  <span className="font-medium">{g.dishName}</span>
                  <span className="text-xs text-[var(--color-muted)]">
                    &mdash; {g.complaints.length} diner{g.complaints.length > 1 ? 's' : ''} invited back
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* ZONE 3: INSIGHTS (collapsible) */}
      <section className="mb-8">
        <details className="group rounded-xl border border-[var(--color-ink)]/8 bg-white shadow-sm">
          <summary className="cursor-pointer px-5 py-4 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)] group-open:border-b group-open:border-[var(--color-ink)]/5">
            {'\uD83D\uDCCA'} Insights &amp; History
          </summary>
          <div className="space-y-5 p-5">
            {flagged.length > 0 && (
              <DonutChart
                segments={(() => {
                  const counts: Record<string, number> = {};
                  for (const f of flagged) {
                    const key = f.flag.status === 'silent_churn' ? 'silent_churn' : f.flag.evidence_strength === 'strong' ? 'told_us' : 'unknown';
                    counts[key] = (counts[key] ?? 0) + 1;
                  }
                  return [
                    { label: 'Told us why', value: counts['told_us'] ?? 0, color: '#2F5233' },
                    { label: 'Silent churn', value: counts['silent_churn'] ?? 0, color: '#5B5285' },
                    { label: 'Unknown', value: counts['unknown'] ?? 0, color: '#5F5E5A' },
                  ];
                })()}
                centerValue={flagged.length}
                centerLabel="at risk"
              />
            )}
            <Suspense fallback={<ChainPanelSkeleton label="Loading rewards..." />}>
              <RewardLedger restaurantId={id} />
            </Suspense>
            <Suspense fallback={<ChainPanelSkeleton label="Checking wallets..." />}>
              <CrossRestaurantRecognition restaurantId={id} />
            </Suspense>
          </div>
        </details>
      </section>

      {restaurant.is_struggling && (
        <Link
          href="/discover"
          className="block rounded-xl bg-[var(--color-warning-light)] px-4 py-3 text-sm text-[var(--color-warning)] ring-1 ring-[var(--color-warning)]/20 transition hover:ring-[var(--color-warning)]/40"
        >
          You&rsquo;re in Discover &amp; Support &mdash; diners earn extra rewards here &rarr;
        </Link>
      )}
    </main>
  );
}

function StatCard({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-ink)]/8 bg-white p-4 text-center shadow-sm">
      <p className="font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </p>
    </div>
  );
}
