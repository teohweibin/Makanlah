'use client';

// "Redeem a reward" — the counter side of the handoff.
//
// Entering the code burns the SPL token on devnet. That burn is the redemption: there
// is no database flag to flip, and no way for the restaurant to mark a reward used
// without the chain agreeing.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { redeemWithCode } from '@/app/actions';
import { explorerUrl } from '@/lib/solana-links';

type Done = {
  diner_name: string;
  reward_label: string;
  issuer_name: string;
  signature: string;
};

export function RedeemPanel({ restaurantName }: { restaurantName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await redeemWithCode({ code: code.trim() });
      if (res.ok) {
        setDone(res);
        setCode('');
        router.refresh();
      } else {
        setError(res.reason);
      }
    } catch {
      setError('Something went wrong reaching the chain. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--color-verified)]/40 bg-[var(--color-soft-green)] p-5">
        <p className="text-lg font-medium text-[var(--color-verified)]">
          ✅ Reward redeemed — {done.diner_name}&rsquo;s {done.reward_label} has been used
        </p>
        <p className="mt-1 text-sm text-stone-600">
          Issued by {done.issuer_name}. The token is burned — it cannot be used again,
          here or anywhere else.
        </p>
        <a
          href={explorerUrl('tx', done.signature)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-mono text-xs text-stone-600 underline underline-offset-4"
        >
          View the burn on Solana Explorer
        </a>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setOpen(true);
            }}
            className="text-sm font-medium text-[var(--color-verified)] underline underline-offset-4"
          >
            Redeem another
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-[var(--color-ink)]/15 bg-[var(--color-paper)] px-5 py-4 text-left transition hover:border-[var(--color-ink)]/30"
      >
        <span className="text-lg font-medium text-[var(--color-ink)]">Redeem a reward</span>
        <span className="mt-0.5 block text-sm text-stone-600">
          A diner at the counter has a 6-digit code
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-ink)]/15 bg-[var(--color-paper)] p-5">
      <label htmlFor="redeem-code" className="block font-medium text-[var(--color-ink)]">
        Enter the 6-digit code from the diner
      </label>
      <p className="mt-0.5 text-sm text-stone-600">
        {restaurantName} · the reward is used the moment you confirm.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          id="redeem-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && code.trim().length === 6 && !busy) void submit();
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder="482931"
          className="w-40 rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-mono text-2xl tracking-[0.15em] text-stone-900 placeholder:text-stone-300 focus:border-stone-500 focus:outline-none"
        />
        <button
          type="button"
          disabled={busy || code.trim().length !== 6}
          onClick={() => void submit()}
          className="rounded-lg bg-[var(--color-ink)] px-5 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Burning token…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-2 py-2.5 text-sm text-stone-500 underline underline-offset-4"
        >
          Cancel
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      <p className="mt-3 text-xs text-stone-500">
        Confirming burns the token on Solana devnet. That burn is the record — nothing
        here writes a &ldquo;used&rdquo; flag to our own database.
      </p>
    </div>
  );
}
