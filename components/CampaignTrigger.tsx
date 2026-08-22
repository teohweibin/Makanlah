'use client';

// One-tap campaign trigger.
//
// Scope note (PRD, Day-1 "build light"): this shows a confirmation state. No notification
// is actually delivered, and the UI says so rather than implying a send that never
// happened — the invitations themselves are already real and live on each diner's screen.

import { useMemo, useState } from 'react';

export interface CampaignTarget {
  diner_id: string;
  name: string;
  avatar_emoji: string;
  evidence_strength: 'strong' | 'weak' | 'none';
  status: string;
  intervention_type: string;
  icon: string;
  tag_label: string;
  notify_opt_in: boolean;
}

type FilterId = 'all' | 'verified' | 'silent' | 'no_signal';

const FILTERS: Array<{ id: FilterId; label: string; match: (t: CampaignTarget) => boolean }> = [
  { id: 'all', label: 'Everyone flagged', match: () => true },
  { id: 'verified', label: 'Verified reasons', match: (t) => t.evidence_strength === 'strong' },
  { id: 'silent', label: 'Silent churners', match: (t) => t.status === 'silent_churn' },
  { id: 'no_signal', label: 'No signal', match: (t) => t.evidence_strength === 'none' },
];

export function CampaignTrigger({ targets }: { targets: CampaignTarget[] }) {
  const [filter, setFilter] = useState<FilterId>('verified');
  const [sentTo, setSentTo] = useState<CampaignTarget[] | null>(null);

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

  if (sentTo) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-medium text-emerald-900">
          ✓ Campaign queued for {sentTo.length} diner{sentTo.length === 1 ? '' : 's'}
        </p>
        <ul className="mt-3 space-y-1.5">
          {sentTo.map((t) => (
            <li key={t.diner_id} className="flex items-center gap-2 text-sm text-emerald-900">
              <span aria-hidden>{t.avatar_emoji}</span>
              <span>{t.name}</span>
              <span className="ml-auto rounded bg-white/70 px-2 py-0.5 text-xs">
                {t.icon} {t.tag_label}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-emerald-200 pt-3 text-xs text-emerald-800">
          Demo scope: no push notification is actually delivered. Each diner&rsquo;s invitation
          is already live on their own screen — open a diner view to see the real thing.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-3 text-sm font-medium text-emerald-900 underline underline-offset-4"
        >
          Set up another
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = reachable.filter(f.match).length;
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? 'border-stone-800 bg-stone-800 text-white'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
              }`}
            >
              {f.label} <span className={active ? 'text-stone-300' : 'text-stone-400'}>{n}</span>
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

          <p className="mt-3 text-sm text-stone-500">
            They will not all get the same message:{' '}
            {spread.map((s, i) => (
              <span key={s.label}>
                {i > 0 && ', '}
                {s.icon} {s.n} &times; {s.label}
              </span>
            ))}
          </p>
        </>
      )}

      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => setSentTo(selected)}
        className="mt-4 w-full rounded-xl bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
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
