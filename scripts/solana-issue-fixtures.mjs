// Mints the seeded reward tokens from data/reward_tokens.json on devnet, so the
// dashboard has real on-chain state to read on the very first demo run.
//
//   node scripts/solana-issue-fixtures.mjs
//
// Tokens the fixture marks `redeemed: true` are additionally BURNED, so the chain
// genuinely says "already used" rather than us claiming it does. Mint addresses are
// public data and are written back into the fixture — safe to commit.

import fs from 'node:fs';
import path from 'node:path';

// .env.local is not auto-loaded outside Next.
for (const line of fs.existsSync('.env.local')
  ? fs.readFileSync('.env.local', 'utf8').split('\n')
  : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const { issueRewardToken, readRedemption, redeemRewardToken, isChainConfigured, explorerUrl } =
  await import('../lib/solana.ts');

if (!isChainConfigured()) {
  console.error('SOLANA_PAYER_SECRET_KEY not set. Run: node scripts/solana-setup.mjs');
  process.exit(1);
}

const TOKENS_FILE = path.join(process.cwd(), 'data', 'reward_tokens.json');
const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
const diners = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'diners.json'), 'utf8'));

for (const token of tokens) {
  if (!token.id) continue;
  const diner = diners.find((d) => d.id === token.diner_id);
  if (!diner || diner.wallet_address.startsWith('MOCK_WALLET')) {
    console.log(`skip ${token.id}: no devnet wallet`);
    continue;
  }

  if (!token.mint_address) {
    process.stdout.write(`minting ${token.id} for ${token.diner_id}... `);
    const issued = await issueRewardToken(diner.wallet_address);
    token.mint_address = issued.mint_address;
    console.log(`${issued.mint_address}`);
    console.log(`   ${explorerUrl('tx', issued.mint_signature)}`);
  }

  // Make the chain match what the fixture claims about redemption.
  const onChain = await readRedemption(token.mint_address, diner.wallet_address);
  if (token.redeemed && onChain.status === 'unredeemed') {
    process.stdout.write(`   burning (fixture says redeemed)... `);
    const { signature } = await redeemRewardToken(token.mint_address, token.diner_id);
    console.log(`done ${signature.slice(0, 16)}...`);
  }
}

fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2) + '\n');
console.log('\nmint addresses written to data/reward_tokens.json');

console.log('\nOn-chain state now:');
for (const token of tokens) {
  if (!token.id || !token.mint_address) continue;
  const diner = diners.find((d) => d.id === token.diner_id);
  const r = await readRedemption(token.mint_address, diner.wallet_address);
  console.log(`  ${token.id.padEnd(14)} ${token.restaurant_id.padEnd(18)} ${r.status.padEnd(11)} amount=${r.amount}`);
}
