import Link from 'next/link';

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900">Makanlah</h1>
        <p className="mx-auto mt-3 max-w-sm text-stone-600">
          Helping restaurants keep the customers they&rsquo;ve already earned.
        </p>
      </div>

      <div className="space-y-3">
        <Link
          href="/dashboard"
          className="block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-medium text-stone-900">I&rsquo;m a Restaurant Owner</p>
              <p className="mt-0.5 text-sm text-stone-500">
                See who&rsquo;s slipping away, and why
              </p>
            </div>
            <span className="text-2xl" aria-hidden>
              🍳
            </span>
          </div>
        </Link>

        <Link
          href="/diner"
          className="block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-400"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-medium text-stone-900">I&rsquo;m a Diner</p>
              <p className="mt-0.5 text-sm text-stone-500">
                Rate your meal, collect rewards that are yours
              </p>
            </div>
            <span className="text-2xl" aria-hidden>
              🍽️
            </span>
          </div>
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-stone-400">
        Demo build · mock diners, Solana devnet
      </p>
    </main>
  );
}
