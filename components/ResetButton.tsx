'use client';

import { useState } from 'react';
import { resetDemoData } from '@/app/actions';

export function ResetButton() {
  const [state, setState] = useState<'idle' | 'resetting' | 'done'>('idle');

  async function handleReset() {
    if (!confirm('Reset all demo data? This clears all reviews, invitations, and feedback.')) return;
    setState('resetting');
    await resetDemoData();
    setState('done');
    setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={state === 'resetting'}
      className="text-xs text-[var(--color-muted)]/50 underline underline-offset-4 transition hover:text-[var(--color-danger)] disabled:opacity-50"
    >
      {state === 'resetting' ? 'Resetting...' : state === 'done' ? '\u2713 Reset complete' : 'Reset demo data'}
    </button>
  );
}
