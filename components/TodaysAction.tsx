'use client';

// Today's Action — the one thing worth doing, decided for the owner.
//
// The dashboard already knows which group is most worth reaching. Making the owner
// derive that from four cards and three percentages is the failure this section fixes:
// they should be approving a decision, not performing an analysis.

import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap-config';

export interface ActionGroup {
  key: 'told_us' | 'browsing' | 'been_a_while';
  diner_names: string[];
  spread: Array<{ icon: string; label: string; n: number }>;
}

export function TodaysAction({ group }: { group: ActionGroup | null }) {
  const [sent, setSent] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cardRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { y: 12, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' },
      );
    }, cardRef);

    return () => ctx.revert();
  }, []);

  if (!group) {
    return (
      <div ref={cardRef} className="rounded-2xl border border-stone-200 bg-white p-6">
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
      accent: 'border-[var(--color-verified)]/20 bg-[linear-gradient(180deg,var(--color-soft-green),#fff)]',
      success: 'border-[var(--color-verified)]/20 bg-[var(--color-soft-green)] text-[var(--color-verified)]',
      button: 'bg-[var(--color-verified)] hover:bg-[var(--color-verified)]/90',
    },
    browsing: {
      line: `${n} ${people} keep opening the app without ordering.`,
      sub: 'Something is holding them back. A small nudge usually does it.',
      cta: 'Send a gentle nudge',
      accent: 'border-[var(--color-silent)]/20 bg-[linear-gradient(180deg,var(--color-soft-violet),#fff)]',
      success: 'border-[var(--color-silent)]/20 bg-[var(--color-soft-violet)] text-[var(--color-silent)]',
      button: 'bg-[var(--color-silent)] hover:bg-[var(--color-silent)]/90',
    },
    been_a_while: {
      line: `${n} ${people} have been away a long time, with no reason on file.`,
      sub: 'No guessing, no pressure — just an invitation to come back.',
      cta: 'Send an invitation',
      accent: 'border-[var(--color-inferred)]/20 bg-[linear-gradient(180deg,var(--color-soft-mustard),#fff)]',
      success: 'border-[var(--color-inferred)]/20 bg-[var(--color-soft-mustard)] text-[var(--color-inferred)]',
      button: 'bg-[var(--color-inferred)] hover:bg-[var(--color-inferred)]/90',
    },
  }[group.key];

  if (sent) {
    return (
      <div ref={cardRef} className={`rounded-2xl border p-6 ${COPY.success}`}>
        <p className="text-lg font-medium">
          ✓ On their way to {n} {people}
        </p>
        <p className="mt-1">{names}</p>
        <p className="mt-3 text-sm opacity-90">
          Each got the message that fits their reason — not the same note to everyone.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-3 text-sm font-medium underline underline-offset-4"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div ref={cardRef} className={`rounded-2xl border p-6 shadow-sm ${COPY.accent}`}>
      <p className="text-xl font-medium leading-snug text-[var(--color-ink)]">{COPY.line}</p>
      <p className="mt-2 text-stone-700">{COPY.sub}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {group.diner_names.map((name) => (
          <span
            key={name}
            className="rounded-full border border-[var(--color-ink)]/15 bg-[var(--color-paper)] px-2.5 py-1 text-sm text-[var(--color-ink)]"
          >
            {name}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSent(true)}
        className={`mt-5 w-full rounded-xl px-5 py-4 text-lg font-medium text-white transition sm:w-auto ${COPY.button}`}
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
