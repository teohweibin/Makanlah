// Full wallet page — the diner's on-chain identity in one place.
//
// Shows: accepted invitation rewards (with full details, QR, expiry),
// on-chain token holdings, and transaction history.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { WalletTokenCard } from '@/components/WalletTokenCard';
import { loadDataset } from '@/lib/fixtures';
import { knownRewards } from '@/lib/rewards';
import {
  explorerUrl,
  getWalletTransactions,
  isChainConfigured,
  listWalletRewards,
} from '@/lib/solana';
import { getAcceptedInvitations } from '@/lib/store';
import { Card } from '@/components/ui';

export default async function WalletPage({
  params,
}: {
  params: Promise<{ dinerId: string }>;
}) {
  const { dinerId } = await params;
  const ds = loadDataset();
  const diner = ds.diners.find((d) => d.id === dinerId);
  if (!diner) notFound();

  const configured = isChainConfigured();
  const hasMockWallet = !diner.wallet_address || diner.wallet_address.startsWith('MOCK_');
  const acceptedInvitations = getAcceptedInvitations(dinerId);

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <header className="mb-6">
        <Link
          href={`/diner?as=${dinerId}`}
          className="text-sm text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-ink)]"
        >
          &larr; Back to MakanLagi
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {diner.avatar_emoji}
          </span>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
              My Wallet
            </h1>
            <p className="text-sm text-[var(--color-muted)]">
              {diner.name.replace(' (demo profile)', '')}
            </p>
          </div>
        </div>
      </header>

      {!configured || hasMockWallet ? (
        <Card className="p-6 text-center">
          <p className="text-[var(--color-ink)]">Your wallet isn&rsquo;t connected to devnet yet.</p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Run <code className="rounded bg-[var(--color-paper)] px-1.5 py-0.5">node scripts/solana-setup.mjs</code>{' '}
            to set up devnet wallets.
          </p>
        </Card>
      ) : (
        <>
          {/* wallet address card */}
          <Card className="mb-5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Solana Devnet Address
                </p>
                <a
                  href={explorerUrl('address', diner.wallet_address)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all font-mono text-sm text-[var(--color-ink)] underline underline-offset-4 hover:text-[var(--color-accent)]"
                >
                  {diner.wallet_address.slice(0, 8)}…{diner.wallet_address.slice(-8)}
                </a>
              </div>
              <div className="text-right">
                <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
                  {acceptedInvitations.length}
                </p>
                <p className="text-xs text-[var(--color-muted)]">rewards</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              This address is yours. Rewards live here, not in any restaurant&rsquo;s database.
            </p>
          </Card>

          {/* ── Accepted rewards (enhanced cards) ─────────────────────────── */}
          {acceptedInvitations.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Your Rewards
              </h2>
              <div className="space-y-4">
                {acceptedInvitations.map((inv) => (
                  <WalletTokenCard key={inv.id} invitation={inv} />
                ))}
              </div>
            </section>
          )}

          {/* ── On-chain token holdings ───────────────────────────────────── */}
          <Suspense fallback={<LoadingSkeleton label="Reading tokens from chain…" />}>
            <ChainHoldings dinerId={dinerId} wallet={diner.wallet_address} />
          </Suspense>

          {/* ── Transaction history ───────────────────────────────────────── */}
          <Suspense fallback={<LoadingSkeleton label="Fetching transactions…" />}>
            <TransactionHistory wallet={diner.wallet_address} />
          </Suspense>
        </>
      )}
    </main>
  );
}

/* ── On-chain holdings (legacy tokens not from invitation flow) ───────────── */

async function ChainHoldings({ dinerId, wallet }: { dinerId: string; wallet: string }) {
  const ds = loadDataset();
  const { holdings, error } = await listWalletRewards(wallet);
  const known = knownRewards(ds);

  if (error) {
    return (
      <Card className="mb-5 border-[var(--color-danger-light)] bg-[var(--color-danger-light)] p-4">
        <p className="text-sm text-[var(--color-danger)]">
          Couldn&rsquo;t reach the chain — your tokens are safe. ({error})
        </p>
      </Card>
    );
  }

  if (holdings.length === 0) return null;

  const enriched = holdings.map((h) => {
    const match = known.find((r) => r.mint_address === h.mint_address);
    const issuer = match ? ds.restaurants.find((r) => r.id === match.restaurant_id) : null;
    const presentation = match
      ? ds.interventionLookup.presentation[match.intervention_type]
      : null;
    return {
      ...h,
      issuer_name: issuer?.name ?? 'Unknown restaurant',
      icon: presentation?.icon ?? '🎁',
      label: presentation?.tag_label ?? 'Reward',
      redeemed: h.amount === 0,
    };
  });

  const available = enriched.filter((r) => !r.redeemed);
  const used = enriched.filter((r) => r.redeemed);

  return (
    <section className="mb-6">
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        On-Chain Tokens ({available.length} active)
      </h2>

      {available.length > 0 && (
        <div className="space-y-2">
          {available.map((t) => (
            <Card key={t.mint_address} className="p-3">
              <div className="flex items-center gap-3">
                <span className="text-xl" aria-hidden>{t.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--color-ink)]">{t.label}</p>
                  <p className="text-xs text-[var(--color-muted)]">from {t.issuer_name}</p>
                </div>
                <a
                  href={t.explorer_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
                >
                  Solscan ↗
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {used.length > 0 && (
        <details className="mt-3 rounded-xl border border-[var(--color-ink)]/10 bg-white">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-[var(--color-muted)]">
            Used tokens ({used.length})
          </summary>
          <ul className="divide-y divide-[var(--color-ink)]/5 border-t border-[var(--color-ink)]/5">
            {used.map((t) => (
              <li key={t.mint_address} className="flex items-center gap-2 px-4 py-2 text-sm opacity-60">
                <span aria-hidden>{t.icon}</span>
                <span className="text-[var(--color-muted)]">{t.label} · {t.issuer_name}</span>
                <a href={t.explorer_url} target="_blank" rel="noreferrer" className="ml-auto text-xs underline">redeemed</a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/* ── Transaction History ──────────────────────────────────────────────────── */

async function TransactionHistory({ wallet }: { wallet: string }) {
  const { transactions, error } = await getWalletTransactions(wallet);

  return (
    <section className="mb-6">
      <h2 className="mb-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Transaction History
      </h2>

      {error ? (
        <Card className="p-4">
          <p className="text-sm text-[var(--color-danger)]">Couldn&rsquo;t fetch transactions. ({error})</p>
        </Card>
      ) : transactions.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-[var(--color-muted)]">No transactions yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-ink)]/5">
            {transactions.map((tx) => (
              <li key={tx.signature} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-paper)] text-sm text-[var(--color-muted)]">
                  ↗
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={tx.explorer_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-mono text-xs text-[var(--color-ink)] underline underline-offset-2 hover:text-[var(--color-accent)]"
                  >
                    {tx.signature.slice(0, 16)}…{tx.signature.slice(-8)}
                  </a>
                </div>
                <span className="shrink-0 text-xs text-[var(--color-muted)]">{tx.time_label}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-3 text-xs text-[var(--color-muted)]">
        Each transaction is independently verifiable on Solana Explorer.
      </p>
    </section>
  );
}

/* ── Loading skeleton ────────────────────────────────────────────────────── */

function LoadingSkeleton({ label }: { label: string }) {
  return (
    <Card className="mb-5 p-5">
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
    </Card>
  );
}
