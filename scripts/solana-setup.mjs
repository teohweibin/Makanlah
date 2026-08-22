// One-time devnet setup:
//   1. generate a payer keypair + one demo wallet per diner
//   2. write the SECRETS to .wallets/wallets.json  (gitignored — never commit this)
//   3. write the PUBLIC KEYS into data/diners.json (safe to commit)
//   4. try to fund the payer from the devnet faucet
//
//   node scripts/solana-setup.mjs
//
// If the faucet is rate-limiting (429 / "Internal error"), fund the printed payer
// address manually at https://faucet.solana.com and re-run — existing keys are reused.

import fs from 'node:fs';
import path from 'node:path';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const WALLET_DIR = path.join(process.cwd(), '.wallets');
const WALLET_FILE = path.join(WALLET_DIR, 'wallets.json');
const DINERS_FILE = path.join(process.cwd(), 'data', 'diners.json');
const ENV_FILE = path.join(process.cwd(), '.env.local');

const diners = JSON.parse(fs.readFileSync(DINERS_FILE, 'utf8'));

/* ── 1 + 2: keys ─────────────────────────────────────────────────────────── */

fs.mkdirSync(WALLET_DIR, { recursive: true });
let wallets = fs.existsSync(WALLET_FILE) ? JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')) : {};

const keyFor = (id) => {
  if (!wallets[id]) {
    wallets[id] = bs58.encode(Keypair.generate().secretKey);
    console.log(`  generated ${id}`);
  }
  return Keypair.fromSecretKey(bs58.decode(wallets[id]));
};

console.log('Keys:');
const payer = keyFor('payer');
const dinerKeys = Object.fromEntries(diners.map((d) => [d.id, keyFor(d.id)]));
fs.writeFileSync(WALLET_FILE, JSON.stringify(wallets, null, 2) + '\n');
console.log(`  secrets -> .wallets/wallets.json (gitignored)`);

/* ── 3: public keys into the fixture ─────────────────────────────────────── */

let changed = false;
for (const d of diners) {
  const pub = dinerKeys[d.id].publicKey.toBase58();
  if (d.wallet_address !== pub) {
    d.wallet_address = pub;
    changed = true;
  }
}
if (changed) {
  fs.writeFileSync(DINERS_FILE, JSON.stringify(diners, null, 2) + '\n');
  console.log('  public keys -> data/diners.json');
}

if (!fs.existsSync(ENV_FILE)) {
  fs.writeFileSync(
    ENV_FILE,
    [
      '# Local only — .env.* is gitignored. Regenerate with scripts/solana-setup.mjs.',
      'NEXT_PUBLIC_SOLANA_CLUSTER=devnet',
      `NEXT_PUBLIC_SOLANA_RPC_URL=${RPC}`,
      `SOLANA_PAYER_SECRET_KEY=${wallets.payer}`,
      '',
    ].join('\n'),
  );
  console.log('  payer secret -> .env.local (gitignored)');
}

/* ── 4: funding ──────────────────────────────────────────────────────────── */

const connection = new Connection(RPC, 'confirmed');
console.log(`\nPayer: ${payer.publicKey.toBase58()}`);

let balance = await connection.getBalance(payer.publicKey);
console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

if (balance < 0.05 * LAMPORTS_PER_SOL) {
  console.log('\nRequesting airdrop...');
  for (const amount of [1, 0.5, 0.2]) {
    try {
      const sig = await connection.requestAirdrop(payer.publicKey, amount * LAMPORTS_PER_SOL);
      const bh = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
      balance = await connection.getBalance(payer.publicKey);
      console.log(`  funded ${amount} SOL -> ${balance / LAMPORTS_PER_SOL} SOL total`);
      break;
    } catch (e) {
      console.log(`  ${amount} SOL failed: ${String(e.message).slice(0, 80)}`);
    }
  }
}

if (balance < 0.01 * LAMPORTS_PER_SOL) {
  console.log('\n  NOT FUNDED. The public faucet is rate-limiting this IP.');
  console.log('  Fund this address manually, then re-run this script:');
  console.log(`\n    ${payer.publicKey.toBase58()}\n`);
  console.log('  Web faucet:  https://faucet.solana.com  (pick devnet, paste the address)');
  console.log('  Or via CLI:  solana airdrop 2 <address> --url devnet');
  process.exit(1);
}

console.log('\nWallets ready:');
for (const d of diners) console.log(`  ${d.id.padEnd(8)} ${dinerKeys[d.id].publicKey.toBase58()}`);
console.log('\nNext: node scripts/solana-issue-fixtures.mjs');
