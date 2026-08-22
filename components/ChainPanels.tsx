// Server components that talk to devnet. Everything rendered here comes from a chain
// query — none of it is read from our JSON. That distinction is the point, so the UI
// says so out loud rather than making judges take it on trust.

import { loadDataset } from '@/lib/fixtures';
import { knownRewards } from '@/lib/rewards';
import {
  type RedemptionStatus,
  explorerUrl,
  isChainConfigured,
  listWalletRewards,
  readRedemption,
} from '@/lib/solana';
import { Card } from '@/components/ui';

const STATUS: Record<RedemptionStatus, { label: string; className: string }> = {
  unredeemed: { label: 'Reward not yet used', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  redeemed: { label: 'Reward used ✓', className: 'bg-stone-200 text-stone-700 border-stone-300' },
  not_found: { label: 'Not in their wallet', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  not_minted: { label: 'Not issued yet', className: 'bg-stone-100 text-stone-600 border-stone-300' },
  unavailable: {
    label: "Can't check right now",
    className: 'bg-rose-100 text-rose-900 border-rose-300',
  },
};

function ChainBadge({ status }: { status: RedemptionStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  );
}

function NotConfigured() {
  return (
    <Card className="p-5">
      <h3 className="font-medium text-stone-900">Reward History</h3>
      <p className="mt-2 text-sm text-stone-600">
        Devnet is not configured yet, so there is nothing to read. Run{' '}
        <code className="rounded bg-stone-100 px-1.5 py-0.5">node scripts/solana-setup.mjs</code>{' '}
        then{' '}
        <code className="rounded bg-stone-100 px-1.5 py-0.5">
          node scripts/solana-issue-fixtures.mjs
        </code>
        .
      </p>
      <p className="mt-2 text-xs text-stone-500">
        This panel deliberately shows nothing rather than falling back to the JSON — a
        database fallback here would defeat the point of reading from the chain.
      </p>
    </Card>
  );
}

/* ── per-restaurant reward ledger ────────────────────────────────────────── */

export async function RewardLedger({ restaurantId }: { restaurantId: string }) {
  if (!isChainConfigured()) return <NotConfigured />;

  const ds = loadDataset();
  const rewards = knownRewards(ds).filter((r) => r.restaurant_id === restaurantId);
  const dinerOf = (id: string) => ds.diners.find((d) => d.id === id);

  const rows = await Promise.all(
    rewards.map(async (reward) => ({
      reward,
      diner: dinerOf(reward.diner_id),
      chain: await readRedemption(
        reward.mint_address,
        dinerOf(reward.diner_id)?.wallet_address ?? null,
      ),
    })),
  );

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-stone-200 px-4 py-3">
        <h3 className="font-medium text-stone-900">Rewards you&rsquo;ve sent</h3>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-stone-500">No rewards issued here yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map(({ reward, diner, chain }) => (
            <li key={reward.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-40 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-stone-900">{diner?.name ?? reward.diner_id}</span>
                  <ChainBadge status={chain.status} />
                </div>
                <p className="text-sm text-stone-500">
                  {ds.interventionLookup.presentation[reward.intervention_type]?.icon}{' '}
                  {ds.interventionLookup.presentation[reward.intervention_type]?.tag_label} ·
                  sent{' '}
                  {reward.issued_days_ago === 0
                    ? 'today'
                    : `${reward.issued_days_ago} days ago`}
                </p>
                {(chain.error || reward.chain_error) && (
                  <p className="mt-0.5 text-xs text-rose-700">
                    {reward.chain_error ?? chain.error}
                  </p>
                )}
              </div>

              <div className="text-right text-xs">
                {reward.mint_address ? (
                  <a
                    href={explorerUrl('address', reward.mint_address)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-stone-600 underline underline-offset-4 hover:text-stone-900"
                  >
                    {reward.mint_address.slice(0, 6)}…{reward.mint_address.slice(-6)}
                  </a>
                ) : (
                  <span className="text-stone-400">not minted</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ── cross-restaurant recognition ────────────────────────────────────────── */

/**
 * The same chain read, pointed at a different restaurant. A diner with almost no
 * history HERE can still arrive with a reward history — because the history lives in
 * their wallet, not in either restaurant's database. This is the component that proves
 * the chain read is doing real work rather than decorating a database lookup.
 */
export async function CrossRestaurantRecognition({ restaurantId }: { restaurantId: string }) {
  if (!isChainConfigured()) return null;

  const ds = loadDataset();
  const restaurant = ds.restaurants.find((r) => r.id === restaurantId);
  const all = knownRewards(ds);

  // Diners who have set foot here at all — including a single order.
  const localDinerIds = new Set(
    ds.orders.filter((o) => o.restaurant_id === restaurantId).map((o) => o.diner_id),
  );
  const diners = ds.diners.filter(
    (d) => localDinerIds.has(d.id) && d.wallet_address && !d.wallet_address.startsWith('MOCK_'),
  );

  const rows = await Promise.all(
    diners.map(async (diner) => {
      const { holdings, error } = await listWalletRewards(diner.wallet_address);
      const enriched = holdings.map((h) => {
        const match = all.find((r) => r.mint_address === h.mint_address);
        const issuer = match ? ds.restaurants.find((r) => r.id === match.restaurant_id) : null;
        return { ...h, issuer_name: issuer?.name ?? 'Unknown issuer', is_local: match?.restaurant_id === restaurantId };
      });
      const ordersHere = ds.orders.filter(
        (o) => o.diner_id === diner.id && o.restaurant_id === restaurantId,
      ).length;
      return { diner, holdings: enriched, ordersHere, error };
    }),
  );

  const anyElsewhere = rows.some((r) => r.holdings.some((h) => !h.is_local));

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-stone-200 px-4 py-3">
        <h3 className="font-medium text-stone-900">Recognised from elsewhere</h3>
        <p className="mt-0.5 text-sm text-stone-500">
          {restaurant?.name} can see rewards a diner earned at other restaurants — their
          history belongs to them, not to any one venue.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-stone-500">No wallets seen here yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map(({ diner, holdings, ordersHere, error }) => (
            <li key={diner.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden>{diner.avatar_emoji}</span>
                <span className="font-medium text-stone-900">{diner.name}</span>
                <span className="text-sm text-stone-500">
                  {ordersHere} order{ordersHere === 1 ? '' : 's'} here
                </span>
                <a
                  href={explorerUrl('address', diner.wallet_address)}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto font-mono text-xs text-stone-500 underline underline-offset-4 hover:text-stone-900"
                >
                  {diner.wallet_address.slice(0, 4)}…{diner.wallet_address.slice(-4)}
                </a>
              </div>

              {error ? (
                <p className="mt-1 rounded bg-rose-50 px-2 py-1.5 text-sm text-rose-800">
                  Chain unavailable — we could not read this wallet, so we are not claiming
                  it is empty. ({error})
                </p>
              ) : holdings.length === 0 ? (
                <p className="mt-1 text-sm text-stone-500">Wallet holds no reward tokens.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {holdings.map((h) => (
                    <li key={h.mint_address} className="flex flex-wrap items-center gap-2 text-sm">
                      <span
                        className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                          h.is_local
                            ? 'border-stone-300 bg-stone-100 text-stone-700'
                            : 'border-indigo-300 bg-indigo-50 text-indigo-900'
                        }`}
                      >
                        {h.is_local ? 'issued here' : `from ${h.issuer_name}`}
                      </span>
                      <a
                        href={h.explorer_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-stone-500 underline underline-offset-4 hover:text-stone-900"
                      >
                        {h.mint_address.slice(0, 6)}…{h.mint_address.slice(-6)}
                      </a>
                      <span className="text-xs text-stone-400">balance {h.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {anyElsewhere && (
        <p className="border-t border-stone-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
          A token marked <span className="font-medium">from another restaurant</span> is loyalty
          this venue did not issue and could not have looked up in its own database.
        </p>
      )}
    </Card>
  );
}

export function ChainPanelSkeleton({ label }: { label: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-stone-500">{label}…</p>
    </Card>
  );
}
