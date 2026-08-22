'use client';

// ReviewFlow — orchestrates multi-dish review submission.
//
// The diner taps dishes, selects category-appropriate tags for each one,
// then submits all feedback at once. The result is stored categorized by dish.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DishCards, type DishFeedback } from '@/components/DishCards';
import { submitReview } from '@/app/actions';
import type { Dish, GuidedReviewTag } from '@/lib/types';

interface ReviewFlowProps {
  orderId: string;
  restaurantName: string;
  dishes: Dish[];
  tags: GuidedReviewTag[];
  currency: string;
}

export function ReviewFlow({ orderId, restaurantName, dishes, tags, currency }: ReviewFlowProps) {
  const router = useRouter();
  const [stage, setStage] = useState<'dishes' | 'sending' | 'error'>('dishes');
  const [error, setError] = useState<string | null>(null);

  async function handleFeedbackSubmit(feedback: DishFeedback[]) {
    setStage('sending');
    setError(null);

    // Convert multi-dish feedback into guided_tags format: "tag_id:dish_id"
    const guided_tags: string[] = [];
    for (const item of feedback) {
      for (const tagId of item.tagIds) {
        guided_tags.push(`${tagId}:${item.dishId}`);
      }
    }

    try {
      const result = await submitReview({
        order_id: orderId,
        free_text: '',
        guided_tags,
        rating: 3,
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

    const positiveTag = tags.find((t) => t.reason_type === 'none');
    try {
      await submitReview({
        order_id: orderId,
        free_text: '',
        guided_tags: positiveTag ? [positiveTag.id] : [],
        rating: 5,
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-stone-800" />
        <p className="mt-3 text-sm text-stone-500">Sending your feedback…</p>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => setStage('dishes')}
          className="mt-3 text-sm text-stone-600 underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <DishCards
      dishes={dishes}
      tags={tags}
      currency={currency}
      onSubmit={handleFeedbackSubmit}
      onAllGood={handleAllGood}
    />
  );
}
