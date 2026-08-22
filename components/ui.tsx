'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap-config';
import { EVIDENCE_DISPLAY } from '@/lib/plain';
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

export function EvidenceBadge({ strength }: { strength: EvidenceStrength }) {
  const e = EVIDENCE_DISPLAY[strength];
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const target = ref.current;
    const group = target.closest('[data-badge-group]');
    const badges = group ? group.querySelectorAll('[data-badge-stamp]') : [target];

    const ctx = gsap.context(() => {
      gsap.fromTo(
        badges,
        {
          opacity: 0,
          rotate: -8,
          scale: 1.4,
          transformOrigin: 'center center',
        },
        {
          opacity: 1,
          rotate: 0,
          scale: 1,
          duration: 0.4,
          ease: 'back.out(2)',
          stagger: 0.08,
        },
      );
    }, group ?? target.parentElement ?? undefined);

    return () => ctx.revert();
  }, [strength]);

  return (
    <span
      ref={ref}
      data-badge-stamp
      title={e.hint}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${e.className}`}
    >
      {e.label}
    </span>
  );
}



const STATUS: Record<Exclude<RiskStatus, 'none'>, { label: string; className: string }> = {
  at_risk: {
    label: 'At risk',
    className:
      'border border-[var(--color-at-risk)]/30 bg-[var(--color-soft-red)] text-[var(--color-at-risk)]',
  },
  silent_churn: {
    label: 'Silent churn',
    className:
      'border border-[var(--color-silent)]/30 bg-[var(--color-soft-violet)] text-[var(--color-silent)]',
  },
};

export function StatusBadge({ status }: { status: RiskStatus }) {
  if (status === 'none') return null;
  const s = STATUS[status];
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const target = ref.current;
    const group = target.closest('[data-badge-group]');
    const badges = group ? group.querySelectorAll('[data-badge-stamp]') : [target];

    const ctx = gsap.context(() => {
      gsap.fromTo(
        badges,
        {
          opacity: 0,
          rotate: -8,
          scale: 1.4,
          transformOrigin: 'center center',
        },
        {
          opacity: 1,
          rotate: 0,
          scale: 1,
          duration: 0.4,
          ease: 'back.out(2)',
          stagger: 0.08,
        },
      );
    }, group ?? target.parentElement ?? undefined);

    return () => ctx.revert();
  }, [status]);

  return (
    <span
      ref={ref}
      data-badge-stamp
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export function Card({
  children,
  className = '',
  animateOnMount = false,
}: {
  children: React.ReactNode;
  className?: string;
  animateOnMount?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!animateOnMount || !ref.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' },
      );
    }, ref);

    return () => ctx.revert();
  }, [animateOnMount]);

  return (
    <div
      ref={ref}
      data-card-animate={animateOnMount ? 'true' : undefined}
      className={`rounded-xl border border-stone-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardGroup({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const cards = ref.current.querySelectorAll('[data-card-animate="true"]');
    if (!cards.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cards,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.1 },
      );
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
