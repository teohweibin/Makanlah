import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GuidedReview } from '@/components/GuidedReview';
import { loadDataset } from '@/lib/fixtures';

export default async function ReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const ds = loadDataset();
  const order = ds.orders.find((o) => o.id === orderId);
  if (!order) notFound();

  const restaurant = ds.restaurants.find((r) => r.id === order.restaurant_id);
  if (!restaurant) notFound();

  const dishes = order.dish_ids
    .map((id) => restaurant.known_dishes.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => !!d);

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <Link
        href={`/diner/${order.diner_id}`}
        className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
      >
        &larr; Back
      </Link>

      <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Your order</p>
        <p className="mt-1 font-medium text-stone-900">{restaurant.name}</p>
        <p className="text-sm text-stone-500">
          {dishes.map((d) => d.name).join(', ')} · {ds.config.currency} {order.amount.toFixed(2)}
        </p>
      </div>

      <div className="mt-6">
        <GuidedReview
          orderId={order.id}
          restaurantName={restaurant.name}
          dishes={dishes}
          redirectTo={`/order/${order.id}/reward`}
        />
      </div>
    </main>
  );
}
