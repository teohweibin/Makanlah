// Diner-facing win-back screen.
//
// Tone rule: this is an invitation, not a retention notice. The diner never sees the
// risk machinery — no "you haven't ordered in 46 days", no cadence, no flag status.
// They see a reason to come back, and if they told us something, they see that it was
// acted on. The surveillance framing stays on the restaurant side of the app.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { evaluateDiner, renderHeadline, selectIntervention } from '@/lib/engine';
import { loadDataset } from '@/lib/fixtures';
import { explorerUrl } from '@/lib/solana';
import { getAcceptedInvite } from '@/lib/store';
import { AcceptInvite } from '@/components/AcceptInvite';
import { InterventionTag } from '@/components/ui';

const CTA: Record<string, string> = {
  dish_fix_reward: 'Claim my table',
  priority_seating: 'Hold my seat',
  value_bundle: 'Claim this bundle',
  reorder_nudge: 'Send my usual',
  neutral_invite: 'Save my spot',
};

export default async function WinBackInvite({
  params,
}: {
  params: Promise<{ dinerId: string; restaurantId: string }>;
}) {
  const { dinerId, restaurantId } = await params;
  const ds = loadDataset();
  const diner = ds.diners.find((d) => d.id === dinerId);
  const restaurant = ds.restaurants.find((r) => r.id === restaurantId);
  if (!diner || !restaurant) notFound();

  const flag = evaluateDiner(ds, dinerId, restaurantId);
  const accepted = getAcceptedInvite(dinerId, restaurantId);

  /* ── nothing pending ─────────────────────────────────────────────────── */
  if (!flag && !accepted) {
    return (
      <main className="mx-auto max-w-md px-5 py-10 text-center">
        <p className="text-4xl" aria-hidden>
          🍜
        </p>
        <h1 className="mt-3 text-xl font-semibold text-stone-900">Nothing waiting for you</h1>
        <p className="mt-1 text-stone-500">
          You&rsquo;re all caught up with {restaurant.name}.
        </p>
        <Link
          href={`/diner/${dinerId}`}
          className="mt-6 inline-block text-sm text-stone-500 underline underline-offset-4"
        >
          Back to your meals
        </Link>
      </main>
    );
  }

  /* ── nudges turned off — we say nothing, and we mean it ──────────────── */
  if (!diner.notify_opt_in && !accepted) {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
          <p className="text-3xl" aria-hidden>
            🔕
          </p>
          <h1 className="mt-3 text-xl font-semibold text-stone-900">Nudges are off</h1>
          <p className="mt-2 text-stone-600">
            You asked us not to send these, so we haven&rsquo;t. {restaurant.name} can&rsquo;t
            reach you here until you turn them back on.
          </p>
          <p className="mt-3 text-sm text-stone-500">
            Nothing has been sent to you, and no reward was issued in your name.
          </p>
        </div>
        <Link
          href={`/diner/${dinerId}`}
          className="mt-6 block text-center text-sm text-stone-500 underline underline-offset-4"
        >
          Back to your meals
        </Link>
      </main>
    );
  }

  const interventionType =
    accepted?.intervention_type ??
    selectIntervention(flag!.reason_type, flag!.evidence_strength, ds.interventionLookup);
  const presentation = ds.interventionLookup.presentation[interventionType];
  const headline = renderHeadline(ds, interventionType, flag?.related_dish_id ?? null);

  // If they told us about a dish and the kitchen fixed it, that is the whole message.
  const fixedPain =
    flag?.reason_type === 'dish_issue'
      ? restaurant.known_pain_points.find(
          (p) => p.reason_type === 'dish_issue' && p.status !== 'open',
        )
      : null;

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <Link
        href={`/diner/${dinerId}`}
        className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
      >
        &larr; Back
      </Link>

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="px-6 py-7 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
            From {restaurant.name}
          </p>
          <div className="mt-3 flex justify-center">
            <InterventionTag
              icon={presentation.icon}
              label={presentation.tag_label}
              color={presentation.tag_color}
            />
          </div>
          <h1 className="mt-4 text-2xl font-semibold leading-snug tracking-tight text-stone-900">
            {headline}
          </h1>
          <p className="mt-2 text-stone-600">{presentation.body}</p>

          {fixedPain && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
              You told us about this. {fixedPain.fixed_note ?? 'The kitchen has sorted it.'}
            </p>
          )}
        </div>

        <div className="border-t border-stone-100 bg-stone-50 px-6 py-5 text-center">
          <div className="text-4xl font-semibold tracking-tight text-stone-900">
            {accepted?.reward_percent ?? presentation.reward_percent}%
          </div>
          <div className="mt-0.5 text-sm font-medium uppercase tracking-wide text-stone-500">
            off when you come in
          </div>
        </div>
      </div>

      {/* ── accepted state ────────────────────────────────────────────── */}
      {accepted ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-medium text-emerald-900">✓ Saved for you</p>
          <p className="mt-1 text-sm text-emerald-800">
            {restaurant.name} knows you&rsquo;re coming. Show this when you arrive.
          </p>
          <div className="mt-3 border-t border-emerald-200 pt-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-emerald-800">Reward token</span>
              <code className="text-emerald-900">{accepted.reward_token_id}</code>
            </div>
            {accepted.mint_address ? (
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="shrink-0 text-emerald-800">On chain</span>
                <a
                  href={explorerUrl('address', accepted.mint_address)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono text-xs text-emerald-900 underline underline-offset-4"
                >
                  {accepted.mint_address}
                </a>
              </div>
            ) : (
              <p className="mt-2 rounded bg-white/70 px-2 py-1.5 text-xs text-stone-600">
                Your reward is saved. On-chain issuance is pending
                {accepted.chain_error ? `: ${accepted.chain_error}` : '.'}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <AcceptInvite
            dinerId={dinerId}
            restaurantId={restaurantId}
            label={CTA[interventionType] ?? 'Save my spot'}
          />
          <p className="mt-3 text-center text-xs text-stone-400">
            No pressure — this stays here whether you use it or not.{' '}
            <Link href={`/diner/${dinerId}`} className="underline underline-offset-4">
              Not now
            </Link>
          </p>
        </div>
      )}
    </main>
  );
}
