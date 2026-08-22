'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap-config';
import { Card } from '@/components/ui';
import type { MerchantActionItem } from '@/lib/engine';

function ChecklistRow({
  item,
  isFixed,
  sentCount,
  onToggle,
}: {
  item: MerchantActionItem;
  isFixed: boolean;
  sentCount: number;
  onToggle: () => void;
}) {
  const rowRef = useRef<HTMLLIElement | null>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!rowRef.current || !textRef.current) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      gsap.set(rowRef.current, { opacity: isFixed ? 0.5 : 1 });
      gsap.set(textRef.current, {
        opacity: isFixed ? 0.5 : 1,
        textDecoration: isFixed ? 'line-through' : 'none',
      });
      return;
    }

    gsap.to(rowRef.current, {
      opacity: isFixed ? 0.5 : 1,
      duration: 0.3,
      ease: 'power2.out',
    });

    gsap.to(textRef.current, {
      opacity: isFixed ? 0.5 : 1,
      textDecoration: isFixed ? 'line-through' : 'none',
      duration: 0.3,
      ease: 'power2.out',
    });
  }, [isFixed]);

  const dinersLabel = `${item.count} diner${item.count === 1 ? '' : 's'}`;

  return (
    <li
      ref={rowRef}
      className="flex items-center gap-3 px-4 py-3 transition-all duration-200"
    >
      <input
        type="checkbox"
        checked={isFixed}
        onChange={onToggle}
        aria-label={`${item.issueText} reported by ${dinersLabel}`}
        className="h-4 w-4 rounded border-stone-300 text-[var(--color-verified)] focus:ring-[var(--color-verified)]"
      />

      <div className="min-w-0 flex-1">
        <p
          ref={textRef}
          className={`text-sm font-medium text-stone-900 ${
            isFixed ? 'decoration-2' : ''
          }`}
        >
          {item.issueText} — reported by {dinersLabel}
        </p>
        {sentCount > 0 && (
          <p className="mt-1 text-[11px] font-medium text-[var(--color-verified)]">
            Sent to {sentCount} diner{sentCount === 1 ? '' : 's'}.
          </p>
        )}
      </div>

      <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-600">
        {dinersLabel}
      </span>
    </li>
  );
}

export function MerchantActionChecklist({
  merchantId,
  items,
}: {
  merchantId: string;
  items: MerchantActionItem[];
}) {
  const [fixedById, setFixedById] = useState<Record<string, boolean>>({});
  const [sentById, setSentById] = useState<Record<string, { count: number; template: string }>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const fixedRaw = window.localStorage.getItem(`merchant-action-checklist:${merchantId}:fixed`);
    const sentRaw = window.localStorage.getItem(`merchant-action-checklist:${merchantId}:sent`);

    if (fixedRaw) {
      try {
        setFixedById(JSON.parse(fixedRaw) as Record<string, boolean>);
      } catch {
        window.localStorage.removeItem(`merchant-action-checklist:${merchantId}:fixed`);
      }
    }

    if (sentRaw) {
      try {
        setSentById(JSON.parse(sentRaw) as Record<string, { count: number; template: string }>);
      } catch {
        window.localStorage.removeItem(`merchant-action-checklist:${merchantId}:sent`);
      }
    }
  }, [merchantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      `merchant-action-checklist:${merchantId}:fixed`,
      JSON.stringify(fixedById),
    );
  }, [fixedById, merchantId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      `merchant-action-checklist:${merchantId}:sent`,
      JSON.stringify(sentById),
    );
  }, [sentById, merchantId]);

  const sendFixMessage = (item: MerchantActionItem) => {
    if (!item.linkedDiners.length) return;
    setSentById((prev) => ({
      ...prev,
      [item.id]: {
        count: item.linkedDiners.length,
        template: item.linkedMessageTemplate,
      },
    }));
  };

  const toggleFixed = (item: MerchantActionItem) => {
    const nextFixed = !Boolean(fixedById[item.id] ?? item.fixed);
    setFixedById((prev) => ({
      ...prev,
      [item.id]: nextFixed,
    }));

    if (nextFixed) {
      sendFixMessage(item);
    } else {
      setSentById((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="display-font mb-3 text-xl font-semibold tracking-tight text-stone-900">
        Merchant action checklist
      </h2>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-stone-100">
          {items.map((item) => {
            const isFixed = Boolean(fixedById[item.id] ?? item.fixed);
            const sentState = sentById[item.id];
            const sentCount = sentState?.count ?? 0;

            return (
              <ChecklistRow
                key={item.id}
                item={item}
                isFixed={isFixed}
                sentCount={sentCount}
                onToggle={() => toggleFixed(item)}
              />
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
