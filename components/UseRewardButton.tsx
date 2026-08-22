'use client';

// "Use Reward" — issues a one-time code the diner shows at the counter.
//
// Nothing is burned here. The token stays in the diner's wallet until the restaurant
// enters the code, so a diner who taps this by accident, or whose meal ends before the
// staff get to them, has lost nothing.

import { useEffect, useState } from 'react';
import { issueRedemptionCode } from '@/app/actions';

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function UseRewardButton({
  dinerId,
  mintAddress,
  label,
}: {
  dinerId: string;
  mintAddress: string;
  label: string;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemaining(expiresAt - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const expired = expiresAt !== null && remaining <= 0;

  if (code && !expired) {
    return (
      <div className="mt-3 rounded-xl border border-[var(--color-verified)]/40 bg-[var(--color-soft-green)] p-4 text-center">
        <p className="text-sm text-stone-700">Show this to the restaurant:</p>
        <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.2em] text-[var(--color-ink)]">
          {code.slice(0, 3)} {code.slice(3)}
        </p>
        <p className="mt-2 text-sm text-stone-600">
          This code expires in {formatRemaining(remaining)}
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Your reward isn&rsquo;t used until the restaurant enters this code.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await issueRedemptionCode({
              diner_id: dinerId,
              mint_address: mintAddress,
            });
            if (res.ok) {
              setCode(res.code);
              setExpiresAt(res.expires_at);
            } else {
              setError(
                res.reason === 'not_available'
                  ? 'This reward is no longer available to use.'
                  : 'Could not start that just now.',
              );
            }
          } catch {
            setError('Could not start that just now — try again.');
          } finally {
            setBusy(false);
          }
        }}
        className="w-full rounded-lg bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? 'Getting your code…' : expired ? 'Get a new code' : `Use ${label}`}
      </button>
      {expired && (
        <p className="mt-2 text-center text-xs text-stone-500">
          That code expired. Tap again for a fresh one.
        </p>
      )}
      {error && <p className="mt-2 text-center text-sm text-rose-700">{error}</p>}
    </div>
  );
}
