import type { EvidenceStrength, RiskStatus } from '@/lib/types';

/**
 * Tailwind cannot scan data/*.json for class names, so the tag_color values in
 * intervention_lookup.json map to literal class strings here. Adding a colour to the
 * JSON means adding a row here too — that is the trade for keeping copy in the fixture.
 */
const TAG_COLORS: Record<string, string> = {
  orange: 'bg-[#FBF2E0] text-[#A13D2E] border-[#C48A2E]',
  blue: 'bg-[#EDEBF5] text-[#5B5285] border-[#5B5285]/30',
  green: 'bg-[#E4F0E6] text-[#2F5233] border-[#2F5233]/30',
  gray: 'bg-[#F7F3E8] text-[#5F5E5A] border-[#5F5E5A]/20',
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
  strong: {
    label: 'Verified',
    className: 'bg-[#E4F0E6] text-[#2F5233] border-[#2F5233]/30',
    hint: 'From a guided review — the diner told us this themselves',
  },
  weak: {
    label: 'Inferred',
    className: 'bg-[#FBF2E0] text-[#C48A2E] border-[#C48A2E]/40',
    hint: 'Pattern-based guess — not confirmed by the diner',
  },
  none: {
    label: 'No signal',
    className: 'bg-[#F7F3E8] text-[#5F5E5A] border-[#5F5E5A]/20',
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

const STATUS: Record<Exclude<RiskStatus, 'none'>, { label: string; className: string }> = {
  at_risk: { label: 'At risk', className: 'bg-[#F5E5E2] text-[#A13D2E] border-[#A13D2E]/30' },
  silent_churn: { label: 'Silent churn', className: 'bg-[#EDEBF5] text-[#5B5285] border-[#5B5285]/30' },
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
    <div className={`card-hover rounded-xl border border-[#1A1410]/10 bg-white shadow-sm transition ${className}`}>
      {children}
    </div>
  );
}
