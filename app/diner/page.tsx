// Diner-facing hub — everything a diner sees, in one scroll.
//
// The restaurant-side risk machinery is deliberately invisible here: no cadence, no
// flag status, no "we noticed you stopped coming". A diner sees their meal, their
// rewards, and their settings.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DinerRewards } from '@/components/DinerRewards';
import { InvitationList } from '@/components/InvitationCard';
import { NudgeToggle } from '@/components/NudgeToggle';
import { ReviewFlow } from '@/components/ReviewFlow';
import { loadDataset } from '@/lib/fixtures';
import { getInvitationsForDiner, getSubmittedReview } from '@/lib/store';
import { Card } from '@/components/ui';

const DEFAULT_DINER = 'diner_a';

function Section({
  n,
  title,
  subtitle,
  children,
}: {
  n: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{n}</p>
        <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-ink)]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--color-muted)]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function DinerHub({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const ds = loadDataset();
  const diner = ds.diners.find((d) => d.id === (as ?? DEFAULT_DINER));
  if (!diner) notFound();

  const activeOrder = ds.activeOrders.find((o) => o.diner_id === diner.id);
  const restaurant = activeOrder
    ? ds.restaurants.find((r) => r.id === activeOrder.restaurant_id)
    : null;
  const dishes =
    activeOrder && restaurant
      ? activeOrder.dish_ids
          .map((id) => restaurant.known_dishes.find((d) => d.id === id))
          .filter((d): d is NonNullable<typeof d> => !!d)
      : [];

  const submitted = activeOrder ? getSubmittedReview(activeOrder.id) : undefined;
  const presentation = submitted
    ? ds.interventionLookup.presentation[submitted.intervention_type]
    : null;

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      {/* header */}
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-ink)]"
        >
          &larr; MakanLagi
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {diner.avatar_emoji}
          </span>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
              {diner.name.replace(' (demo profile)', '')}
            </h1>
            <p className="text-sm text-[var(--color-muted)]">Your MakanLagi</p>
          </div>
        </div>
      </header>

      {/* ── pending invitations (restaurant fixed something you reported) ─── */}
      <InvitationList invitations={getInvitationsForDiner(diner.id)} />

      {/* ── 1 + 2. active order → guided review → reward confirmation ────── */}
      <Section
        n="Tonight"
        title={submitted ? 'Thanks — that actually helps' : 'How was your meal?'}
        subtitle={
          submitted
            ? undefined
            : 'A word or two is plenty. We ask the follow-ups so you can just tap.'
        }
      >
        {!activeOrder || !restaurant ? (
          <Card className="p-6 text-center text-stone-500">No open order right now.</Card>
        ) : (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2.5">
              <div>
                <p className="font-medium text-stone-900">{restaurant.name}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {activeOrder.table} · {ds.config.currency} {activeOrder.amount.toFixed(2)}
                </p>
              </div>
              <span className="text-xs text-stone-400">tonight</span>
            </div>

            {submitted && presentation ? (
              /* ── 2. reward confirmation — visual-first ────────────────── */
              <div className="flex flex-col items-center px-2 py-6">
                {/* large checkmark */}
                <div className="animate-scale-in flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-success-light)]">
                  <span className="text-5xl text-[var(--color-success)]">✓</span>
                </div>

                {/* discount */}
                <p className="mt-5 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-[var(--color-ink)]">
                  {submitted.reward_percent}% OFF
                </p>

                {/* savings + tokens */}
                <div className="mt-4 space-y-1.5 text-center">
                  <p className="text-lg text-[var(--color-muted)]">
                    You saved:{' '}
                    <span className="font-semibold text-[var(--color-ink)]">
                      {ds.config.currency}{' '}
                      {(activeOrder.amount * submitted.reward_percent / 100).toFixed(2)}
                    </span>
                  </p>
                  <p className="text-lg text-[var(--color-muted)]">
                    Tokens earned:{' '}
                    <span className="font-semibold text-[var(--color-ink)]">1 🪙</span>
                  </p>
                </div>

                {/* chain status — small footnote */}
                {!submitted.mint_address && submitted.chain_error && (
                  <p className="mt-4 text-xs text-[var(--color-muted)]">
                    Token pending: {submitted.chain_error}
                  </p>
                )}

                {/* action buttons */}
                <div className="mt-6 flex w-full gap-3">
                  <Link
                    href="/"
                    className="flex-1 rounded-xl border border-[var(--color-ink)]/15 bg-white px-4 py-3 text-center text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-paper)]"
                  >
                    Done
                  </Link>
                  <Link
                    href={`/diner/${diner.id}/wallet`}
                    className="flex-1 rounded-xl bg-[var(--color-ink)] px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--color-ink)]/85"
                  >
                    View in Wallet
                  </Link>
                </div>
              </div>
            ) : (
              <ReviewFlow
                orderId={activeOrder.id}
                restaurantName={restaurant.name}
                dishes={dishes}
                tags={ds.guidedReviewTags}
                currency={ds.config.currency}
              />
            )}
          </Card>
        )}
      </Section>

      {/* ── 3. my rewards, read from chain ──────────────────────────────── */}
      <Section
        n="My Rewards"
        title="Yours, not theirs"
        subtitle="Read live from your wallet on Solana devnet."
      >
        <Suspense
          fallback={
            <Card className="p-5">
              <p className="text-sm text-stone-500">Reading your wallet…</p>
            </Card>
          }
        >
          <DinerRewards dinerId={diner.id} />
        </Suspense>
        <Link
          href={`/diner/${diner.id}/wallet`}
          className="mt-3 block text-center text-sm font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          View full wallet &rarr;
        </Link>
      </Section>

      {/* ── 4. discover & support ───────────────────────────────────────── */}
      <Section
        n="Discover &amp; Support"
        title="Places worth keeping open"
        subtitle="Quiet kitchens, not bad ones. Your rewards count for more here."
      >
        <ul className="space-y-3">
          {ds.discoverPool.map((p) => (
            <li key={p.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{p.name}</p>
                    <p className="mt-0.5 text-sm text-stone-500">{p.tagline}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      {p.distance} away · try the {p.signature_dish}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-900">
                    {p.multiplier}&times; points
                  </span>
                </div>
                <p className="mt-3 border-t border-stone-100 pt-2.5 text-sm text-stone-600">
                  {p.reason}
                </p>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-stone-400">
          Curated by hand, not ranked by an algorithm.
        </p>
      </Section>

      {/* ── 5. settings ─────────────────────────────────────────────────── */}
      <Section n="Settings" title="What we&rsquo;re allowed to send you">
        <Card className="p-4">
          <NudgeToggle dinerId={diner.id} initial={diner.notify_opt_in} />
        </Card>
        <p className="mt-3 text-xs text-stone-400">
          Turning this off removes you from every restaurant&rsquo;s win-back campaign, not
          just this screen.
        </p>
      </Section>
    </main>
  );
}
