// Keeps asking the devnet faucet for SOL until the payer is funded or attempts run out.
// The public faucet rate-limits by IP, so a retry loop is usually the difference between
// "devnet is broken" and "devnet needed five minutes".
//
//   node scripts/solana-fund-retry.mjs [attempts]

import fs from 'node:fs';
import path from 'node:path';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const attempts = Number(process.argv[2] ?? 40);
const wallets = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), '.wallets', 'wallets.json'), 'utf8'),
);
const payer = Keypair.fromSecretKey(bs58.decode(wallets.payer));
const connection = new Connection(RPC, 'confirmed');

console.log(`payer ${payer.publicKey.toBase58()}`);

for (let i = 1; i <= attempts; i++) {
  const balance = await connection.getBalance(payer.publicKey);
  if (balance >= 0.05 * LAMPORTS_PER_SOL) {
    console.log(`FUNDED: ${balance / LAMPORTS_PER_SOL} SOL after ${i - 1} retries`);
    process.exit(0);
  }
  try {
    const sig = await connection.requestAirdrop(payer.publicKey, 1 * LAMPORTS_PER_SOL);
    const bh = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, ...bh }, 'confirmed');
    console.log(`FUNDED on attempt ${i}: ${sig}`);
    process.exit(0);
  } catch {
    process.stdout.write(`.`);
  }
  await new Promise((r) => setTimeout(r, 20_000));
}
console.log(`\nstill unfunded after ${attempts} attempts`);
process.exit(1);
