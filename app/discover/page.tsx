// Discover & Support pool — diner-facing.
//
// Scope note (PRD, Day-1 "build light"): this is a hand-curated list, not a
// recommendation engine. It is honest about that on screen rather than implying a
// ranking model that does not exist.

import Link from 'next/link';
import { loadDataset } from '@/lib/fixtures';
import { Card } from '@/components/ui';

export default function DiscoverPage() {
  const ds = loadDataset();
  const pool = ds.restaurants.filter((r) => r.is_struggling);
  const others = ds.restaurants.filter((r) => !r.is_struggling);

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
          Discover &amp; Support
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          Places worth keeping open
        </h1>
        <p className="mt-2 text-stone-600">
          Quiet kitchens, not bad ones. Eat at these and your rewards count for more —
          because the places that need customers most are rarely the ones with the biggest
          marketing budget.
        </p>
      </header>

      {pool.length === 0 ? (
        <Card className="p-6 text-center text-stone-500">
          No restaurants in the pool right now.
        </Card>
      ) : (
        <ul className="space-y-4">
          {pool.map((r) => (
            <li key={r.id}>
              <Card className="overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 pt-4">
                  <div>
                    <h2 className="font-medium text-stone-900">{r.name}</h2>
                    <p className="mt-0.5 text-sm text-stone-500">{r.tagline}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-900">
                    {r.support_multiplier ?? 2}&times; rewards
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 px-4 py-3">
                  {r.known_dishes.map((d) => (
                    <span
                      key={d.id}
                      className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-700"
                    >
                      {d.name} · {ds.config.currency} {d.price.toFixed(2)}
                    </span>
                  ))}
                </div>

                <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                  <p className="text-sm text-stone-600">
                    Every reward you earn here is worth {r.support_multiplier ?? 2}&times; as
                    much, and it lands in your wallet the same way — yours to spend, not a
                    points balance they control.
                  </p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-xs text-stone-400">
        This pool is curated by hand, not ranked by an algorithm. A restaurant joins when its
        footfall drops, and leaves when it recovers.
      </p>

      {others.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Also near you
          </h2>
          <ul className="space-y-2">
            {others.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-stone-900">{r.name}</p>
                  <p className="text-sm text-stone-500">{r.tagline}</p>
                </div>
                <span className="text-xs text-stone-400">1&times;</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/"
        className="mt-8 block text-center text-sm text-stone-500 underline underline-offset-4"
      >
        Back to the restaurant view
      </Link>
    </main>
  );
}
