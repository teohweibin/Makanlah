// One-time redemption codes.
//
// The code is a handoff mechanism, not the record of redemption. The record is the
// burned token on devnet. A code just lets a diner prove, across a counter, which of
// their tokens they mean — without the restaurant needing their wallet key.
//
// In memory only: a code is worthless after ten minutes and after one use, so there is
// nothing worth persisting. Production would put this in Redis with the same TTL.

const TTL_MS = 10 * 60 * 1000;

export interface RedemptionCode {
  code: string;
  mint_address: string;
  diner_id: string;
  issued_at: number;
  expires_at: number;
  used_at: number | null;
}

interface CodeStore {
  codes: RedemptionCode[];
}

const globalStore = globalThis as unknown as { __makanlagi_codes?: CodeStore };
const store: CodeStore = (globalStore.__makanlagi_codes ??= { codes: [] });

const isLive = (c: RedemptionCode, now = Date.now()) => !c.used_at && c.expires_at > now;

/** Drop codes that are spent or long expired, so the list cannot grow forever. */
function sweep(now = Date.now()): void {
  store.codes = store.codes.filter((c) => c.expires_at > now - TTL_MS);
}

function randomSixDigits(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
}

/**
 * Issues a code for one specific token. Re-tapping the same reward returns the existing
 * live code rather than minting a second one — two valid codes for one token would let
 * a diner hand the same reward to two counters.
 */
export function createRedemptionCode(mintAddress: string, dinerId: string): RedemptionCode {
  sweep();
  const existing = store.codes.find((c) => c.mint_address === mintAddress && isLive(c));
  if (existing) return existing;

  let code = randomSixDigits();
  // Collisions are unlikely but not impossible, and a collision would redeem the wrong
  // person's reward — so keep drawing until the code is unique among live ones.
  const liveCodes = new Set(store.codes.filter((c) => isLive(c)).map((c) => c.code));
  let guard = 0;
  while (liveCodes.has(code) && guard++ < 50) code = randomSixDigits();

  const now = Date.now();
  const entry: RedemptionCode = {
    code,
    mint_address: mintAddress,
    diner_id: dinerId,
    issued_at: now,
    expires_at: now + TTL_MS,
    used_at: null,
  };
  store.codes.push(entry);
  return entry;
}

export type CodeLookup =
  | { ok: true; entry: RedemptionCode }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_used' };

export function lookupCode(code: string): CodeLookup {
  sweep();
  const entry = store.codes.find((c) => c.code === code.trim());
  if (!entry) return { ok: false, reason: 'not_found' };
  if (entry.used_at) return { ok: false, reason: 'already_used' };
  if (entry.expires_at <= Date.now()) return { ok: false, reason: 'expired' };
  return { ok: true, entry };
}

/** Called only after the on-chain burn confirms — never before. */
export function markCodeUsed(code: string): void {
  const entry = store.codes.find((c) => c.code === code);
  if (entry) entry.used_at = Date.now();
}

export function getLiveCodeForMint(mintAddress: string): RedemptionCode | undefined {
  sweep();
  return store.codes.find((c) => c.mint_address === mintAddress && isLive(c));
}

export const REDEMPTION_TTL_MS = TTL_MS;
