// End-to-end devnet proof: mint -> deliver -> read -> burn -> read again.
//
//   node scripts/solana-smoke.mjs
//
// The two reads are the point. The first says the token is in the diner's wallet, the
// second says it is gone — and neither answer comes from our JSON.

import fs from 'node:fs';

for (const line of fs.existsSync('.env.local')
  ? fs.readFileSync('.env.local', 'utf8').split('\n')
  : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const {
  issueRewardToken,
  readRedemption,
  redeemRewardToken,
  listWalletRewards,
  isChainConfigured,
  explorerUrl,
  getPayer,
  getConnection,
} = await import('../lib/solana.ts');

const rule = '─'.repeat(74);
const fail = (m) => {
  console.error(`\nFAILED: ${m}`);
  process.exit(1);
};

if (!isChainConfigured()) fail('SOLANA_PAYER_SECRET_KEY not set — run scripts/solana-setup.mjs');

const diners = JSON.parse(fs.readFileSync('data/diners.json', 'utf8'));
const diner = diners.find((d) => !d.wallet_address.startsWith('MOCK_WALLET'));
if (!diner) fail('No devnet wallets — run scripts/solana-setup.mjs');

const payer = getPayer();
const balance = await getConnection().getBalance(payer.publicKey);
console.log(`${rule}\n  DEVNET SMOKE TEST\n${rule}`);
console.log(`  payer   ${payer.publicKey.toBase58()}  (${balance / 1e9} SOL)`);
console.log(`  diner   ${diner.id} ${diner.wallet_address}`);
if (balance === 0) fail(`payer has no SOL — fund ${payer.publicKey.toBase58()} at https://faucet.solana.com`);

console.log('\n  1. minting + delivering...');
const issued = await issueRewardToken(diner.wallet_address);
console.log(`     mint  ${issued.mint_address}`);
console.log(`     tx    ${explorerUrl('tx', issued.mint_signature)}`);

console.log('\n  2. reading redemption status from chain...');
const before = await readRedemption(issued.mint_address, diner.wallet_address);
console.log(`     status=${before.status} amount=${before.amount}`);
if (before.status !== 'unredeemed') fail(`expected unredeemed, got ${before.status}`);

console.log('\n  3. wallet holdings (queried by wallet, not by restaurant)...');
const { holdings, error } = await listWalletRewards(diner.wallet_address);
if (error) fail(`wallet read failed: ${error}`);
console.log(`     ${holdings.length} token account(s); this mint present: ${holdings.some((h) => h.mint_address === issued.mint_address)}`);

console.log('\n  4. redeeming (burn, signed by the diner)...');
const { signature } = await redeemRewardToken(issued.mint_address, diner.id);
console.log(`     tx    ${explorerUrl('tx', signature)}`);

console.log('\n  5. reading again — same query, different answer...');
const after = await readRedemption(issued.mint_address, diner.wallet_address);
console.log(`     status=${after.status} amount=${after.amount}`);
if (after.status !== 'redeemed') fail(`expected redeemed, got ${after.status}`);

console.log(`\n${rule}\n  PASS — redemption truth lives on chain, not in our database.\n${rule}`);
