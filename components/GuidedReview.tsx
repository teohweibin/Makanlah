'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { submitReview } from '@/app/actions';
import { matchTagsWithKeywords } from '@/lib/engine';
import type { Dish, GuidedReviewTag } from '@/lib/types';

type Stage = 'write' | 'clarify' | 'dish' | 'sending';

export function GuidedReview({
  orderId,
  restaurantName,
  dishes,
  tags,
  redirectTo,
}: {
  orderId: string;
  restaurantName: string;
  /** Only the dishes on THIS order — follow-up chips never offer a dish they didn't eat. */
  dishes: Dish[];
  tags: GuidedReviewTag[];
  /** Where to go after submitting. Omit to confirm in place on the same page. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('write');
  const [text, setText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dishByTag, setDishByTag] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  /** Keyword matching, not a live LLM call — deterministic enough to demo. */
  const hits = useMemo(() => matchTagsWithKeywords(text, tags), [text, tags]);
  const suggestedIds = useMemo(() => new Set(hits.map((h) => h.tag.id)), [hits]);

  const problemTags = tags.filter((t) => t.reason_type !== 'none');
  const positiveTag = tags.find((t) => t.reason_type === 'none');

  /** Tags that still need "which dish?" answered. A one-dish order answers itself. */
  const pendingDishTags = selected
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is GuidedReviewTag => !!t && t.requires_dish)
    .filter((t) => dishes.length > 1 && !dishByTag[t.id]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function goFromWrite() {
    // Anything the keyword matcher spotted is pre-ticked, but the diner confirms it —
    // we never file a complaint on their behalf that they didn't agree to.
    setSelected(hits.map((h) => h.tag.id));
    setStage('clarify');
  }

  function goFromClarify() {
    const needsDish = selected
      .map((id) => tags.find((t) => t.id === id))
      .some((t) => t?.requires_dish);
    if (needsDish && dishes.length > 1) {
      setStage('dish');
      return;
    }
    void send();
  }

  async function send() {
    setStage('sending');
    setError(null);
    const guided_tags = selected.map((id) => {
      const tag = tags.find((t) => t.id === id);
      if (!tag?.requires_dish) return id;
      const dishId = dishes.length === 1 ? dishes[0].id : dishByTag[id];
      return dishId ? `${id}:${dishId}` : id;
    });
    try {
      await submitReview({
        order_id: orderId,
        free_text: text.trim(),
        guided_tags: guided_tags.length ? guided_tags : positiveTag ? [positiveTag.id] : [],
        rating: rating ?? 3,
      });
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setError('Could not save that — try again.');
      setStage('clarify');
    }
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-2 text-sm transition ${
      active
        ? 'border-stone-800 bg-stone-800 text-white'
        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
    }`;

  /* ── step 1: free text + rating ──────────────────────────────────────── */
  if (stage === 'write') {
    return (
      <div>
        <Step n={1} of={3} label="How was it?" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
          How was {restaurantName}?
        </h1>
        <p className="mt-1 text-stone-500">A word or two is plenty — we&rsquo;ll ask the rest.</p>

        <div className="mt-5 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className={`h-11 w-11 rounded-full border text-lg transition ${
                rating !== null && n <= rating
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-stone-300 bg-white hover:border-stone-400'
              }`}
            >
              {rating !== null && n <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="e.g. the chicken was a bit dry"
          className="mt-5 w-full rounded-xl border border-stone-300 bg-white p-3.5 text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
        />

        {hits.length > 0 && (
          <p className="mt-2 text-sm text-stone-500">
            We picked up{' '}
            {hits.map((h, i) => (
              <span key={h.tag.id}>
                {i > 0 && ' and '}
                <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
                  &ldquo;{h.keyword}&rdquo;
                </span>
              </span>
            ))}
            {' '}&mdash; one tap to confirm next.
          </p>
        )}

        <button
          type="button"
          onClick={goFromWrite}
          className="mt-5 w-full rounded-xl bg-stone-900 px-4 py-3.5 font-medium text-white transition hover:bg-stone-700"
        >
          Continue
        </button>
      </div>
    );
  }

  /* ── step 2: confirm what they meant, tap-only ───────────────────────── */
  if (stage === 'clarify' || stage === 'sending') {
    return (
      <div>
        <Step n={2} of={3} label="What did you mean?" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
          {hits.length > 0 ? (
            <>
              You said{' '}
              <span className="rounded bg-amber-100 px-1.5 text-amber-900">
                &ldquo;{hits[0].keyword}&rdquo;
              </span>
              &nbsp;&mdash; which of these?
            </>
          ) : (
            'Anything we should know?'
          )}
        </h1>
        <p className="mt-1 text-stone-500">
          Tap what applies. Nothing to type — this is the part people actually finish.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {problemTags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={`${chip(selected.includes(t.id))} ${
                suggestedIds.has(t.id) && !selected.includes(t.id) ? 'ring-2 ring-amber-300' : ''
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {positiveTag && (
          <button
            type="button"
            onClick={() => {
              setSelected([]);
              void send();
            }}
            className="mt-4 text-sm text-stone-500 underline underline-offset-4 hover:text-stone-800"
          >
            Actually, {positiveTag.label.toLowerCase()} &rarr;
          </button>
        )}

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

        <button
          type="button"
          disabled={stage === 'sending'}
          onClick={goFromClarify}
          className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3.5 font-medium text-white transition hover:bg-stone-700 disabled:opacity-60"
        >
          {stage === 'sending' ? 'Sending…' : 'Continue'}
        </button>
      </div>
    );
  }

  /* ── step 3: which dish — chips are only what they actually ordered ──── */
  const active = pendingDishTags[0];
  return (
    <div>
      <Step n={3} of={3} label="Which dish?" />
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
        {active ? `${active.label} — which one?` : 'Almost done'}
      </h1>
      <p className="mt-1 text-stone-500">From your order on this visit.</p>

      {active && (
        <div className="mt-5 flex flex-wrap gap-2">
          {dishes.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDishByTag((prev) => ({ ...prev, [active.id]: d.id }))}
              className={chip(dishByTag[active.id] === d.id)}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={!!active && !dishByTag[active.id]}
        onClick={() => {
          if (pendingDishTags.length <= 1) void send();
        }}
        className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3.5 font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
      >
        {pendingDishTags.length > 1 ? 'Next' : 'Send review'}
      </button>
    </div>
  );
}

function Step({ n, of, label }: { n: number; of: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {Array.from({ length: of }, (_, i) => (
          <span
            key={i}
            className={`h-1 w-8 rounded-full ${i < n ? 'bg-stone-800' : 'bg-stone-200'}`}
          />
        ))}
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</span>
    </div>
  );
}
