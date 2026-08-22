'use client';

// ReviewFlow — dish cards (food/beverage categories) + optional text + optional photo.
//
// Primary interaction: tap dishes, pick what's wrong (category-appropriate tags).
// Secondary (optional): add a sentence or photo for a bigger reward.
// Then submits via the submitReview action.

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { DishCards, type DishFeedback } from '@/components/DishCards';
import { submitReview } from '@/app/actions';
import type { Dish, GuidedReviewTag } from '@/lib/types';

interface ReviewFlowProps {
  orderId: string;
  restaurantName: string;
  dishes: Dish[];
  /** Not used by AI flow but kept for tag-based cards. */
  tags?: GuidedReviewTag[];
  currency?: string;
  hideIntro?: boolean;
}

/** Reads a File into base64 (no data: prefix). */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''));
    };
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(file);
  });
}

export function ReviewFlow({ orderId, restaurantName, dishes, tags, currency }: ReviewFlowProps) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<'cards' | 'sending' | 'error'>('cards');
  const [freeText, setFreeText] = useState('');
  const [photo, setPhoto] = useState<{ name: string; preview: string; base64: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load tags from data if not passed
  const reviewTags = tags ?? [];

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) { setError('Not an image.'); return; }
    if (file.size > 3_000_000) { setError('Photo too large (max 3MB).'); return; }
    try {
      const base64 = await toBase64(file);
      setPhoto({ name: file.name, preview: URL.createObjectURL(file), base64 });
    } catch {
      setError('Could not read image.');
    }
  }

  async function handleFeedbackSubmit(feedback: DishFeedback[]) {
    setStage('sending');
    setError(null);

    // Build the analysis object from tag selections.
    // The primary dish issue = first tag from first flagged dish.
    const firstIssue = feedback[0];
    const issueCategory = firstIssue?.tagIds[0] ?? 'no_issue';
    const dishMentioned = firstIssue?.dishName ?? null;

    // Build an owner summary from all selections
    const summaryParts: string[] = [];
    for (const item of feedback) {
      const tagLabels = item.tagIds
        .map((id) => reviewTags.find((t) => t.id === id)?.label ?? id)
        .join(', ');
      summaryParts.push(`${item.dishName}: ${tagLabels}`);
    }
    const ownerSummary = summaryParts.join('; ') || 'General feedback';

    // Evidence strength: tags = strong, photo = verified_with_photo, text only = weak
    let evidenceStrength = 'strong';
    if (photo) evidenceStrength = 'verified_with_photo';

    try {
      // If there's free text or a photo, try the AI endpoint for a better summary
      let aiAnalysis: { issue_category: string; combined_evidence_strength: string; specific_dish_mentioned: string | null; owner_summary: string; photo_verdict: string } | null = null;

      if (freeText.trim() || photo) {
        try {
          const res = await fetch('/api/analyze-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              reviewText: freeText.trim() || ownerSummary,
              base64ImageData: photo?.base64,
            }),
          });
          const data = await res.json();
          if (data.analysis) {
            aiAnalysis = data.analysis;
          }
        } catch {
          // AI failed — fall back to tag-based analysis, that's fine
        }
      }

      const result = await submitReview({
        order_id: orderId,
        free_text: freeText.trim(),
        rating: feedback.length > 0 ? 2 : 5,
        analysis: aiAnalysis ?? {
          issue_category: issueCategory,
          combined_evidence_strength: evidenceStrength,
          specific_dish_mentioned: dishMentioned,
          owner_summary: ownerSummary,
          photo_verdict: photo ? 'verified_with_photo' : 'no_photo',
        },
        followups: feedback.flatMap((f) =>
          f.tagIds.map((id) => reviewTags.find((t) => t.id === id)?.label ?? id),
        ),
        had_photo: !!photo,
        photo_base64: photo?.base64 ?? null,
      });

      if (result && 'ok' in result && !result.ok && 'error' in result) {
        setError(result.error as string);
        setStage('error');
      } else {
        router.refresh();
      }
    } catch {
      setError('Could not save — try again.');
      setStage('error');
    }
  }

  async function handleAllGood() {
    setStage('sending');
    setError(null);

    try {
      await submitReview({
        order_id: orderId,
        free_text: freeText.trim(),
        rating: 5,
        analysis: {
          issue_category: 'none',
          combined_evidence_strength: 'positive',
          specific_dish_mentioned: null,
          owner_summary: freeText.trim() || 'Everything was great',
          photo_verdict: photo ? 'verified_with_photo' : 'no_photo',
        },
        followups: ['Everything was great'],
        had_photo: !!photo,
        photo_base64: photo?.base64 ?? null,
      });
      router.refresh();
    } catch {
      setError('Could not save — try again.');
      setStage('error');
    }
  }

  if (stage === 'sending') {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-ink)]/20 border-t-[var(--color-ink)]" />
        <p className="mt-3 text-sm text-[var(--color-muted)]">Sending your feedback…</p>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
        <button
          type="button"
          onClick={() => setStage('cards')}
          className="mt-3 text-sm text-[var(--color-muted)] underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dish cards — tap to flag issues */}
      <DishCards
        dishes={dishes}
        tags={reviewTags}
        currency={currency ?? 'MYR'}
        onSubmit={handleFeedbackSubmit}
        onAllGood={handleAllGood}
      />

      {/* Optional: free text */}
      <div className="rounded-xl border border-[var(--color-ink)]/10 bg-white px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          💬 Anything else? (optional)
        </p>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="e.g. the sambal was amazing but the rice was cold"
          className="w-full rounded-lg border border-[var(--color-ink)]/10 bg-[var(--color-paper)] p-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/50 focus:border-[var(--color-accent)]/30 focus:outline-none"
        />
      </div>

      {/* Optional: photo */}
      <div className="rounded-xl border border-[var(--color-ink)]/10 bg-white px-4 py-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pickPhoto(e.target.files?.[0])}
        />
        {photo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.preview}
              alt="Your photo"
              className="h-12 w-12 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[var(--color-ink)]">{photo.name}</p>
              <p className="text-xs text-[var(--color-success)]">📸 Photo earns a bigger reward</p>
            </div>
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="text-xs text-[var(--color-muted)] underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-ink)]/15 bg-[var(--color-paper)] px-4 py-3 text-sm text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/30"
          >
            📷 Add a photo <span className="text-[var(--color-muted)]/60">(earns more)</span>
          </button>
        )}
        {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    </div>
  );
}
