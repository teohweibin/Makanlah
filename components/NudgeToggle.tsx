'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateNudgePreference } from '@/app/actions';

/**
 * Not a cosmetic switch: turning this off removes the diner from every win-back
 * campaign group on the restaurant side, with no override available to the restaurant.
 */
export function NudgeToggle({ dinerId, initial }: { dinerId: string; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={() => {
          const next = !on;
          setOn(next);
          startTransition(async () => {
            await updateNudgePreference({ diner_id: dinerId, opt_in: next });
            router.refresh();
          });
        }}
        className="flex w-full items-center justify-between gap-4 text-left disabled:opacity-70"
      >
        <span>
          <span className="block font-medium text-stone-900">
            Receive nudges from restaurants I haven&rsquo;t visited in a while
          </span>
          <span className="mt-0.5 block text-sm text-stone-500">
            {on
              ? 'Restaurants you used to visit can send you one invitation at a time.'
              : 'Off. No restaurant can reach you here, and none can override this.'}
          </span>
        </span>
        <span
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
            on ? 'bg-emerald-600' : 'bg-stone-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              on ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
    </div>
  );
}
