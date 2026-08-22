'use client';

// Guided review, AI-driven.
//
// There is no keyword matching here any more. Every follow-up option shown to the diner
// comes from Gemini's reading of what they actually wrote and photographed — so the
// options fit the meal ("Lacked enough sauce") instead of a fixed catalogue.
//
// The Gemini call goes through /api/analyze-review, never from this component directly:
// the API key must never reach the browser bundle.

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { submitReview } from '@/app/actions';
import type { Dish } from '@/lib/types';

type Stage = 'write' | 'analysing' | 'followups' | 'sending';

interface Analysis {
  sentiment: string;
  issue_category: string;
  specific_dish_mentioned: string | null;
  suggested_followup_options: string[];
  combined_evidence_strength: string;
  owner_summary: string;
  photo_verdict: string;
}

/** Reads a File into base64 with the data: URI prefix stripped, as the API expects. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''));
    };
    reader.onerror = () => reject(new Error('Could not read that image'));
    reader.readAsDataURL(file);
  });
}

export function GuidedReview({
  orderId,
  restaurantName,
  dishes,
  redirectTo,
  hideIntro,
}: {
  orderId: string;
  restaurantName: string;
  /** Shown for context only — the server derives the real dish list from the order. */
  dishes: Dish[];
  redirectTo?: string;
  hideIntro?: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('write');
  const [text, setText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [photo, setPhoto] = useState<{ name: string; preview: string; base64: string } | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.');
      return;
    }
    if (file.size > 3_000_000) {
      setError('That photo is too large — please pick one under 3MB.');
      return;
    }
    try {
      const base64 = await toBase64(file);
      setPhoto({ name: file.name, preview: URL.createObjectURL(file), base64 });
    } catch {
      setError('Could not read that image.');
    }
  }

  async function analyse() {
    setStage('analysing');
    setError(null);
    try {
      const res = await fetch('/api/analyze-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          reviewText: text.trim(),
          base64ImageData: photo?.base64,
        }),
      });
      const data = await res.json();
      const result: Analysis | null = data.analysis ?? null;

      if (!result) {
        setError('We could not read your review just now. You can still send it.');
        setStage('write');
        return;
      }

      setAnalysis(result);

      const wantsFollowups =
        (result.sentiment === 'negative' || result.sentiment === 'neutral') &&
        Array.isArray(result.suggested_followup_options) &&
        result.suggested_followup_options.length > 0;

      if (wantsFollowups) {
        setStage('followups');
      } else {
        await send(result, []);
      }
    } catch {
      setError('We could not reach our review helper. Please try again.');
      setStage('write');
    }
  }

  async function send(result: Analysis, followups: string[]) {
    setStage('sending');
    setError(null);
    try {
      await submitReview({
        order_id: orderId,
        free_text: text.trim(),
        rating: rating ?? 3,
        analysis: {
          issue_category: result.issue_category,
          combined_evidence_strength: result.combined_evidence_strength,
          specific_dish_mentioned: result.specific_dish_mentioned,
          owner_summary: result.owner_summary,
          photo_verdict: result.photo_verdict,
        },
        followups,
        had_photo: !!photo,
        photo_base64: photo?.base64 ?? null,
      });
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setError('Could not save that — try again.');
      setStage('followups');
    }
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-2 text-sm transition ${
      active
        ? 'border-stone-800 bg-stone-800 text-white'
        : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500'
    }`;

  /* ── loading ─────────────────────────────────────────────────────────── */
  if (stage === 'analysing' || stage === 'sending') {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-700" />
        <p className="mt-4 font-medium text-stone-900">
          {stage === 'analysing' ? 'Checking your review…' : 'Sorting your reward…'}
        </p>
        <p className="mt-1 text-sm text-stone-500">
          {photo && stage === 'analysing'
            ? 'Reading your photo too — this takes a few seconds.'
            : 'One moment.'}
        </p>
      </div>
    );
  }

  /* ── follow-ups, entirely from the AI ────────────────────────────────── */
  if (stage === 'followups' && analysis) {
    return (
      <div>
        <Step n={2} of={2} label="One more tap" />
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-stone-900">
          Which of these fits best?
        </h2>
        <p className="mt-1 text-stone-500">
          Tap what applies — it helps the kitchen fix the right thing.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {analysis.suggested_followup_options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() =>
                setChosen((prev) =>
                  prev.includes(option) ? prev.filter((x) => x !== option) : [...prev, option],
                )
              }
              className={chip(chosen.includes(option))}
            >
              {option}
            </button>
          ))}
        </div>

        {photo && (
          <p className="mt-4 text-sm text-stone-500">
            {analysis.photo_verdict === 'verified_with_photo'
              ? '📸 Your photo backs this up — that earns you more.'
              : analysis.photo_verdict === 'rejected'
                ? "📸 We couldn't use that photo, but your written feedback still counts."
                : '📸 Photo received.'}
          </p>
        )}

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

        <button
          type="button"
          onClick={() => void send(analysis, chosen)}
          className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3.5 font-medium text-white transition hover:bg-stone-700"
        >
          Confirm and get my reward
        </button>
        <button
          type="button"
          onClick={() => void send(analysis, [])}
          className="mt-2 w-full text-sm text-stone-500 underline underline-offset-4 hover:text-stone-800"
        >
          None of these &rarr;
        </button>
      </div>
    );
  }

  /* ── write: rating, text, optional photo ─────────────────────────────── */
  return (
    <div>
      <Step n={1} of={2} label="How was it?" />
      {!hideIntro && (
        <>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">
            How was {restaurantName}?
          </h2>
          <p className="mt-1 text-stone-500">
            A word or two is plenty — we&rsquo;ll ask the rest.
          </p>
        </>
      )}

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
        maxLength={2000}
        placeholder="e.g. the chicken was a bit dry"
        className="mt-5 w-full rounded-xl border border-stone-300 bg-white p-3.5 text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
      />

      {/* optional photo */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pickPhoto(e.target.files?.[0])}
      />

      {photo ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.preview}
            alt="Your photo of the meal"
            className="h-14 w-14 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-stone-800">{photo.name}</p>
            <p className="text-xs text-stone-500">A photo can earn you a bigger reward.</p>
          </div>
          <button
            type="button"
            onClick={() => setPhoto(null)}
            className="shrink-0 text-sm text-stone-500 underline underline-offset-4"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white px-4 py-3 text-sm text-stone-600 transition hover:border-stone-500"
        >
          📷 Add a photo <span className="text-stone-400">(optional — earns more)</span>
        </button>
      )}

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      <button
        type="button"
        disabled={!text.trim() && !photo}
        onClick={() => void analyse()}
        className="mt-5 w-full rounded-xl bg-stone-900 px-4 py-3.5 font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
      >
        Continue
      </button>
      {!text.trim() && !photo && (
        <p className="mt-2 text-center text-xs text-stone-400">
          Write a few words or add a photo to continue.
        </p>
      )}
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
