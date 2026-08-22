// Diner-facing hub — everything a diner sees, in one scroll.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DinerRewards } from '@/components/DinerRewards';
import { GuidedReview } from '@/components/GuidedReview';
import { InvitationList } from '@/components/InvitationCard';
import { NudgeToggle } from '@/components/NudgeToggle';
import { loadDataset } from '@/lib/fixtures';
import { getInvitationsForDiner, getSubmittedReview } from '@/lib/store';
import { Card, InterventionTag } from '@/components/ui';

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

      {/* ── pending invitations ──────────────────────────────────────────── */}
      <InvitationList invitations={getInvitationsForDiner(diner.id)} />

      {/* ── 1 + 2. active order → review → reward confirmation ───────────── */}
      <Section
        n="Tonight"
        title={submitted ? 'Thanks — that actually helps' : 'How was your meal?'}
        subtitle={
          submitted
            ? undefined
            : 'A word or two is plenty — we'll ask the rest.'
        }
      >
        {!activeOrder || !restaurant ? (
          <Card className="p-6 text-center text-[var(--color-muted)]">No open order right now.</Card>
        ) : (
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between rounded-lg bg-[var(--color-paper)] px-3 py-2.5">
              <div>
                <p className="font-medium text-[var(--color-ink)]">{restaurant.name}</p>
                <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                  {activeOrder.table} · {ds.config.currency} {activeOrder.amount.toFixed(2)}
                </p>
              </div>
              <span className="text-xs text-[var(--color-muted)]">tonight</span>
            </div>

            {submitted && presentation ? (
              /* ── reward confirmation — visual-first ──────────────────── */
              <div className="flex flex-col items-center px-2 py-6">
                <div className="animate-scale-in flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-success-light)]">
                  <span className="text-5xl text-[var(--color-success)]">
                    {submitted.reward_percent === 0 ? '🙏' : '✓'}
                  </span>
                </div>

                {submitted.reward_percent > 0 ? (
                  <>
                    <p className="mt-5 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-[var(--color-ink)]">
                      {submitted.reward_percent}% OFF
                    </p>
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
                  </>
                ) : (
                  <div className="mt-4 text-center">
                    <p className="text-lg font-medium text-[var(--color-ink)]">
                      Thank you — your feedback has been sent
                    </p>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                      More specific feedback (or a photo) earns a discount next time.
                    </p>
                  </div>
                )}

                {!submitted.mint_address && submitted.chain_error && submitted.reward_percent > 0 && (
                  <p className="mt-4 text-xs text-[var(--color-muted)]">
                    Token pending: {submitted.chain_error}
                  </p>
                )}

                <div className="mt-6 flex w-full gap-3">
                  <Link
                    href="/"
                    className="flex-1 rounded-xl border border-[var(--color-ink)]/15 bg-white px-4 py-3 text-center text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-paper)]"
                  >
                    Done
                  </Link>
                  {submitted.reward_percent > 0 && (
                    <Link
                      href={`/diner/${diner.id}/wallet`}
                      className="flex-1 rounded-xl bg-[var(--color-ink)] px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--color-ink)]/85"
                    >
                      View in Wallet
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <GuidedReview
                orderId={activeOrder.id}
                restaurantName={restaurant.name}
                dishes={dishes}
                hideIntro
              />
            )}
          </Card>
        )}
      </Section>

      {/* ── 3. my rewards ────────────────────────────────────────────────── */}
      <Section
        n="My Rewards"
        title="Yours, not theirs"
        subtitle="Read live from your wallet on Solana devnet."
      >
        <Suspense
          fallback={
            <Card className="p-5">
              <p className="text-sm text-[var(--color-muted)]">Reading your wallet…</p>
            </Card>
          }
        >
          <DinerRewards dinerId={diner.id} />
        </Suspense>
        <Link
          href={`/diner/${diner.id}/wallet`}
          className="mt-3 block text-center text-sm font-medium text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-ink)]"
        >
          View full wallet →
        </Link>
      </Section>

      {/* ── 4. discover & support ────────────────────────────────────────── */}
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
                    <p className="font-medium text-[var(--color-ink)]">{p.name}</p>
                    <p className="mt-0.5 text-sm text-[var(--color-muted)]">{p.tagline}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]/60">
                      {p.distance} away · try the {p.signature_dish}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--color-warning)]/30 bg-[var(--color-warning-light)] px-2.5 py-1 text-sm font-semibold text-[var(--color-warning)]">
                    {p.multiplier}× points
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── 5. settings ──────────────────────────────────────────────────── */}
      <Section n="Settings" title="What we're allowed to send you">
        <Card className="p-4">
          <NudgeToggle dinerId={diner.id} initial={diner.notify_opt_in} />
        </Card>
      </Section>
    </main>
  );
}
