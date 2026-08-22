import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { renderHeadline } from '@/lib/engine';
import { explorerUrl } from '@/lib/solana';
import { loadDataset } from '@/lib/fixtures';
import { getSubmittedReview } from '@/lib/store';
import { InterventionTag } from '@/components/ui';

export default async function RewardPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const ds = loadDataset();
  const order = ds.orders.find((o) => o.id === orderId);
  if (!order) notFound();

  const submitted = getSubmittedReview(orderId);
  // Nothing submitted yet (or the server restarted) — send them back to leave one.
  if (!submitted) redirect(`/order/${orderId}/review`);

  const restaurant = ds.restaurants.find((r) => r.id === order.restaurant_id);
  if (!restaurant) notFound();

  const presentation = ds.interventionLookup.presentation[submitted.intervention_type];
  const relatedDishId =
    submitted.review.guided_tags.map((t) => t.split(':')[1]).find(Boolean) ?? null;
  const headline = renderHeadline(ds, submitted.intervention_type, relatedDishId ?? null);

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Thank you — that actually helps
        </h1>
        <p className="mt-1 text-stone-500">
          {restaurant.name} sees this, and so does the kitchen.
        </p>
      </div>

      {/* the reward itself */}
      <div className="mt-7 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-5 py-5 text-center">
          <div className="mb-3 flex justify-center">
            <InterventionTag
              icon={presentation.icon}
              label={presentation.tag_label}
              color={presentation.tag_color}
            />
          </div>
          <div className="text-5xl font-semibold tracking-tight text-stone-900">
            {submitted.reward_percent}%
          </div>
          <div className="mt-1 text-sm font-medium uppercase tracking-wide text-stone-500">
            off your next visit
          </div>
          <p className="mt-3 text-stone-800">{headline}</p>
          <p className="mt-1 text-sm text-stone-500">{presentation.body}</p>
        </div>

        {/* on-chain provenance — real mint lands at step 5 */}
        <div className="bg-stone-50 px-5 py-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-stone-500">Reward token</span>
            <code className="text-stone-700">{submitted.reward_token_id}</code>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="shrink-0 text-stone-500">Mint address</span>
            {submitted.mint_address ? (
              <a
                href={explorerUrl('address', submitted.mint_address)}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-xs text-stone-700 underline underline-offset-4"
              >
                {submitted.mint_address}
              </a>
            ) : (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-right text-xs font-medium text-amber-900">
                not minted
              </span>
            )}
          </div>
          {submitted.mint_signature && (
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="shrink-0 text-stone-500">Transaction</span>
              <a
                href={explorerUrl('tx', submitted.mint_signature)}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-xs text-stone-700 underline underline-offset-4"
              >
                View on Solana Explorer
              </a>
            </div>
          )}
          {submitted.chain_error && (
            <p className="mt-2 rounded bg-rose-50 px-2 py-1.5 text-xs text-rose-800">
              Reward recorded, but the devnet mint failed: {submitted.chain_error}
            </p>
          )}
          <p className="mt-3 text-xs text-stone-500">
            This reward is yours, not a row in a restaurant&rsquo;s database — it travels with
            your wallet between restaurants.
          </p>
        </div>
      </div>

      {/* what we recorded, shown plainly */}
      <div className="mt-5 rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
          What we recorded
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {submitted.review.guided_tags.map((raw) => {
            const [tagId, dishId] = raw.split(':');
            const tag = ds.guidedReviewTags.find((t) => t.id === tagId);
            const dish = dishId ? restaurant.known_dishes.find((d) => d.id === dishId) : null;
            return (
              <span key={raw} className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-700">
                {tag?.label ?? tagId}
                {dish ? ` · ${dish.name}` : ''}
              </span>
            );
          })}
        </div>
        {submitted.review.free_text && (
          <p className="mt-2 text-stone-600 italic">
            &ldquo;{submitted.review.free_text}&rdquo;
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <Link
          href={`/diner/${order.diner_id}`}
          className="rounded-xl bg-stone-900 px-4 py-3.5 text-center font-medium text-white transition hover:bg-stone-700"
        >
          Done
        </Link>
        <Link
          href={`/restaurant/${order.restaurant_id}/diner/${order.diner_id}`}
          className="px-4 py-2 text-center text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
        >
          Demo: see how this looks on the restaurant dashboard &rarr;
        </Link>
      </div>
    </main>
  );
}
