import Link from 'next/link';
import { notFound } from 'next/navigation';
import { evaluateDiner, renderHeadline, selectIntervention } from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import { getAcceptedInvite, getSubmittedReview } from '@/lib/store';
import { Card } from '@/components/ui';

export default async function DinerHome({ params }: { params: Promise<{ dinerId: string }> }) {
  const { dinerId } = await params;
  const ds = loadDataset();
  const diner = ds.diners.find((d) => d.id === dinerId);
  if (!diner) notFound();

  const orders = ds.orders
    .filter((o) => o.diner_id === dinerId)
    .sort((a, b) => a.days_ago - b.days_ago);

  // An invitation exists wherever this diner is currently flagged.
  const invitations = ds.restaurants
    .map((restaurant) => {
      const flag = evaluateDiner(ds, dinerId, restaurant.id);
      const accepted = getAcceptedInvite(dinerId, restaurant.id);
      if (!flag && !accepted) return null;
      const interventionType =
        accepted?.intervention_type ??
        selectIntervention(flag!.reason_type, flag!.evidence_strength, ds.interventionLookup);
      return {
        restaurant,
        accepted,
        presentation: ds.interventionLookup.presentation[interventionType],
        headline: renderHeadline(ds, interventionType, flag?.related_dish_id ?? null),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {diner.avatar_emoji}
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">{diner.name}</h1>
          <p className="text-sm text-stone-500">Your recent meals</p>
        </div>
      </header>

      {/* Win-back invitations waiting for this diner. Opted-out diners get nothing here. */}
      {diner.notify_opt_in && invitations.length > 0 && (
        <section className="mb-6 space-y-3">
          {invitations.map(({ restaurant, presentation, headline, accepted }) => (
            <Link
              key={restaurant.id}
              href={`/diner/${dinerId}/invite/${restaurant.id}`}
              className="block rounded-xl border border-stone-300 bg-white p-4 shadow-sm transition hover:border-stone-400"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden>
                  {presentation.icon}
                </span>
                <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  From {restaurant.name}
                </span>
                {accepted && (
                  <span className="ml-auto rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    SAVED
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-medium text-stone-900">{headline}</p>
              <p className="mt-0.5 text-sm text-stone-500">
                {accepted ? 'Ready when you are →' : 'Have a look →'}
              </p>
            </Link>
          ))}
        </section>
      )}

      <ul className="space-y-3">
        {orders.map((o) => {
          const restaurant = ds.restaurants.find((r) => r.id === o.restaurant_id);
          const dishes = o.dish_ids
            .map((id) => restaurant?.known_dishes.find((d) => d.id === id)?.name)
            .filter(Boolean)
            .join(', ');
          const live = getSubmittedReview(o.id);
          const fixtureReview = ds.reviews.find((r) => r.order_id === o.id && r.days_ago > 0);
          const reviewed = !!live || !!fixtureReview;

          return (
            <li key={o.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{restaurant?.name}</p>
                    <p className="text-sm text-stone-500">{dishes}</p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {ds.config.currency} {o.amount.toFixed(2)} · {o.days_ago}d ago
                    </p>
                  </div>
                  {live ? (
                    <Link
                      href={`/order/${o.id}/reward`}
                      className="shrink-0 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
                    >
                      View reward
                    </Link>
                  ) : (
                    <Link
                      href={`/order/${o.id}/review`}
                      className="shrink-0 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
                    >
                      {reviewed ? 'Review again' : 'How was it?'}
                    </Link>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Link
        href="/discover"
        className="mt-6 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 transition hover:border-amber-300"
      >
        <div>
          <p className="font-medium text-amber-950">Discover &amp; Support</p>
          <p className="text-sm text-amber-900">
            Quiet kitchens near you — rewards count double
          </p>
        </div>
        <span className="text-amber-900">&rarr;</span>
      </Link>

      <p className="mt-6 text-xs text-stone-400">
        Demo shortcut: any past order can be reviewed, so the guided flow can be shown on
        whichever meal fits the story.
      </p>
    </main>
  );
}
