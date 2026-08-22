'use client';

// One-tap campaign trigger.
//
// Scope note (PRD, Day-1 "build light"): this shows a confirmation state. No notification
// is actually delivered, and the UI says so rather than implying a send that never
// happened — the invitations themselves are already real and live on each diner's screen.

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap-config';

export interface CampaignTarget {
  diner_id: string;
  name: string;
  avatar_emoji: string;
  evidence_strength: 'verified_with_photo' | 'strong' | 'weak' | 'none';
  status: string;
  intervention_type: string;
  icon: string;
  tag_label: string;
  notify_opt_in: boolean;
}

type FilterId = 'all' | 'verified' | 'silent' | 'no_signal';

const FILTERS: Array<{ id: FilterId; label: string; match: (t: CampaignTarget) => boolean }> = [
  { id: 'all', label: 'Everyone flagged', match: () => true },
  {
    id: 'verified',
    label: 'They told us why',
    // Photo-verified diners are told-us-why too, only more certainly.
    match: (t) =>
      t.evidence_strength === 'strong' || t.evidence_strength === 'verified_with_photo',
  },
  { id: 'silent', label: 'Browsing but not ordering', match: (t) => t.status === 'silent_churn' },
  { id: 'no_signal', label: 'Just been a while', match: (t) => t.evidence_strength === 'none' },
];

export function CampaignTrigger({ targets }: { targets: CampaignTarget[] }) {
  const [filter, setFilter] = useState<FilterId>('verified');
  const [sentTo, setSentTo] = useState<CampaignTarget[] | null>(null);
  const groupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!groupRef.current) return;

    const nodes = groupRef.current.querySelectorAll('[data-animate-on-mount]');
    if (!nodes.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        nodes,
        { y: 12, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out', stagger: 0.08 },
      );
    }, groupRef);

    return () => ctx.revert();
  }, []);

  // Opting out is not a UI preference to be overridden by a bulk action. Diners who
  // turned nudges off are removed from every group before any filter is applied.
  const reachable = useMemo(() => targets.filter((t) => t.notify_opt_in), [targets]);
  const optedOut = targets.length - reachable.length;

  const selected = useMemo(
    () => reachable.filter(FILTERS.find((f) => f.id === filter)!.match),
    [reachable, filter],
  );

  // Each diner gets the intervention their own evidence earned — one tap, but not one
  // identical blast. That distinction is the whole product, so the UI shows the spread.
  const spread = useMemo(() => {
    const counts = new Map<string, { icon: string; label: string; n: number }>();
    for (const t of selected) {
      const cur = counts.get(t.intervention_type);
      if (cur) cur.n += 1;
      else counts.set(t.intervention_type, { icon: t.icon, label: t.tag_label, n: 1 });
    }
    return [...counts.values()];
  }, [selected]);

  const filterStyles: Record<FilterId, string> = {
    all: 'border-[var(--color-ink)]/20 bg-[var(--color-paper)] text-[var(--color-ink)]',
    verified: 'border-[var(--color-verified)] bg-[var(--color-verified)] text-white',
    silent: 'border-[var(--color-silent)] bg-[var(--color-silent)] text-white',
    no_signal: 'border-[var(--color-inferred)] bg-[var(--color-inferred)] text-[var(--color-ink)]',
  };

  if (sentTo) {
    return (
      <div className="rounded-xl border border-[var(--color-verified)]/20 bg-[var(--color-soft-green)] p-4">
        <p className="font-medium text-[var(--color-verified)]">
          ✓ Campaign queued for {sentTo.length} diner{sentTo.length === 1 ? '' : 's'}
        </p>
        <ul className="mt-3 space-y-1.5">
          {sentTo.map((t) => (
            <li key={t.diner_id} className="flex items-center gap-2 text-sm text-[var(--color-verified)]">
              <span aria-hidden>{t.avatar_emoji}</span>
              <span>{t.name}</span>
              <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-xs text-[var(--color-ink)]">
                {t.icon} {t.tag_label}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-[var(--color-verified)]/20 pt-3 text-xs text-[var(--color-verified)]">
          Demo scope: no push notification is actually delivered. Each diner&rsquo;s invitation
          is already live on their own screen — open a diner view to see the real thing.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-3 text-sm font-medium text-[var(--color-verified)] underline underline-offset-4"
        >
          Set up another
        </button>
      </div>
    );
  }

  return (
    <div ref={groupRef}>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = reachable.filter(f.match).length;
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              data-animate-on-mount
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                active ? filterStyles[f.id] : 'border-[var(--color-ink)]/15 bg-[var(--color-paper)] text-[var(--color-ink)] hover:border-[var(--color-ink)]/30'
              }`}
            >
              {f.label} <span className={active ? 'text-current/80' : 'text-stone-500'}>{n}</span>
            </button>
          );
        })}
      </div>

      {selected.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">No diners match this filter.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {selected.map((t) => (
              <span
                key={t.diner_id}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-sm text-stone-700"
              >
                <span aria-hidden>{t.avatar_emoji}</span>
                {t.name.replace(' (demo profile)', '')}
              </span>
            ))}
          </div>

          {/* The trust-building beat: one tap, but not one identical blast. */}
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3.5">
            <p className="font-medium text-stone-900">
              They won&rsquo;t all get the same message
            </p>
            <ul className="mt-2 space-y-1">
              {spread.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-sm text-stone-700">
                  <span aria-hidden>{s.icon}</span>
                  <span className="font-medium">{s.n}</span>
                  <span className="text-stone-600">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => setSentTo(selected)}
        data-animate-on-mount
        className="mt-4 w-full rounded-xl bg-[var(--color-verified)] px-4 py-3 font-medium text-white transition hover:bg-[var(--color-verified)]/90 disabled:opacity-40"
      >
        Send to {selected.length} diner{selected.length === 1 ? '' : 's'}
      </button>

      {optedOut > 0 && (
        <p className="mt-3 text-xs text-stone-500">
          {optedOut} flagged diner{optedOut === 1 ? ' has' : 's have'} nudges switched off and
          {optedOut === 1 ? ' is' : ' are'} excluded from every group here. There is no
          override — that is the point of the setting.
        </p>
      )}
    </div>
  );
}
