'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap-config';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const foodDecor = ['🍜', '🍗', '🥘', '🍚', '🧆'];

const howItWorks = [
  {
    icon: '🗣️',
    title: 'You share feedback',
    body: 'After your meal, tell us what was great or what could be better. Two taps, no typing.',
  },
  {
    icon: '🎁',
    title: 'You earn a real reward',
    body: 'Get an instant discount on your bill — verified on the blockchain, owned by you.',
  },
  {
    icon: '❤️',
    title: 'Your favourite place gets better',
    body: 'The restaurant sees exactly what to fix. You get a reason to come back.',
  },
];

export default function Landing() {
  const revealRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      revealRefs.current.forEach((el) => {
        if (!el) return;
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.filter = 'none';
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const elements = revealRefs.current.filter(Boolean) as HTMLElement[];
    if (!elements.length) return;

    gsap.fromTo(
      elements,
      {
        opacity: 0,
        y: 32,
        filter: 'blur(6px)',
      },
      {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.9,
        ease: 'power2.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: elements[0],
          start: 'top 82%',
          once: true,
        },
      },
    );

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  const setRevealRef = (index: number) => (el: HTMLElement | null) => {
    revealRefs.current[index] = el;
  };

  return (
    <main className="bg-[var(--color-paper)] text-[var(--color-ink)]">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-25">
          {foodDecor.map((emoji, index) => (
            <span
              key={emoji + index}
              className="absolute text-4xl text-[var(--color-ink)]/20"
              style={{
                left: `${(index * 19 + 9) % 100}%`,
                top: `${(index * 23 + 12) % 70}%`,
                transform: index % 2 === 0 ? 'rotate(-12deg)' : 'rotate(8deg)',
              }}
            >
              {emoji}
            </span>
          ))}
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-10 md:px-8 md:pb-24 md:pt-16">
          <div className="mx-auto max-w-4xl text-center" ref={setRevealRef(0)}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-ink)]/10 bg-white/70 px-4 py-2 text-sm font-medium text-[var(--color-muted)] shadow-sm backdrop-blur-sm">
              <span aria-hidden>🍜</span>
              MakanLagi for neighbourhood favourites
            </div>

            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold leading-[0.95] tracking-tight text-[var(--color-ink)] md:text-6xl">
              Your favourite restaurant misses you. <span aria-hidden>🍜</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)] md:text-xl">
              MakanLagi helps local restaurants understand why regulars drift away — and gives them a real reason to come back.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/dashboard"
                className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--color-accent)] px-6 py-4 text-base font-semibold text-white shadow-[0_12px_26px_rgba(161,61,46,0.18)] transition hover:bg-[var(--color-accent-hover)] sm:w-auto"
              >
                <span aria-hidden>🍳</span>
                I&apos;m a Restaurant Owner
              </Link>

              <Link
                href="/diner"
                className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-[var(--color-ink)]/10 bg-white px-6 py-4 text-base font-semibold text-[var(--color-ink)] shadow-sm transition hover:border-[var(--color-success)]/30 hover:shadow-md sm:w-auto"
              >
                <span aria-hidden>🧆</span>
                I&apos;m a Diner
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20" ref={setRevealRef(1)}>
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">How it works</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)] md:text-4xl">
            A better loop for diners and restaurants
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {howItWorks.map(({ icon, title, body }, index) => (
            <div
              key={title}
              ref={setRevealRef(2 + index)}
              className="rounded-3xl border border-[var(--color-ink)]/8 bg-white p-6 shadow-[0_10px_30px_rgba(26,20,16,0.04)]"
            >
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning-light)] text-2xl shadow-sm">
                <span aria-hidden>{icon}</span>
              </div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">{title}</h3>
              <p className="mt-3 text-base leading-relaxed text-[var(--color-muted)]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white/60 py-16 md:py-20" ref={setRevealRef(5)}>
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">Why Makanlah?</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)] md:text-4xl">
              Built for the people who keep local favourites alive
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div ref={setRevealRef(6)} className="rounded-3xl border border-[var(--color-ink)]/8 bg-[var(--color-paper)] p-7 shadow-[0_10px_30px_rgba(26,20,16,0.04)]">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl" aria-hidden>🧆</span>
                <h3 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
                  For Diners
                </h3>
              </div>

              <ul className="space-y-3 text-base leading-relaxed text-[var(--color-muted)]">
                <li>• Rewards that are actually yours (stored in your wallet, not in our database)</li>
                <li>• No more vague feedback forms — just 2 taps</li>
                <li>• Get rewarded more for adding a photo 📷</li>
                <li>• Discover new local restaurants with bonus points</li>
              </ul>
            </div>

            <div ref={setRevealRef(7)} className="rounded-3xl border border-[var(--color-ink)]/8 bg-[var(--color-paper)] p-7 shadow-[0_10px_30px_rgba(26,20,16,0.04)]">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl" aria-hidden>🍳</span>
                <h3 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
                  For Restaurant Owners
                </h3>
              </div>

              <ul className="space-y-3 text-base leading-relaxed text-[var(--color-muted)]">
                <li>• Know exactly who&apos;s drifting away and why</li>
                <li>• See whether the issue is a dish, wait time, or service — not just a churn score</li>
                <li>• Send one targeted message to win them back</li>
                <li>• Watch whether they actually come back and stay (not just redeem once)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20" ref={setRevealRef(8)}>
        <div className="rounded-[2rem] border border-[var(--color-ink)]/8 bg-[var(--color-success-light)] p-7 shadow-[0_10px_30px_rgba(26,20,16,0.04)] md:p-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-success)]">Built on Solana</p>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)] md:text-4xl">
                Your rewards live in your wallet. Not in our app. <span aria-hidden>🔐</span>
              </h2>
            </div>
            <div className="flex items-center justify-center rounded-3xl border border-[var(--color-ink)]/10 bg-white/80 px-5 py-4 text-4xl shadow-sm">
              <span aria-hidden>🪪</span>
            </div>
          </div>

          <p className="mt-6 max-w-4xl text-lg leading-relaxed text-[var(--color-muted)]">
            Every reward MakanLagi issues is a real token on the Solana blockchain. That means no one can take it away,
            change it, or pretend it was used. When you spend it, it&apos;s burned on-chain — verifiable by anyone.
          </p>

          <p className="mt-4 text-sm text-[var(--color-muted)]">
            Built on Solana devnet · Tokens are real, wallets are real · Demo build
          </p>
        </div>
      </section>

      <footer className="border-t border-[var(--color-ink)]/8 bg-[var(--color-paper)] py-10" ref={setRevealRef(9)}>
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="flex flex-col items-center gap-5 text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">
              MakanLagi <span aria-hidden>🍜</span> · Built for local restaurants and the people who love them
            </p>

            <div className="mt-2 flex flex-col items-center gap-2 text-sm text-[var(--color-muted)] sm:flex-row sm:gap-4">
              <Link href="/dashboard" className="rounded-full border border-[var(--color-ink)]/10 bg-white px-4 py-2 font-medium text-[var(--color-ink)] shadow-sm hover:border-[var(--color-accent)]/30">
                I&apos;m a Restaurant Owner 🍳
              </Link>
              <Link href="/diner" className="rounded-full border border-[var(--color-ink)]/10 bg-white px-4 py-2 font-medium text-[var(--color-ink)] shadow-sm hover:border-[var(--color-success)]/30">
                I&apos;m a Diner 🧆
              </Link>
            </div>

            <p className="pt-2 text-sm text-[var(--color-muted)]">Demo build · DevLeague 2026</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
