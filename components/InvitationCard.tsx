'use client';

// Invitation card — shown when a restaurant invites a diner back after fixing an issue.
// The diner accepts → token is minted. Decline → invitation disappears.

import { useState } from 'react';
import { acceptInvitation, declineInvitation } from '@/app/actions';
import type { Invitation } from '@/lib/types';

export function InvitationCard({ invitation }: { invitation: Invitation }) {
  const [state, setState] = useState<'idle' | 'accepting' | 'accepted' | 'declined'>('idle');
  const [error, setError] = useState<string | null>(null);

  const daysLeft = Math.max(
    0,
    invitation.validity_days - Math.floor((Date.now() - invitation.created_at) / 86_400_000),
  );

  async function handleAccept() {
    setState('accepting');
    setError(null);
    try {
      const result = await acceptInvitation({
        invitation_id: invitation.id,
        diner_id: invitation.diner_id,
      });
      if (result.ok) {
        setState('accepted');
      } else {
        setError((result as { error?: string }).error ?? 'Something went wrong');
        setState('idle');
      }
    } catch {
      setError('Could not accept — try again.');
      setState('idle');
    }
  }

  async function handleDecline() {
    setState('declined');
    await declineInvitation({
      invitation_id: invitation.id,
      diner_id: invitation.diner_id,
    });
  }

  if (state === 'declined') return null;

  if (state === 'accepted') {
    return (
      <div className="animate-scale-in rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success-light)] p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success)]/20">
          <span className="text-2xl">🪙</span>
        </div>
        <p className="mt-3 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-success)]">
          Reward added to your wallet!
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {invitation.reward_description} · Valid for {invitation.validity_days} days
        </p>
      </div>
    );
  }

  return (
    <div className="animate-slide-up overflow-hidden rounded-xl border border-[var(--color-warning)]/30 bg-white shadow-sm">
      {/* header strip */}
      <div className="bg-[var(--color-warning-light)] px-4 py-2.5">
        <p className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-[var(--color-warning)]">
          🍽️ {invitation.restaurant_name} invites you!
        </p>
      </div>

      {/* body */}
      <div className="px-4 py-4">
        <p className="text-[var(--color-ink)]">{invitation.message}</p>

        {/* reward details */}
        <div className="mt-3 rounded-lg bg-[var(--color-paper)] p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎁</span>
            <div>
              <p className="font-medium text-[var(--color-ink)]">
                {invitation.reward_description}
              </p>
              <p className="text-sm text-[var(--color-muted)]">
                Worth {invitation.reward_value}
              </p>
            </div>
          </div>
        </div>

        {/* expiry + instructions */}
        <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-muted)]">
          <span className="flex items-center gap-1">
            ⏰ {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
          </span>
          <span className="flex items-center gap-1">
            📋 Code: <span className="font-mono font-medium text-[var(--color-ink)]">{invitation.redemption_code}</span>
          </span>
        </div>

        {error && (
          <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>
        )}

        {/* action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={state === 'accepting'}
            className="flex-1 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60"
          >
            {state === 'accepting' ? 'Accepting…' : 'Accept Invitation'}
          </button>
          <button
            type="button"
            onClick={handleDecline}
            className="rounded-xl border border-[var(--color-ink)]/10 bg-white px-4 py-3 text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-paper)]"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

/** Container that renders all pending invitations for a diner. */
export function InvitationList({ invitations }: { invitations: Invitation[] }) {
  if (invitations.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {invitations.map((inv) => (
        <InvitationCard key={inv.id} invitation={inv} />
      ))}
    </div>
  );
}
