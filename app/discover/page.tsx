'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { loadDataset } from '@/lib/fixtures';

const tabs = ['trending', 'near me', 'new', 'best promo'] as const;
type Tab = (typeof tabs)[number];

const localFoodPhotos: Record<string, string> = {
  rest_warung_mama: '/images/Ayam-Gepuk.webp',
  rest_kedai_pakcik: '/images/IcedMatchaLatte-1.jpg',
  'restaurant-kampung-sari': '/images/70b9d7036b8b3d0ce84256edeb6fcbb24f32a427e9bd054a5114a5fc7e2a2d10.jpeg',
  'restaurant-sedap-goreng': '/images/maxresdefault.jpg',
  'restaurant-cendol-ramli': '/images/images.jpg',
  'restaurant-bubur-hati': '/images/images.jpg',
};

const fakeRestaurants = [
  {
    id: 'restaurant-kampung-sari',
    name: 'Kampung Sari Nasi Lemak',
    tagline: 'House-made sambal with crispy ayam goreng and fluffy rice',
    distance: '0.6 km',
    price: 14.5,
    rating: 4.9,
    reviews: 382,
    dish: 'Nasi Lemak Ayam Goreng',
    promo: 'Free iced tea with every set',
    mood: 'Fragrant rice, punchy sambal, and golden-crisp chicken that tastes like a proper kampung classic.',
    badge: 'Trending',
    tab: 'trending',
    photo: localFoodPhotos['restaurant-kampung-sari'],
  },
  {
    id: 'restaurant-sedap-goreng',
    name: 'Sedap Goreng Corner',
    tagline: 'Wok-tossed comfort food for late-night cravings',
    distance: '1.1 km',
    price: 11.9,
    rating: 4.8,
    reviews: 268,
    dish: 'Mee Goreng Mamak',
    promo: '2x rewards this evening',
    mood: 'Smoky wok aroma, deep savoury noodles, and just enough chilli to hit the spot after sunset.',
    badge: 'Best promo',
    tab: 'best promo',
    photo: localFoodPhotos['restaurant-sedap-goreng'],
  },
  {
    id: 'restaurant-cendol-ramli',
    name: 'Cendol Ramli',
    tagline: 'A cool dessert stop with pandan, coconut, and gula Melaka',
    distance: '2.2 km',
    price: 8.5,
    rating: 4.7,
    reviews: 194,
    dish: 'Cendol Gula Melaka',
    promo: 'Buy 1 free 1 after 8pm',
    mood: 'Cool, creamy, and sweet with a glossy caramel finish that makes every spoonful feel like a reward.',
    badge: 'New',
    tab: 'new',
    photo: localFoodPhotos['restaurant-cendol-ramli'],
  },
  {
    id: 'restaurant-bubur-hati',
    name: 'Bubur Hati',
    tagline: 'Slow-cooked breakfast bowls for easy, comforting mornings',
    distance: '0.9 km',
    price: 9.8,
    rating: 4.6,
    reviews: 156,
    dish: 'Bubur Ayam Kampung',
    promo: 'Extra toppings included today',
    mood: 'Warm, silky, and savoury with a comforting homemade feel that is perfect before a slow day begins.',
    badge: 'Near me',
    tab: 'near me',
    photo: localFoodPhotos['restaurant-bubur-hati'],
  },
  {
    id: 'rest_warung_mama',
    name: 'Warung Mama Sari',
    tagline: 'Rich, nostalgic kampung plates with a bold homemade finish',
    distance: '0.4 km',
    price: 24.5,
    rating: 4.9,
    reviews: 509,
    dish: 'Ayam Gepuk Sambal',
    promo: '2x MakanLagi rewards tonight',
    mood: 'Crispy, fiery, and deeply satisfying—the kind of plate that makes you stay for one more scoop of rice.',
    badge: 'Trending',
    tab: 'trending',
    photo: localFoodPhotos.rest_warung_mama,
  },
  {
    id: 'rest_kedai_pakcik',
    name: 'Kedai Kopi Pak Cik Rahman',
    tagline: 'A laid-back café stop for matcha, kopi, and easy bites',
    distance: '1.4 km',
    price: 6.5,
    rating: 4.6,
    reviews: 211,
    dish: 'Iced Matcha Latte + Kaya Toast',
    promo: 'Free kopi O with every toast combo',
    mood: 'Creamy, smooth, and quietly indulgent—an easy café moment for slow mornings and quick breaks.',
    badge: 'Best promo',
    tab: 'best promo',
    photo: localFoodPhotos.rest_kedai_pakcik,
  },
];

export default function DiscoverPage() {
  const [activeTab, setActiveTab] = useState<Tab>('trending');
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});

  const filteredRestaurants = useMemo(() => {
    return fakeRestaurants.filter((restaurant) => {
      if (activeTab === 'trending') return restaurant.tab === 'trending';
      if (activeTab === 'near me') return restaurant.tab === 'near me';
      if (activeTab === 'new') return restaurant.tab === 'new';
      return restaurant.tab === 'best promo';
    });
  }, [activeTab]);

  const featured = filteredRestaurants[0] ?? fakeRestaurants[0];

  const toggleBookmark = (id: string) => {
    setBookmarks((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <header className="mb-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            href="/diner"
            className="text-sm font-medium text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-ink)]"
          >
            ← Back to your dashboard
          </Link>
          <span className="rounded-full border border-[var(--color-ink)]/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Nearby now
          </span>
        </div>

        <div className="rounded-[2rem] border border-[var(--color-ink)]/8 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(255,241,225,0.9))] p-5 shadow-[0_18px_40px_rgba(44,28,16,0.08)] md:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Craving something good?
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight text-[var(--color-ink)] md:text-5xl">
            Your next favourite makan is just a short walk away.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--color-muted)] md:text-lg">
            Discover local favourites, reward boosts, and the kind of comfort food worth the detour.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {['Open now', '2x rewards', 'Best value', 'Fresh picks'].map((label) => (
              <span
                key={label}
                className="rounded-full border border-[var(--color-ink)]/10 bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-ink)]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={[
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-[var(--color-ink)] text-white shadow-[0_10px_20px_rgba(30,24,20,0.12)]'
                    : 'border border-[var(--color-ink)]/10 bg-white text-[var(--color-muted)]',
                ].join(' ')}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-10 overflow-hidden rounded-[2rem] border border-[var(--color-ink)]/8 bg-white shadow-[0_18px_40px_rgba(44,28,16,0.06)]">
        <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
          <div className="relative min-h-[260px]">
            <img src={featured.photo} alt={featured.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[rgba(20,15,12,0.7)] via-[rgba(20,15,12,0.2)] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                  {featured.badge}
                </span>
                <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">
                  {featured.distance}
                </span>
              </div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
                {featured.name}
              </h2>
              <p className="mt-1 text-sm text-white/80">{featured.tagline}</p>
              <p className="mt-2 max-w-md text-sm text-white/85">{featured.mood}</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90">
                  {featured.promo}
                </span>
                <span className="rounded-full border border-amber-300/70 bg-amber-400/20 px-2.5 py-1 text-xs font-semibold text-amber-100">
                  2x rewards
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center bg-[var(--color-paper)] p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Today&apos;s highlight
            </p>
            <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
              {featured.dish}
            </h3>
            <p className="mt-2 text-[var(--color-muted)]">{featured.mood}</p>

            <div className="mt-5 space-y-3 rounded-2xl border border-[var(--color-ink)]/8 bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Starting from</span>
                <span className="font-semibold text-[var(--color-ink)]">MYR {featured.price.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Rating</span>
                <span className="font-semibold text-[var(--color-ink)]">★ {featured.rating} ({featured.reviews})</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">Status</span>
                <span className="font-semibold text-[var(--color-success)]">Open now</span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Link
                href={`/restaurant/${featured.id}`}
                className="flex-1 rounded-2xl bg-[var(--color-accent)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_28px_rgba(161,61,46,0.18)] transition hover:bg-[var(--color-accent-hover)]"
              >
                View deal
              </Link>
              <button
                type="button"
                onClick={() => toggleBookmark(featured.id)}
                className="flex-1 rounded-2xl border border-[var(--color-ink)]/10 bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--color-ink)]"
              >
                {bookmarks[featured.id] ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
            Best nearby picks
          </h2>
          <span className="text-sm text-[var(--color-muted)]">Sorted for today</span>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredRestaurants.map((restaurant) => (
            <article
              key={restaurant.id}
              className="overflow-hidden rounded-[1.75rem] border border-[var(--color-ink)]/8 bg-white shadow-[0_16px_35px_rgba(44,28,16,0.05)]"
            >
              <div className="relative h-52 overflow-hidden">
                <img
                  src={restaurant.photo}
                  alt={restaurant.name}
                  className="h-full w-full object-cover transition duration-500 hover:scale-105"
                />
                <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink)]">
                  {restaurant.promo}
                </div>
                <button
                  type="button"
                  onClick={() => toggleBookmark(restaurant.id)}
                  aria-label={`Bookmark ${restaurant.name}`}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/90 text-base text-[var(--color-ink)] shadow-sm"
                >
                  {bookmarks[restaurant.id] ? '♥' : '♡'}
                </button>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">
                      {restaurant.name}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{restaurant.tagline}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[var(--color-warning)]/30 bg-[var(--color-warning-light)] px-2.5 py-1 text-xs font-semibold text-[var(--color-warning)]">
                    {restaurant.badge}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-muted)]">
                  <span>{restaurant.distance}</span>
                  <span className="font-semibold text-[var(--color-ink)]">★ {restaurant.rating}</span>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-muted)]">
                  <span>{restaurant.dish}</span>
                  <span className="font-semibold text-[var(--color-ink)]">MYR {restaurant.price.toFixed(2)}</span>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{restaurant.mood}</p>

                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--color-muted)]">
                  <span>{restaurant.reviews} reviews</span>
                  <span>Open now</span>
                </div>

                <Link
                  href={`/restaurant/${restaurant.id}`}
                  className="mt-5 block rounded-2xl border border-[var(--color-ink)]/10 bg-[var(--color-paper)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-accent)]/30 hover:bg-white"
                >
                  Claim this deal
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--color-ink)]/8 bg-[var(--color-success-light)] p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-success)]">
              Local love
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
              Support the kitchens that need a little push.
            </h2>
          </div>
          <div className="rounded-full border border-[var(--color-success)]/20 bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-success)]">
            Curated for you
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {fakeRestaurants.slice(0, 3).map((place) => (
            <div key={place.id} className="rounded-2xl border border-[var(--color-ink)]/8 bg-white p-4">
              <p className="text-lg font-semibold text-[var(--color-ink)]">{place.name}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{place.tagline}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-muted)]">
                <span>{place.distance}</span>
                <span>{place.promo}</span>
              </div>
              <p className="mt-3 text-sm text-[var(--color-muted)]">{place.mood}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
