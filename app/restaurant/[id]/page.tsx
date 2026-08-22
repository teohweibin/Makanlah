// Restaurant owner dashboard — redesigned for clarity.
//
// 3 zones: Quick Stats → Who Needs You → Insights
// No paragraphs. Short labels. Big numbers. One CTA per card.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  ChainPanelSkeleton,
  CrossRestaurantRecognition,
  RewardLedger,
} from '@/components/ChainPanels';
import { DinerActionCard, type DinerCardData } from '@/components/DinerActionCard';
import { DonutChart } from '@/components/DonutChart';
import {
  computePriority,
  dashboardMetrics,
  evaluateRestaurant,
  checkBudget,
  ordersFor,
  renderHeadline,
} from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import { plainToldUs } from '@/lib/plain';
import { getInvitationsForDiner, getAllInvitations } from '@/lib/store';
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
  const budget = checkBudget(ds, id, '');
  const allInvitations = getAllInvitations();

  // Build card data with priority scores
  const cards: DinerCardData[] = flagged.map((f) => {
    const orders = ordersFor(ds, f.diner.id, id);
    const priority = computePriority(f.flag, orders);
    const dishName = f.flag.related_dish_id
      ? (restaurant.known_dishes.find((d) => d.id === f.flag.related_dish_id)?.name ?? null)
      : null;
    const reason = plainToldUs(f.flag.reason_type, dishName) ?? 'Been a while — no clear reason';

    // Check invitation status for this diner
    const inv = allInvitations.find(
      (i) => i.diner_id === f.diner.id && i.restaurant_id === id && i.status !== 'declined' && i.status !== 'expired',
    );

    const presentation = ds.interventionLookup.presentation[f.intervention_type];

    return {
      dinerId: f.diner.id,
      restaurantId: id,
      name: f.diner.name.replace(' (demo profile)', ''),
      avatar: f.diner.avatar_emoji,
      reason,
      dishId: f.flag.related_dish_id,
      dishName,
      evidenceStrength: f.flag.evidence_strength,
      status: f.flag.status,
      daysSinceLastVisit: f.flag.days_since_last_order,
      visitCadence: f.flag.baseline_cadence,
      priorityLabel: priority.label,
      returnChance: priority.returnChance,
      explanation: priority.explanation,
      invitationStatus: inv?.status,
      invitationSentAgo: inv ? timeAgo(inv.created_at) : undefined,
      mintAddress: inv?.mint_address,
      rewardDescription: presentation.tag_label,
      optedIn: f.diner.notify_opt_in,
    };
  }).sort((a, b) => {
    // Sort: Quick Win first, then Worth Trying, then Long Shot
    const rank = { 'Quick Win': 0, 'Worth Trying': 1, 'Long Shot': 2 };
    return rank[a.priorityLabel] - rank[b.priorityLabel];
  });

  const budgetPercent = Math.min(100, (budget.daily_used_myr / budget.daily_budget_myr) * 100);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-[var(--color-ink)]/10 bg-white px-3 py-1 text-sm text-[var(--color-muted)] transition hover:border-[var(--color-ink)]/25"
          >
            ← MakanLagi
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

        {/* inline budget bar */}
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

      {/* ── ZONE 1: QUICK STATS ────────────────────────────────────────── */}
      <section className="mb-8 grid grid-cols-3 gap-3">
        <StatCard value={cards.length} label="drifting" color="var(--color-danger)" />
        <StatCard value={metrics.won_back} label="won back" color="var(--color-success)" />
        <StatCard
          value={metrics.sustained_evaluated > 0 ? `${Math.round(metrics.sustained_return_rate * 100)}%` : '—'}
          label="stayed"
          color="var(--color-violet)"
        />
      </section>

      {/* ── ZONE 2: WHO NEEDS YOU ──────────────────────────────────────── */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold uppercase tracking-wide text-[var(--color-ink)]">
            Who Needs You ({cards.length})
          </h2>
        </div>

        {cards.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-2xl">🎉</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
              All your regulars are happy!
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              No one is at risk this week.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => (
              <DinerActionCard key={card.dinerId} data={card} />
            ))}
          </div>
        )}
      </section>

      {/* ── ZONE 3: INSIGHTS (collapsible) ─────────────────────────────── */}
      {cards.length > 0 && (
        <section className="mb-8">
          <details className="group rounded-xl border border-[var(--color-ink)]/8 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)] group-open:border-b group-open:border-[var(--color-ink)]/5">
              📊 Insights & History
            </summary>
            <div className="space-y-5 p-5">
              {/* Donut chart */}
              <div>
                <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Why they&rsquo;re drifting
                </h3>
                <DonutChart
                  segments={(() => {
                    const counts: Record<string, number> = {};
                    for (const c of cards) {
                      const key = c.status === 'silent_churn' ? 'silent_churn' : c.evidenceStrength === 'strong' ? 'told_us' : 'unknown';
                      counts[key] = (counts[key] ?? 0) + 1;
                    }
                    return [
                      { label: 'Told us why', value: counts['told_us'] ?? 0, color: '#2F5233' },
                      { label: 'Silent churn', value: counts['silent_churn'] ?? 0, color: '#5B5285' },
                      { label: 'Unknown', value: counts['unknown'] ?? 0, color: '#5F5E5A' },
                    ];
                  })()}
                  centerValue={cards.length}
                  centerLabel="flagged"
                />
              </div>

              {/* Reward history from chain */}
              <Suspense fallback={<ChainPanelSkeleton label="Loading rewards…" />}>
                <RewardLedger restaurantId={id} />
              </Suspense>
              <Suspense fallback={<ChainPanelSkeleton label="Checking wallets…" />}>
                <CrossRestaurantRecognition restaurantId={id} />
              </Suspense>
            </div>
          </details>
        </section>
      )}

      {restaurant.is_struggling && (
        <Link
          href="/discover"
          className="block rounded-xl bg-[var(--color-warning-light)] px-4 py-3 text-sm text-[var(--color-warning)] ring-1 ring-[var(--color-warning)]/20 transition hover:ring-[var(--color-warning)]/40"
        >
          You&rsquo;re in Discover & Support — diners earn extra rewards here →
        </Link>
      )}
    </main>
  );
}

/* ── Stat card ────────────────────────────────────────────────────────────── */

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

/* ── Helper ──────────────────────────────────────────────────────────────── */

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
