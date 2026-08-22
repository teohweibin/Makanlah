// Enhanced wallet token card — shows full reward details, QR code, expiry, redemption instructions.
// Server component — renders the rich token info from accepted invitations.

import { explorerUrl } from '@/lib/solana';
import type { Invitation } from '@/lib/types';
import QRCode from 'qrcode';

interface WalletTokenCardProps {
  invitation: Invitation;
}

export async function WalletTokenCard({ invitation: inv }: WalletTokenCardProps) {
  const expiresAt = new Date(inv.created_at + inv.validity_days * 86_400_000);
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000));
  const isExpiring = daysLeft <= 3;

  // Generate QR code as data URL
  const qrData = JSON.stringify({
    type: 'makanlagi_reward',
    code: inv.redemption_code,
    mint: inv.mint_address,
    restaurant: inv.restaurant_id,
    diner: inv.diner_id,
    expires: expiresAt.toISOString(),
  });

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 160,
      margin: 2,
      color: { dark: '#1A1410', light: '#F7F3E8' },
    });
  } catch {
    // QR generation failed — not critical
  }

  return (
    <div className="animate-slide-up overflow-hidden rounded-xl border border-[var(--color-ink)]/10 bg-white shadow-sm">
      {/* restaurant header */}
      <div className="bg-[var(--color-paper)] px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          From {inv.restaurant_name}
        </p>
      </div>

      {/* reward info */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>🎁</span>
          <div className="flex-1">
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
              {inv.reward_description}
            </h3>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">
              Worth {inv.reward_value} · {inv.reward_percent}% off
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--color-success-light)] px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">
            READY
          </span>
        </div>

        {/* what you get */}
        <div className="mt-4 rounded-lg bg-[var(--color-paper)] p-3 text-sm">
          <p className="font-medium text-[var(--color-ink)]">What you get:</p>
          <p className="mt-1 flex items-center gap-2 text-[var(--color-success)]">
            <span>✅</span> {inv.reward_description} (worth {inv.reward_value})
          </p>
          {inv.dish_name && (
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Specifically: {inv.dish_name}
            </p>
          )}
        </div>

        {/* how to redeem */}
        <div className="mt-3 rounded-lg bg-[var(--color-paper)] p-3 text-sm">
          <p className="font-medium text-[var(--color-ink)]">How to redeem:</p>
          <ol className="mt-1 space-y-1 text-[var(--color-muted)]">
            <li className="flex gap-2">
              <span className="text-[var(--color-ink)]">1.</span> Show this screen to the cashier
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-ink)]">2.</span> Or mention code:{' '}
              <span className="font-mono font-semibold text-[var(--color-ink)]">{inv.redemption_code}</span>
            </li>
          </ol>
        </div>

        {/* expiry */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className={`flex items-center gap-1.5 ${isExpiring ? 'text-[var(--color-danger)]' : 'text-[var(--color-muted)]'}`}>
            ⏰ Valid until {expiresAt.toLocaleDateString('en-MY', { month: 'short', day: 'numeric', year: 'numeric' })}
            {isExpiring && <span className="animate-pulse-soft font-medium">({daysLeft}d left!)</span>}
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            {inv.restaurant_name} only
          </span>
        </div>

        {/* QR code */}
        {qrDataUrl && (
          <div className="mt-4 flex flex-col items-center rounded-lg border border-[var(--color-ink)]/5 bg-[var(--color-paper)] p-4">
            <img src={qrDataUrl} alt="Redemption QR code" className="h-40 w-40" />
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Scan to verify · Code: {inv.redemption_code}
            </p>
          </div>
        )}

        {/* action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            Redeem Now
          </button>
          {inv.mint_address && (
            <a
              href={explorerUrl('address', inv.mint_address)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[var(--color-ink)]/10 bg-white px-4 py-3 text-center text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-paper)]"
            >
              Solscan ↗
            </a>
          )}
        </div>

        {/* chain info footer */}
        {inv.mint_address && (
          <div className="mt-3 rounded-lg bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-muted)]">
            <span className="font-medium">On-chain proof:</span>{' '}
            <a
              href={explorerUrl('address', inv.mint_address)}
              target="_blank"
              rel="noreferrer"
              className="font-mono underline underline-offset-2 hover:text-[var(--color-ink)]"
            >
              {inv.mint_address.slice(0, 8)}…{inv.mint_address.slice(-6)}
            </a>
          </div>
        )}
        {inv.chain_error && (
          <p className="mt-2 text-xs text-[var(--color-danger)]">
            Chain note: {inv.chain_error}
          </p>
        )}
      </div>
    </div>
  );
}
