'use client';

// Today's Action — the one thing worth doing, decided for the owner.
//
// The dashboard already knows which group is most worth reaching. Making the owner
// derive that from four cards and three percentages is the failure this section fixes:
// they should be approving a decision, not performing an analysis.

import { useState } from 'react';

export interface ActionGroup {
  key: 'told_us' | 'browsing' | 'been_a_while';
  diner_names: string[];
  spread: Array<{ icon: string; label: string; n: number }>;
}

export function TodaysAction({ group }: { group: ActionGroup | null }) {
  const [sent, setSent] = useState(false);

  if (!group) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-lg font-medium text-stone-900">Nothing needs you right now</p>
        <p className="mt-1 text-stone-600">
          No one&rsquo;s slipping away today. We&rsquo;ll tell you the moment that changes.
        </p>
      </div>
    );
  }

  const n = group.diner_names.length;
  const people = n === 1 ? 'regular' : 'regulars';
  const names = group.diner_names.join(', ');

  const COPY = {
    told_us: {
      line: `${n} ${people} haven't been back in a while — and they told you why.`,
      sub: 'You already know what went wrong for each of them. We have already written each message.',
      cta: n === 1 ? 'Send their message' : 'Send their messages',
    },
    browsing: {
      line: `${n} ${people} keep opening the app without ordering.`,
      sub: 'Something is holding them back. A small nudge usually does it.',
      cta: 'Send a gentle nudge',
    },
    been_a_while: {
      line: `${n} ${people} have been away a long time, with no reason on file.`,
      sub: 'No guessing, no pressure — just an invitation to come back.',
      cta: 'Send an invitation',
    },
  }[group.key];

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-lg font-medium text-emerald-950">
          ✓ On their way to {n} {people}
        </p>
        <p className="mt-1 text-emerald-900">{names}</p>
        <p className="mt-3 text-sm text-emerald-800">
          Each got the message that fits their reason — not the same note to everyone.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-3 text-sm font-medium text-emerald-900 underline underline-offset-4"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 shadow-sm">
      <p className="text-xl font-medium leading-snug text-stone-900">{COPY.line}</p>
      <p className="mt-2 text-stone-600">{COPY.sub}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {group.diner_names.map((name) => (
          <span
            key={name}
            className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-sm text-stone-700"
          >
            {name}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSent(true)}
        className="mt-5 w-full rounded-xl bg-stone-900 px-5 py-4 text-lg font-medium text-white transition hover:bg-stone-700 sm:w-auto"
      >
        {COPY.cta}
      </button>

      {group.spread.length > 1 && (
        <p className="mt-3 text-sm text-stone-500">
          They won&rsquo;t all get the same message:{' '}
          {group.spread.map((s, i) => (
            <span key={s.label}>
              {i > 0 && ', '}
              {s.icon} {s.n} &times; {s.label}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
