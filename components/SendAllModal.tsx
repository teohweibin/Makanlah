'use client';

// "Send to all" confirmation modal — shows cost breakdown before mass-inviting.

import { useState } from 'react';

interface SendTarget {
  name: string;
  avatar: string;
  rewardDescription: string;
  estimatedCost: number;
}

interface SendAllModalProps {
  targets: SendTarget[];
  budgetRemaining: number;
  currency: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function SendAllModal({ targets, budgetRemaining, currency, onConfirm, onClose }: SendAllModalProps) {
  const [sending, setSending] = useState(false);
  const totalCost = targets.reduce((sum, t) => sum + t.estimatedCost, 0);
  const budgetAfter = budgetRemaining - totalCost;

  async function handleConfirm() {
    setSending(true);
    await onConfirm();
    setSending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/40 p-4">
      <div className="animate-scale-in w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="border-b border-[var(--color-ink)]/5 px-5 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-ink)]">
            Send Invitations to {targets.length} Regulars?
          </h2>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm text-[var(--color-muted)]">This will create invitations for:</p>
          <ul className="mt-3 space-y-2">
            {targets.map((t) => (
              <li key={t.name} className="flex items-center gap-2 text-sm">
                <span>{t.avatar}</span>
                <span className="flex-1 text-[var(--color-ink)]">{t.name}</span>
                <span className="text-xs text-[var(--color-muted)]">{t.rewardDescription}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg bg-[var(--color-paper)] p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--color-muted)]">Estimated cost:</span>
              <span className="font-medium text-[var(--color-ink)]">{currency} {totalCost.toFixed(0)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[var(--color-muted)]">Budget after:</span>
              <span className={`font-medium ${budgetAfter < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                {currency} {budgetAfter.toFixed(0)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-[var(--color-ink)]/5 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-ink)]/10 bg-white px-4 py-3 text-sm font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-paper)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={sending || budgetAfter < 0}
            className="flex-1 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] active:scale-[0.98] disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send All Invitations'}
          </button>
        </div>
      </div>
    </div>
  );
}
