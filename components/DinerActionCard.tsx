'use client';

// DinerActionCard — compact, scannable card for each at-risk diner.
// Shows: avatar, name, reason, priority badge, invitation status, and CTA.

import { useState } from 'react';
import Link from 'next/link';
import { markIssueFixed } from '@/app/actions';
import type { PriorityLabel } from '@/lib/engine';

export interface DinerCardData {
  dinerId: string;
  restaurantId: string;
  name: string;
  avatar: string;
  reason: string;
  dishId: string | null;
  dishName: string | null;
  evidenceStrength: 'strong' | 'weak' | 'none';
  status: string;
  daysSinceLastVisit: number | null;
  visitCadence: number | null;
  priorityLabel: PriorityLabel;
  returnChance: number;
  explanation: string;
  // Invitation state
  invitationStatus?: 'pending' | 'accepted' | 'declined' | 'expired';
  invitationSentAgo?: string;
  mintAddress?: string | null;
  // Reward
  rewardDescription: string;
  optedIn: boolean;
}

const PRIORITY_STYLES: Record<PriorityLabel, { bg: string; text: string; icon: string }> = {
  'Quick Win': { bg: 'bg-[var(--color-success-light)]', text: 'text-[var(--color-success)]', icon: '🎯' },
  'Worth Trying': { bg: 'bg-[var(--color-warning-light)]', text: 'text-[var(--color-warning)]', icon: '💡' },
  'Long Shot': { bg: 'bg-[var(--color-violet-light)]', text: 'text-[var(--color-violet)]', icon: '🌱' },
};

const EVIDENCE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  strong: { bg: 'bg-[var(--color-success-light)]', text: 'text-[var(--color-success)]', label: 'Verified' },
  weak: { bg: 'bg-[var(--color-warning-light)]', text: 'text-[var(--color-warning)]', label: 'Inferred' },
  none: { bg: 'bg-[var(--color-paper)]', text: 'text-[var(--color-muted)]', label: 'No signal' },
};

export function DinerActionCard({ data }: { data: DinerCardData }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>(
    data.invitationStatus === 'pending' ? 'sent' : 'idle',
  );
  const [showWhy, setShowWhy] = useState(false);

  const priority = PRIORITY_STYLES[data.priorityLabel];
  const evidence = EVIDENCE_STYLES[data.evidenceStrength];

  async function handleMarkFixed() {
    if (!data.dishId) return;
    setState('sending');
    try {
      await markIssueFixed({
        restaurant_id: data.restaurantId,
        dish_id: data.dishId,
      });
      setState('sent');
    } catch {
      setState('idle');
    }
  }

  // ── Invitation ACCEPTED state ─────────────────────────────────────
  if (data.invitationStatus === 'accepted') {
    return (
      <div className="animate-slide-up rounded-xl border border-[var(--color-success)]/20 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{data.avatar}</span>
          <div className="flex-1">
            <p className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-ink)]">{data.name}</p>
            <p className="text-sm text-[var(--color-success)]">✅ Reward accepted</p>
          </div>
          {data.mintAddress && (
            <a
              href={`https://explorer.solana.com/address/${data.mintAddress}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[var(--color-ink)]/10 px-3 py-1.5 text-xs text-[var(--color-muted)] transition hover:bg-[var(--color-paper)]"
            >
              Solscan ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Invitation PENDING state ──────────────────────────────────────
  if (state === 'sent' || data.invitationStatus === 'pending') {
    return (
      <div className="animate-slide-up rounded-xl border border-[var(--color-warning)]/20 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{data.avatar}</span>
          <div className="flex-1">
            <p className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-ink)]">{data.name}</p>
            <p className="text-sm text-[var(--color-warning)]">⏳ Invitation sent — awaiting acceptance</p>
            {data.invitationSentAgo && (
              <p className="text-xs text-[var(--color-muted)]">Sent {data.invitationSentAgo}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Default: actionable card ──────────────────────────────────────
  return (
    <div className="animate-slide-up overflow-hidden rounded-xl border border-[var(--color-ink)]/8 bg-white shadow-sm transition hover:shadow-md">
      <div className="p-4">
        {/* row 1: avatar + name + priority badge */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{data.avatar}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
                {data.name}
              </p>
              {!data.optedIn && (
                <span className="rounded bg-[var(--color-paper)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">
                  nudges off
                </span>
              )}
            </div>
            {/* reason — short, no paragraph */}
            <p className="mt-0.5 text-sm text-[var(--color-ink)]/80">
              &ldquo;{data.reason}&rdquo;
            </p>
          </div>
          {/* priority badge */}
          <div className={`shrink-0 rounded-lg ${priority.bg} px-2.5 py-1.5 text-center`}>
            <p className="text-xs">{priority.icon}</p>
            <p className={`text-[10px] font-semibold uppercase ${priority.text}`}>{data.priorityLabel}</p>
          </div>
        </div>

        {/* row 2: meta badges */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full ${evidence.bg} ${evidence.text} border border-current/20 px-2 py-0.5 font-medium`}>
            {evidence.label}
          </span>
          {data.daysSinceLastVisit !== null && (
            <span className="text-[var(--color-muted)]">
              Last visit: {data.daysSinceLastVisit}d ago
            </span>
          )}
          {data.visitCadence !== null && (
            <span className="text-[var(--color-muted)]">
              · Usually every {Math.round(data.visitCadence)}d
            </span>
          )}
          <span className={`ml-auto font-medium ${priority.text}`}>
            {data.returnChance}% chance
          </span>
        </div>

        {/* row 3: "Why?" expandable */}
        <button
          type="button"
          onClick={() => setShowWhy(!showWhy)}
          className="mt-2 text-xs text-[var(--color-muted)] underline underline-offset-2 hover:text-[var(--color-ink)]"
        >
          {showWhy ? 'Hide explanation' : 'ⓘ Why this person?'}
        </button>
        {showWhy && (
          <div className="mt-2 rounded-lg bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-muted)]">
            {data.explanation}
          </div>
        )}
      </div>

      {/* CTA footer */}
      {data.optedIn && (
        <div className="flex items-center gap-2 border-t border-[var(--color-ink)]/5 bg-[var(--color-paper)]/50 px-4 py-3">
          {data.dishId ? (
            <button
              type="button"
              onClick={handleMarkFixed}
              disabled={state === 'sending'}
              className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60"
            >
              {state === 'sending' ? 'Sending…' : 'Mark Fixed & Invite Back'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMarkFixed}
              disabled={state === 'sending'}
              className="flex-1 rounded-lg bg-[var(--color-ink)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-ink)]/85 active:scale-[0.98] disabled:opacity-60"
            >
              {state === 'sending' ? 'Sending…' : 'Send Nudge'}
            </button>
          )}
          <Link
            href={`/restaurant/${data.restaurantId}/diner/${data.dinerId}`}
            className="rounded-lg border border-[var(--color-ink)]/10 px-3 py-2.5 text-xs text-[var(--color-muted)] transition hover:bg-[var(--color-paper)]"
          >
            Details →
          </Link>
        </div>
      )}
    </div>
  );
}
