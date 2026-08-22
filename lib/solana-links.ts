// Explorer URL building, kept apart from lib/solana.ts on purpose.
//
// lib/solana.ts imports node:fs to read the demo wallet file, so it can never be
// imported by a client component. This module is pure string work, so both sides can
// use it — the same lesson as the evidence labels in lib/plain.ts.

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';

export function explorerUrl(kind: 'address' | 'tx', value: string): string {
  return `https://explorer.solana.com/${kind}/${value}?cluster=${CLUSTER}`;
}
