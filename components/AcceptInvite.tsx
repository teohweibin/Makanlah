'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { acceptWinBack } from '@/app/actions';

export function AcceptInvite({
  dinerId,
  restaurantId,
  label,
}: {
  dinerId: string;
  restaurantId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await acceptWinBack({ diner_id: dinerId, restaurant_id: restaurantId });
            router.refresh();
          } catch {
            setError('Could not claim that just now — try again.');
            setBusy(false);
          }
        }}
        className="w-full rounded-xl bg-stone-900 px-4 py-3.5 font-medium text-white transition hover:bg-stone-700 disabled:opacity-60"
      >
        {busy ? 'One moment…' : label}
      </button>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
