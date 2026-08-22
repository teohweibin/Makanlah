// "My Rewards", diner-facing.
//
// Same source of truth as the restaurant dashboard: the chain. The wallet is queried
// directly and the token balance decides redeemed vs not — our JSON only supplies the
// human label for which restaurant issued which mint.

import { loadDataset } from '@/lib/fixtures';
import { knownRewards } from '@/lib/rewards';
import { explorerUrl, isChainConfigured, listWalletRewards } from '@/lib/solana';
import { Card } from '@/components/ui';

export async function DinerRewards({ dinerId }: { dinerId: string }) {
  const ds = loadDataset();
  const diner = ds.diners.find((d) => d.id === dinerId);
  if (!diner) return null;

  if (!isChainConfigured() || diner.wallet_address.startsWith('MOCK_')) {
    return (
      <Card className="p-5">
        <p className="text-sm text-stone-600">
          Your wallet isn&rsquo;t connected to devnet yet, so there is nothing to read.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Rewards are never read from our database — if the chain can&rsquo;t be reached we
          show nothing rather than a number we made up.
        </p>
      </Card>
    );
  }

  const { holdings, error } = await listWalletRewards(diner.wallet_address);
  const known = knownRewards(ds);

  const rows = holdings.map((h) => {
    const match = known.find((r) => r.mint_address === h.mint_address);
    const issuer = match ? ds.restaurants.find((r) => r.id === match.restaurant_id) : null;
    const presentation = match
      ? ds.interventionLookup.presentation[match.intervention_type]
      : null;
    return {
      ...h,
      issuer_name: issuer?.name ?? 'Another restaurant',
      icon: presentation?.icon ?? '🎁',
      label: presentation?.tag_label ?? 'Reward',
      redeemed: h.amount === 0,
    };
  });

  const available = rows.filter((r) => !r.redeemed);
  const used = rows.filter((r) => r.redeemed);

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Your wallet
            </p>
            <a
              href={explorerUrl('address', diner.wallet_address)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm text-stone-700 underline underline-offset-4"
            >
              {diner.wallet_address.slice(0, 6)}…{diner.wallet_address.slice(-6)}
            </a>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-stone-900">{available.length}</p>
            <p className="text-xs text-stone-500">ready to use</p>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-900">
            Couldn&rsquo;t reach the chain just now, so we can&rsquo;t show your rewards. They
            are safe — they live in your wallet, not in this app. ({error})
          </p>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-stone-600">No reward tokens yet.</p>
          <p className="mt-1 text-sm text-stone-500">
            Leave a review after your next meal and one lands here.
          </p>
        </Card>
      ) : (
        <>
          {available.map((r) => (
            <Card key={r.mint_address} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="text-xl" aria-hidden>
                    {r.icon}
                  </span>
                  <div>
                    <p className="font-medium text-stone-900">{r.label}</p>
                    <p className="text-sm text-stone-500">from {r.issuer_name}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
                  Ready
                </span>
              </div>
              <a
                href={r.explorer_url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block font-mono text-xs text-stone-500 underline underline-offset-4 hover:text-stone-800"
              >
                {r.mint_address.slice(0, 8)}…{r.mint_address.slice(-8)}
              </a>
            </Card>
          ))}

          {used.length > 0 && (
            <Card className="overflow-hidden">
              <p className="border-b border-stone-100 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-stone-400">
                Already used ({used.length})
              </p>
              <ul className="divide-y divide-stone-100">
                {used.map((r) => (
                  <li
                    key={r.mint_address}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm"
                  >
                    <span className="opacity-40" aria-hidden>
                      {r.icon}
                    </span>
                    <span className="text-stone-500">
                      {r.label} · {r.issuer_name}
                    </span>
                    <a
                      href={r.explorer_url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto shrink-0 text-xs text-stone-400 underline underline-offset-4"
                    >
                      redeemed
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <p className="text-xs text-stone-400">
        Read live from Solana devnet by wallet address. These rewards travel with you
        between restaurants — no single venue can edit or revoke them.
      </p>
    </div>
  );
}
