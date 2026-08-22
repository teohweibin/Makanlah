import Link from 'next/link';

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-10 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-[var(--color-ink)]">
          MakanLagi
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[var(--color-muted)]">
          Helping restaurants keep the customers they&rsquo;ve already earned.
        </p>
      </div>

      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="group block overflow-hidden rounded-2xl border border-[var(--color-ink)]/10 bg-white p-5 shadow-sm transition hover:border-[var(--color-accent)]/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)]">
                I&rsquo;m a Restaurant Owner
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                See who&rsquo;s slipping away, and why
              </p>
            </div>
            <span className="text-3xl transition group-hover:scale-110" aria-hidden>
              🍳
            </span>
          </div>
        </Link>

        <Link
          href="/diner"
          className="group block overflow-hidden rounded-2xl border border-[var(--color-ink)]/10 bg-white p-5 shadow-sm transition hover:border-[var(--color-success)]/40 hover:shadow-md"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-success)]">
                I&rsquo;m a Diner
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                Rate your meal, collect rewards that are yours
              </p>
            </div>
            <span className="text-3xl transition group-hover:scale-110" aria-hidden>
              🍽️
            </span>
          </div>
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-[var(--color-muted)]/60">
        Demo build · mock diners, Solana devnet
      </p>
    </main>
  );
}
