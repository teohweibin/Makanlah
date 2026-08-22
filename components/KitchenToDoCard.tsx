'use client';

// Kitchen To-Do Card — grouped by DISH, not by person.
//
// Shows: all complaints about one dish, the recommendation engine's fix,
// and a single "Mark Fixed" button that invites ALL affected diners back.

import { useState } from 'react';
import { markIssueFixed } from '@/app/actions';

export interface DishIssueGroup {
  dishId: string;
  dishName: string;
  restaurantId: string;
  /** All diners who complained about this dish. */
  complaints: Array<{
    dinerId: string;
    dinerName: string;
    dinerEmoji: string;
    quote: string;
    tags: string[];
  }>;
  /** Combined recommendation from the engine. */
  recommendation: {
    title: string;
    action: string;
    rootCause: string;
    priority: 'quick' | 'medium' | 'urgent';
  };
  /** Whether the owner has already marked this fixed. */
  isResolved: boolean;
}

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  quick: { label: 'Quick fix', className: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  medium: { label: 'Medium effort', className: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]' },
  urgent: { label: 'Urgent', className: 'bg-[var(--color-danger-light)] text-[var(--color-danger)]' },
};

export function KitchenToDoCard({ group }: { group: DishIssueGroup }) {
  const [state, setState] = useState<'pending' | 'sending' | 'done'>(
    group.isResolved ? 'done' : 'pending',
  );
  const [showToast, setShowToast] = useState(false);

  const priority = PRIORITY_BADGE[group.recommendation.priority] ?? PRIORITY_BADGE.medium;
  const dinerNames = group.complaints.map((c) => c.dinerName);

  async function handleMarkFixed() {
    setState('sending');
    try {
      await markIssueFixed({
        restaurant_id: group.restaurantId,
        dish_id: group.dishId,
      });
      setState('done');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 6000);
    } catch {
      setState('pending');
    }
  }

  // ── Success toast overlay ───────────────────────────────────────────
  const toast = showToast && (
    <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4 animate-slide-up"
      style={{ animation: 'slide-up 0.3s ease-out, fade-out 1s ease-in 5s forwards' }}
    >
      <div className="rounded-xl border border-[var(--color-success)]/30 bg-white px-5 py-4 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-success-light)] text-lg text-[var(--color-success)]">
            {'\u2713'}
          </span>
          <div>
            <p className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-ink)]">
              Invitation sent!
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              {dinerNames.join(', ')} {dinerNames.length > 1 ? 'will' : 'will'} see that you listened and improved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (state === 'done' && !showToast) {
    return (
      <div className="animate-slide-up rounded-xl border border-[var(--color-success)]/20 bg-[var(--color-success-light)] p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg text-[var(--color-success)]">{'\u2713'}</span>
          <p className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-success)]">
            {group.dishName} — Fixed!
          </p>
        </div>
        <p className="mt-1 text-sm text-[var(--color-success)]/80">
          {dinerNames.join(', ')} {dinerNames.length > 1 ? 'have' : 'has'} been notified. They know you care.
        </p>
      </div>
    );
  }

  return (
    <>
      {toast}
      <div className="animate-slide-up overflow-hidden rounded-xl border border-[var(--color-ink)]/8 bg-white shadow-sm">
      {/* Header: dish name + priority badge */}
      <div className="flex items-center justify-between border-b border-[var(--color-ink)]/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={false}
            onChange={handleMarkFixed}
            disabled={state === 'sending'}
            className="h-5 w-5 rounded border-[var(--color-ink)]/20 accent-[var(--color-success)]"
            aria-label={`Mark ${group.dishName} as fixed`}
          />
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
            {group.recommendation.title}
          </h3>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ${priority.className}`}>
          {priority.label}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Customer quotes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">
            Customers said ({group.complaints.length}):
          </p>
          <div className="space-y-1.5">
            {group.complaints.slice(0, 4).map((c) => (
              <div key={c.dinerId} className="flex items-start gap-2">
                <span className="shrink-0 text-sm">{c.dinerEmoji}</span>
                <p className="text-sm italic text-[var(--color-ink)]/80">
                  &ldquo;{c.quote}&rdquo;
                  <span className="ml-1 not-italic text-xs text-[var(--color-muted)]">— {c.dinerName}</span>
                </p>
              </div>
            ))}
            {group.complaints.length > 4 && (
              <p className="text-xs text-[var(--color-muted)]">
                +{group.complaints.length - 4} more
              </p>
            )}
          </div>
        </div>

        {/* Expert recommendation box */}
        <div className="rounded-lg bg-[var(--color-warning-light)] p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-warning)]">
            {'\uD83D\uDCA1'} Expert Recommendation
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--color-ink)] leading-relaxed">
            {group.recommendation.action
              .split(/(?:\d+\)\s*|\d+\.\s*)/)
              .filter((s) => s.trim())
              .map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-[var(--color-warning)]">{i + 1}.</span>
                  <span>{step.trim()}</span>
                </li>
              ))}
          </ul>
        </div>

        {/* Root cause */}
        <p className="text-xs text-[var(--color-muted)]">
          <span className="font-medium">Root cause:</span> {group.recommendation.rootCause}
        </p>
      </div>

      {/* CTA footer */}
      <div className="border-t border-[var(--color-ink)]/5 bg-[var(--color-paper)]/50 px-4 py-3">
        <button
          type="button"
          onClick={handleMarkFixed}
          disabled={state === 'sending'}
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60"
        >
          {state === 'sending'
            ? 'Notifying diners...'
            : `Mark Fixed & Notify ${dinerNames.join(', ')}`}
        </button>
        <p className="mt-2 text-center text-xs text-[var(--color-muted)]">
          They{'\u2019'}ll see you listened and made the effort to improve.
        </p>
      </div>
    </div>
    </>
  );
}
