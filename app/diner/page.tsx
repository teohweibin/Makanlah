// Diner-facing hub — everything a diner sees, in one scroll.
//
// The restaurant-side risk machinery is deliberately invisible here: no cadence, no
// flag status, no "we noticed you stopped coming". A diner sees their meal, their
// rewards, and their settings.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { GuidedReview } from '@/components/GuidedReview';
import { DinerRewards } from '@/components/DinerRewards';
import { NudgeToggle } from '@/components/NudgeToggle';
import { loadDataset } from '@/lib/fixtures';
import { getSubmittedReview } from '@/lib/store';
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
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{n}</p>
        <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
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
      {/* header + demo diner switcher */}
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
        >
          &larr; Makanlah
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {diner.avatar_emoji}
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              {diner.name.replace(' (demo profile)', '')}
            </h1>
            <p className="text-sm text-stone-500">Your Makanlah</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {ds.diners.map((d) => (
            <Link
              key={d.id}
              href={`/diner?as=${d.id}`}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                d.id === diner.id
                  ? 'border-stone-800 bg-stone-800 text-white'
                  : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
              }`}
            >
              {d.avatar_emoji} {d.name.replace(' (demo profile)', '')}
            </Link>
          ))}
        </div>
      </header>

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
            <div className="mb-4 rounded-lg bg-stone-50 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <p className="font-medium text-stone-900">{restaurant.name}</p>
                <span className="text-xs text-stone-500">{activeOrder.table}</span>
              </div>
              <p className="mt-0.5 text-sm text-stone-500">
                {dishes.map((d) => d.name).join(', ')}
              </p>
              <p className="mt-0.5 text-sm text-stone-500">
                Bill: {ds.config.currency} {activeOrder.amount.toFixed(2)}
              </p>
            </div>

            {submitted && presentation ? (
              /* ── 2. reward confirmation ───────────────────────────────── */
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl">
                  ✓
                </div>
                <div className="mt-3 flex justify-center">
                  <InterventionTag
                    icon={presentation.icon}
                    label={presentation.tag_label}
                    color={presentation.tag_color}
                  />
                </div>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-stone-900">
                  {submitted.reward_percent}%
                </p>
                <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
                  off this bill
                </p>
                <p className="mt-2 text-stone-600">{presentation.body}</p>

                <div className="mt-4 rounded-lg bg-stone-50 px-3 py-3 text-left text-sm">
                  {submitted.mint_address ? (
                    <p className="text-stone-700">
                      🪙 Your reward token has been sent to your wallet.{' '}
                      <span className="text-stone-500">
                        It&rsquo;s yours to keep — usable here or at any Makanlah restaurant.
                      </span>
                    </p>
                  ) : (
                    <p className="text-stone-700">
                      Your reward is saved. Sending the token to your wallet is still pending
                      {submitted.chain_error ? `: ${submitted.chain_error}` : '.'}
                    </p>
                  )}
                </div>

                <p className="mt-3 text-sm text-stone-500">
                  You told us:{' '}
                  {submitted.review.guided_tags
                    .map((raw) => {
                      const [tagId, dishId] = raw.split(':');
                      const tag = ds.guidedReviewTags.find((t) => t.id === tagId);
                      const dish = dishId
                        ? restaurant.known_dishes.find((d) => d.id === dishId)
                        : null;
                      return `${tag?.label ?? tagId}${dish ? ` (${dish.name})` : ''}`;
                    })
                    .join(', ')}
                </p>
              </div>
            ) : (
              <GuidedReview
                orderId={activeOrder.id}
                restaurantName={restaurant.name}
                dishes={dishes}
                tags={ds.guidedReviewTags}
                hideIntro
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
