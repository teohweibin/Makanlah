'use client';

// Interactive dish cards — tap a dish to expand, tap tags to flag issues.
//
// Key change: supports reviewing MULTIPLE dishes in one session. Each dish gets
// category-appropriate tags (food vs beverage). The diner builds up a list of
// per-dish feedback, then submits it all at once.

import { useState } from 'react';
import type { Dish, GuidedReviewTag } from '@/lib/types';

/** One dish's feedback — what the diner selected for this specific item. */
export interface DishFeedback {
  dishId: string;
  dishName: string;
  category: 'food' | 'beverage';
  tagIds: string[];
}

interface DishCardsProps {
  dishes: Dish[];
  tags: GuidedReviewTag[];
  currency: string;
  /** Called when the diner is done selecting feedback for all dishes. */
  onSubmit: (feedback: DishFeedback[]) => void;
  /** Called when the diner says "all good" — no issues with anything. */
  onAllGood: () => void;
}

export function DishCards({ dishes, tags, currency, onSubmit, onAllGood }: DishCardsProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // Track selected tags per dish
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  /** Tags appropriate for a given dish category. */
  function tagsForDish(dish: Dish): GuidedReviewTag[] {
    return tags.filter(
      (t) =>
        t.requires_dish &&
        t.reason_type !== 'none' &&
        (t.dish_category === dish.category || t.dish_category === null),
    );
  }

  function toggleTag(dishId: string, tagId: string) {
    setSelections((prev) => {
      const current = prev[dishId] ?? [];
      const next = current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId];
      return { ...prev, [dishId]: next };
    });
  }

  /** How many dishes have at least one tag selected. */
  const feedbackCount = Object.values(selections).filter((tags) => tags.length > 0).length;

  function handleSubmit() {
    const feedback: DishFeedback[] = dishes
      .filter((d) => (selections[d.id]?.length ?? 0) > 0)
      .map((d) => ({
        dishId: d.id,
        dishName: d.name,
        category: d.category,
        tagIds: selections[d.id],
      }));
    onSubmit(feedback);
  }

  // Separate food and beverages
  const foods = dishes.filter((d) => d.category === 'food');
  const beverages = dishes.filter((d) => d.category === 'beverage');

  return (
    <div className="space-y-3">
      {/* food items */}
      {foods.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            🍽️ Food
          </p>
          <div className="space-y-2">
            {foods.map((dish) => (
              <DishCard
                key={dish.id}
                dish={dish}
                tags={tagsForDish(dish)}
                currency={currency}
                expanded={expanded === dish.id}
                selectedTags={selections[dish.id] ?? []}
                onExpand={() => setExpanded(expanded === dish.id ? null : dish.id)}
                onToggleTag={(tagId) => toggleTag(dish.id, tagId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* beverage items */}
      {beverages.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            🥤 Beverages
          </p>
          <div className="space-y-2">
            {beverages.map((dish) => (
              <DishCard
                key={dish.id}
                dish={dish}
                tags={tagsForDish(dish)}
                currency={currency}
                expanded={expanded === dish.id}
                selectedTags={selections[dish.id] ?? []}
                onExpand={() => setExpanded(expanded === dish.id ? null : dish.id)}
                onToggleTag={(tagId) => toggleTag(dish.id, tagId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* general experience tags (not dish-specific) */}
      <GeneralTags tags={tags} selections={selections} onToggle={(tagId) => toggleTag('_general', tagId)} />

      {/* actions */}
      <div className="mt-4 space-y-2">
        {feedbackCount > 0 ? (
          <button
            type="button"
            onClick={handleSubmit}
            className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-3.5 font-medium text-white transition hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
          >
            Submit feedback ({feedbackCount} item{feedbackCount > 1 ? 's' : ''} flagged)
          </button>
        ) : (
          <button
            type="button"
            onClick={onAllGood}
            className="w-full rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success-light)] px-4 py-3.5 text-sm font-medium text-[var(--color-success)] transition hover:bg-[var(--color-success)]/15 active:scale-[0.98]"
          >
            ✓ Everything was great
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Individual Dish Card ────────────────────────────────────────────────── */

function DishCard({
  dish,
  tags,
  currency,
  expanded,
  selectedTags,
  onExpand,
  onToggleTag,
}: {
  dish: Dish;
  tags: GuidedReviewTag[];
  currency: string;
  expanded: boolean;
  selectedTags: string[];
  onExpand: () => void;
  onToggleTag: (tagId: string) => void;
}) {
  const hasIssues = selectedTags.length > 0;

  return (
    <div
      className={`animate-slide-up overflow-hidden rounded-xl border transition-all ${
        hasIssues
          ? 'border-[var(--color-warning)]/40 bg-[var(--color-warning-light)]/50'
          : expanded
            ? 'border-[var(--color-ink)]/20 bg-white shadow-sm'
            : 'border-[var(--color-ink)]/10 bg-white hover:border-[var(--color-ink)]/20'
      }`}
    >
      {/* header */}
      <button
        type="button"
        onClick={onExpand}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="text-lg" aria-hidden>
          {dish.category === 'beverage' ? '🥤' : '🍽️'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--color-ink)]">{dish.name}</p>
          <p className="text-sm text-[var(--color-muted)]">
            {currency} {dish.price.toFixed(2)}
          </p>
        </div>
        {hasIssues && (
          <span className="rounded-full bg-[var(--color-warning)] px-2 py-0.5 text-xs font-medium text-white">
            {selectedTags.length} issue{selectedTags.length > 1 ? 's' : ''}
          </span>
        )}
        <span
          className={`text-[var(--color-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {/* expanded: category-appropriate tags */}
      {expanded && (
        <div className="border-t border-[var(--color-ink)]/5 px-4 pb-4 pt-3">
          <p className="mb-2 text-sm text-[var(--color-muted)]">
            {dish.category === 'beverage' ? 'How was this drink?' : 'Anything off about this?'}
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onToggleTag(tag.id)}
                  className={`rounded-full border px-3.5 py-2 text-sm transition active:scale-95 ${
                    active
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                      : 'border-[var(--color-ink)]/15 bg-white text-[var(--color-ink)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── General Experience Tags (not dish-specific) ─────────────────────────── */

function GeneralTags({
  tags,
  selections,
  onToggle,
}: {
  tags: GuidedReviewTag[];
  selections: Record<string, string[]>;
  onToggle: (tagId: string) => void;
}) {
  const generalTags = tags.filter((t) => !t.requires_dish && t.reason_type !== 'none');
  if (generalTags.length === 0) return null;

  const selected = selections['_general'] ?? [];

  return (
    <div className="rounded-xl border border-[var(--color-ink)]/10 bg-white px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Overall experience
      </p>
      <div className="flex flex-wrap gap-2">
        {generalTags.map((tag) => {
          const active = selected.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggle(tag.id)}
              className={`rounded-full border px-3.5 py-2 text-sm transition active:scale-95 ${
                active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                  : 'border-[var(--color-ink)]/15 bg-white text-[var(--color-ink)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]'
              }`}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
