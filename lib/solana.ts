// Solana devnet integration — server-side only.
//
// Two things happen here, and only the second one is load-bearing:
//
//   1. Issuing a reward mints a real SPL token and sends it to the diner's devnet
//      wallet. Visible on Solana Explorer — the reward is not a number in our database.
//
//   2. The restaurant dashboard's "redeemed?" status is READ FROM THE CHAIN, not from
//      our JSON. That is what makes Solana functionally necessary here rather than
//      decorative: delete our database and the redemption truth still exists.
//
// Redemption model: one token, 0 decimals, supply 1. Holding it = unredeemed.
// Redeeming burns it, so an on-chain balance of 0 means "already used" — a fact no
// restaurant can quietly rewrite, which is the whole point for the diner.

import fs from 'node:fs';
import path from 'node:path';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  burn,
  createMint,
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from '@solana/spl-token';
import bs58 from 'bs58';

const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet');

export function explorerUrl(kind: 'address' | 'tx', value: string): string {
  return `https://explorer.solana.com/${kind}/${value}?cluster=${CLUSTER}`;
}

let connection: Connection | null = null;
export function getConnection(): Connection {
  connection ??= new Connection(RPC, 'confirmed');
  return connection;
}

/* ── keys ────────────────────────────────────────────────────────────────── */

export function getPayer(): Keypair | null {
  const secret = process.env.SOLANA_PAYER_SECRET_KEY;
  if (!secret || secret.startsWith('REPLACE_WITH')) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(secret));
  } catch {
    return null;
  }
}

export function isChainConfigured(): boolean {
  return getPayer() !== null;
}

/**
 * Demo-only: the diners' keypairs live in a gitignored local file so the demo can sign
 * a redemption without a wallet-connect flow. In production the diner signs in their own
 * wallet and this file does not exist — nothing else in the design depends on it.
 */
function getDinerKeypair(dinerId: string): Keypair | null {
  try {
    const file = path.join(process.cwd(), '.wallets', 'wallets.json');
    const wallets = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
    const secret = wallets[dinerId];
    return secret ? Keypair.fromSecretKey(bs58.decode(secret)) : null;
  } catch {
    return null;
  }
}

/* ── issuing ─────────────────────────────────────────────────────────────── */

export interface IssuedToken {
  mint_address: string;
  token_account: string;
  mint_signature: string;
  owner: string;
}

/**
 * Mint a fresh single-supply SPL token and deliver it to the diner's wallet.
 * Each reward is its own mint, so a token identifies exactly which reward it is.
 */
export async function issueRewardToken(dinerWallet: string): Promise<IssuedToken> {
  const payer = getPayer();
  if (!payer) throw new Error('SOLANA_PAYER_SECRET_KEY is not set — run scripts/solana-setup.mjs');

  const conn = getConnection();
  const owner = new PublicKey(dinerWallet);

  const balance = await conn.getBalance(payer.publicKey);
  if (balance < 0.005 * LAMPORTS_PER_SOL) {
    throw new Error(
      `Payer ${payer.publicKey.toBase58()} has ${balance / LAMPORTS_PER_SOL} SOL — fund it at https://faucet.solana.com`,
    );
  }

  // 0 decimals, payer is mint authority, no freeze authority.
  const mint = await createMint(conn, payer, payer.publicKey, null, 0);

  // Creating the diner's associated token account is the "transfer to their wallet" step.
  const ata = await getOrCreateAssociatedTokenAccount(conn, payer, mint, owner);
  const signature = await mintTo(conn, payer, mint, ata.address, payer, 1);

  return {
    mint_address: mint.toBase58(),
    token_account: ata.address.toBase58(),
    mint_signature: signature,
    owner: owner.toBase58(),
  };
}

/* ── reading redemption status FROM THE CHAIN ────────────────────────────── */

export type RedemptionStatus = 'unredeemed' | 'redeemed' | 'not_found' | 'not_minted' | 'unavailable';

export interface ChainRedemption {
  status: RedemptionStatus;
  amount: number | null;
  mint_address: string | null;
  owner: string | null;
  /** Set when the chain could not be reached — the UI says so instead of guessing. */
  error: string | null;
  explorer_url: string | null;
}

const UNAVAILABLE = (mint: string | null, error: string): ChainRedemption => ({
  status: 'unavailable',
  amount: null,
  mint_address: mint,
  owner: null,
  error,
  explorer_url: mint ? explorerUrl('address', mint) : null,
});

/**
 * The dashboard's source of truth for "did they use it?". Note there is no database
 * lookup anywhere in this function — it asks the chain and reports what it says.
 */
export async function readRedemption(
  mintAddress: string | null,
  ownerWallet: string | null,
): Promise<ChainRedemption> {
  // No mint yet is a fact about us, not about the chain — do not report it as an outage.
  if (!mintAddress)
    return { status: 'not_minted', amount: null, mint_address: null, owner: ownerWallet, error: null, explorer_url: null };
  if (!ownerWallet) return UNAVAILABLE(mintAddress, 'No wallet on file');

  try {
    const conn = getConnection();
    const mint = new PublicKey(mintAddress);
    const owner = new PublicKey(ownerWallet);
    const ata = await getAssociatedTokenAddress(mint, owner);

    try {
      const account = await getAccount(conn, ata);
      const amount = Number(account.amount);
      return {
        status: amount > 0 ? 'unredeemed' : 'redeemed',
        amount,
        mint_address: mintAddress,
        owner: ownerWallet,
        error: null,
        explorer_url: explorerUrl('address', mintAddress),
      };
    } catch {
      // No token account: either never delivered, or closed after redemption.
      return {
        status: 'not_found',
        amount: 0,
        mint_address: mintAddress,
        owner: ownerWallet,
        error: null,
        explorer_url: explorerUrl('address', mintAddress),
      };
    }
  } catch (e) {
    // Some RPC failures throw with an empty message — never render a blank reason.
    const message = e instanceof Error && e.message ? e.message : 'Chain read failed';
    return UNAVAILABLE(mintAddress, message);
  }
}

/* ── redeeming ───────────────────────────────────────────────────────────── */

export async function redeemRewardToken(
  mintAddress: string,
  dinerId: string,
): Promise<{ signature: string }> {
  const payer = getPayer();
  const dinerKey = getDinerKeypair(dinerId);
  if (!payer) throw new Error('Chain not configured');
  if (!dinerKey) throw new Error(`No demo wallet for ${dinerId}`);

  const conn = getConnection();
  const mint = new PublicKey(mintAddress);
  const ata = await getAssociatedTokenAddress(mint, dinerKey.publicKey);
  // Burning requires the token owner's signature — the diner's, not the restaurant's.
  const signature = await burn(conn, payer, ata, mint, dinerKey, 1);
  return { signature };
}

/* ── cross-restaurant: what does this wallet hold, anywhere? ─────────────── */

export interface WalletHolding {
  mint_address: string;
  amount: number;
  explorer_url: string;
}

/**
 * Every reward token this wallet holds — asked of the chain by WALLET, not by
 * restaurant. This is why a second restaurant can recognise a diner it has no
 * database row for: the loyalty history belongs to the wallet, not to either venue.
 */
export interface WalletHoldings {
  holdings: WalletHolding[];
  /**
   * Non-null means we could not ask the chain. Kept separate from an empty list on
   * purpose: "this wallet holds nothing" and "we could not find out" are different
   * claims, and rendering a network failure as "no loyalty history" would be a lie.
   */
  error: string | null;
}

export async function listWalletRewards(ownerWallet: string): Promise<WalletHoldings> {
  try {
    const conn = getConnection();
    const owner = new PublicKey(ownerWallet);
    const res = await conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
    const holdings = res.value
      .map((v) => {
        const info = v.account.data.parsed.info;
        return {
          mint_address: info.mint as string,
          amount: Number(info.tokenAmount.amount),
          explorer_url: explorerUrl('address', info.mint as string),
        };
      })
      .sort((a, b) => b.amount - a.amount);
    return { holdings, error: null };
  } catch (e) {
    return { holdings: [], error: e instanceof Error && e.message ? e.message : 'Chain read failed' };
  }
}

/* ── transaction history for wallet UI ───────────────────────────────────── */

export interface WalletTransaction {
  signature: string;
  block_time: number | null;
  /** Human-readable relative time. */
  time_label: string;
  explorer_url: string;
}

/**
 * Recent transaction signatures for a wallet — displayed in the diner's wallet page.
 * Limited to last 20 transactions to avoid slow RPC calls on devnet.
 */
export async function getWalletTransactions(ownerWallet: string): Promise<{
  transactions: WalletTransaction[];
  error: string | null;
}> {
  try {
    const conn = getConnection();
    const owner = new PublicKey(ownerWallet);
    const sigs = await conn.getSignaturesForAddress(owner, { limit: 20 });

    const now = Date.now() / 1000;
    const transactions: WalletTransaction[] = sigs.map((s) => {
      let time_label = 'unknown';
      if (s.blockTime) {
        const diffSec = now - s.blockTime;
        if (diffSec < 60) time_label = 'just now';
        else if (diffSec < 3600) time_label = `${Math.floor(diffSec / 60)}m ago`;
        else if (diffSec < 86400) time_label = `${Math.floor(diffSec / 3600)}h ago`;
        else time_label = `${Math.floor(diffSec / 86400)}d ago`;
      }
      return {
        signature: s.signature,
        block_time: s.blockTime ?? null,
        time_label,
        explorer_url: explorerUrl('tx', s.signature),
      };
    });

    return { transactions, error: null };
  } catch (e) {
    return {
      transactions: [],
      error: e instanceof Error && e.message ? e.message : 'Failed to fetch transactions',
    };
  }
}
