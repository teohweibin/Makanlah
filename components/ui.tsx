import type { EvidenceStrength, RiskStatus } from '@/lib/types';

/**
 * Tailwind cannot scan data/*.json for class names, so the tag_color values in
 * intervention_lookup.json map to literal class strings here. Adding a colour to the
 * JSON means adding a row here too — that is the trade for keeping copy in the fixture.
 */
const TAG_COLORS: Record<string, string> = {
  orange: 'bg-orange-50 text-orange-900 border-orange-200',
  blue: 'bg-blue-50 text-blue-900 border-blue-200',
  green: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  gray: 'bg-stone-100 text-stone-700 border-stone-200',
};

export function InterventionTag({
  icon,
  label,
  color,
}: {
  icon: string;
  label: string;
  color: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        TAG_COLORS[color] ?? TAG_COLORS.gray
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

/**
 * The evidence label is the point of the whole dashboard: the restaurant owner has to
 * be able to tell "she told us this" apart from "we guessed this" at a glance.
 */
const EVIDENCE: Record<EvidenceStrength, { label: string; className: string; hint: string }> = {
  verified_with_photo: {
    label: 'Verified — photo + review',
    className: 'bg-emerald-200 text-emerald-950 border-emerald-400',
    hint: 'They showed us — a photo backs up what they said',
  },
  strong: {
    label: 'Verified from review',
    className: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    hint: 'From a guided review — the diner told us this themselves',
  },
  weak: {
    label: 'Inferred from behavior',
    className: 'bg-amber-100 text-amber-900 border-amber-300',
    hint: 'Pattern-based guess — not confirmed by the diner',
  },
  none: {
    label: 'No signal',
    className: 'bg-stone-100 text-stone-600 border-stone-300',
    hint: 'No supporting data at all — treat gently',
  },
};

export function EvidenceBadge({ strength }: { strength: EvidenceStrength }) {
  const e = EVIDENCE[strength];
  return (
    <span
      title={e.hint}
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${e.className}`}
    >
      {e.label}
    </span>
  );
}

export function evidenceHint(strength: EvidenceStrength) {
  return EVIDENCE[strength].hint;
}

/** Human-readable label for an evidence tier. The only place these strings live. */
export function evidenceLabel(strength: EvidenceStrength) {
  return EVIDENCE[strength].label;
}

const STATUS: Record<Exclude<RiskStatus, 'none'>, { label: string; className: string }> = {
  at_risk: { label: 'At risk', className: 'bg-rose-100 text-rose-900 border-rose-300' },
  silent_churn: { label: 'Silent churn', className: 'bg-violet-100 text-violet-900 border-violet-300' },
};

export function StatusBadge({ status }: { status: RiskStatus }) {
  if (status === 'none') return null;
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-stone-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}
