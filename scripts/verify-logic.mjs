// Step 2 verification — runs the core logic against the mock fixtures and prints
// the result, per the build order ("verified with print/log output before any UI exists").
//
//   node scripts/verify-logic.mjs
//
// Node 24 strips the TypeScript types at runtime, so this imports lib/*.ts directly.

import {
  baselineCadence, dashboardMetrics, daysBetweenConsecutiveOrders, daysSinceLastOrder,
  evaluateRestaurant, isAtRisk, isSilentChurn, matchTagsFromText, ordersFor,
  recomputeSustainedReturn, selectIntervention, spendTrend, sustainedReturnStatus,
} from '../lib/engine.ts';
import { ANCHOR_RESTAURANT_ID, SECOND_RESTAURANT_ID, loadDataset } from '../lib/fixtures.ts';

const ds = loadDataset();
const failures = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(`${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  return ok;
};

const rule = '─'.repeat(78);
const pct = (n) => `${Math.round(n * 100)}%`;
const num = (n) => (n === null ? 'n/a' : Number.isInteger(n) ? String(n) : n.toFixed(2));

console.log(`\n${rule}\n  MAKANLAGI — core logic run against mock fixtures\n${rule}`);
console.log(`  config: at_risk = days_since > ${ds.config.at_risk_multiplier} x baseline`
  + ` | min ${ds.config.min_orders_for_baseline} orders`
  + ` | silent-churn window ${ds.config.silent_churn_window_days}d`
  + ` | sustained +/-${pct(ds.config.sustained_return_tolerance)} after ${ds.config.sustained_return_eval_days}d`);

/* ── 1. per-diner evaluation at the anchor restaurant ───────────────────── */

const anchor = ds.restaurants.find((r) => r.id === ANCHOR_RESTAURANT_ID);
console.log(`\n${rule}\n  1. PER-DINER EVALUATION — ${anchor.name}\n${rule}`);

for (const diner of ds.diners) {
  const orders = ordersFor(ds, diner.id, ANCHOR_RESTAURANT_ID);
  const gaps = daysBetweenConsecutiveOrders(orders);
  const baseline = baselineCadence(orders, ds.config);
  const since = daysSinceLastOrder(orders);
  const atRisk = isAtRisk(orders, ds.config);
  const silent = isSilentChurn(ds, diner.id, ANCHOR_RESTAURANT_ID);
  const trend = spendTrend(orders);

  const row = evaluateRestaurant(ds, ANCHOR_RESTAURANT_ID).find((f) => f.diner.id === diner.id);
  const exp = diner.expected_flag;
  const actual = row
    ? {
        status: row.flag.status,
        reason_type: row.flag.reason_type,
        evidence_strength: row.flag.evidence_strength,
        intervention_type: row.intervention_type,
      }
    : { status: 'none', reason_type: null, evidence_strength: null, intervention_type: null };
  const ok = check(`${diner.id} flag`, actual, exp);

  console.log(`\n  ${ok ? 'PASS' : 'FAIL'}  ${diner.name}  [${diner.demo_role}]`);
  console.log(`        orders=${orders.length}  gaps=[${gaps.join(', ')}]`
    + `  baseline_cadence=${num(baseline)}d  days_since_last_order=${num(since)}`);
  console.log(`        at_risk        : ${since} > ${ds.config.at_risk_multiplier} x ${num(baseline)}`
    + ` (= ${num(baseline === null ? null : baseline * ds.config.at_risk_multiplier)}) -> ${atRisk}`);
  console.log(`        silent_churn   : opens_in_${ds.config.silent_churn_window_days}d>0`
    + ` AND orders_in_${ds.config.silent_churn_window_days}d==0 -> ${silent}`);
  console.log(`        spend_trend    : ${trend === null ? 'n/a' : pct(trend)}`
    + ` (declining threshold ${pct(-ds.config.declining_spend_threshold)})`);
  console.log(`        => status=${actual.status}  reason=${actual.reason_type}`
    + `  evidence=${actual.evidence_strength}  intervention=${actual.intervention_type}`);
  if (row) {
    console.log(`        evidence [${row.flag.evidence_source}]: ${row.flag.evidence_note}`);
    console.log(`        headline: "${row.headline}"`);
  }
  if (!ok) console.log(`        EXPECTED: ${JSON.stringify(exp)}`);
}

/* ── 2. dashboard ordering ──────────────────────────────────────────────── */

const flagged = evaluateRestaurant(ds, ANCHOR_RESTAURANT_ID);
console.log(`\n${rule}\n  2. DASHBOARD LIST ORDER (strong evidence first, then longest absence)\n${rule}`);
flagged.forEach((f, i) => {
  const p = ds.interventionLookup.presentation[f.intervention_type];
  console.log(`  ${i + 1}. ${p.icon}  ${f.diner.name.padEnd(24)} ${f.flag.status.padEnd(13)}`
    + ` ${f.flag.evidence_strength.padEnd(7)} ${f.intervention_type.padEnd(17)} [${p.tag_label}]`);
});
check('flag count at anchor', flagged.length, 4);

/* ── 3. second restaurant — history guard ───────────────────────────────── */

const second = ds.restaurants.find((r) => r.id === SECOND_RESTAURANT_ID);
const secondFlags = evaluateRestaurant(ds, SECOND_RESTAURANT_ID);
console.log(`\n${rule}\n  3. SECOND RESTAURANT — ${second.name}\n${rule}`);
console.log(`  flagged diners: ${secondFlags.length}`);
console.log(`  Aina has 1 order here — under the ${ds.config.min_orders_for_baseline}-order minimum,`
  + ` so no baseline exists and she is correctly NOT flagged.`);
console.log(`  (Her reward token here is still hers — that is the cross-restaurant beat in step 5.)`);
check('no flags without enough history', secondFlags.length, 0);

/* ── 4. lookup table — every row ────────────────────────────────────────── */

console.log(`\n${rule}\n  4. REASON -> INTERVENTION LOOKUP (all 5 rows + fallback)\n${rule}`);
for (const r of ds.interventionLookup.rules) {
  const got = selectIntervention(r.reason_type, r.evidence_strength, ds.interventionLookup);
  const ok = check(`lookup ${r.reason_type}/${r.evidence_strength}`, got, r.intervention_type);
  const p = ds.interventionLookup.presentation[got];
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.reason_type.padEnd(16)} + ${r.evidence_strength.padEnd(7)}`
    + ` -> ${got.padEnd(17)} ${p.icon} ${p.tag_color.padEnd(7)} "${p.headline_template}"`);
}
const fallback = selectIntervention('dish_issue', 'none', ds.interventionLookup);
console.log(`  ${check('fallback', fallback, 'neutral_invite') ? 'PASS' : 'FAIL'}`
  + `  dish_issue       + none    -> ${fallback} (unmatched combination falls back)`);

/* ── 5. synthetic edge cases the four fixture diners do not cover ───────── */

console.log(`\n${rule}\n  5. EDGE CASES\n${rule}`);

const twoOrders = [
  { id: 'x1', diner_id: 'x', restaurant_id: 'r', dish_ids: [], days_ago: 40, amount: 20 },
  { id: 'x2', diner_id: 'x', restaurant_id: 'r', dish_ids: [], days_ago: 10, amount: 20 },
];
console.log(`  ${check('2 orders -> no baseline', baselineCadence(twoOrders, ds.config), null) ? 'PASS' : 'FAIL'}`
  + `  2 past orders -> baseline_cadence = null (not enough history, do not flag)`);
console.log(`  ${check('2 orders -> not at risk', isAtRisk(twoOrders, ds.config), false) ? 'PASS' : 'FAIL'}`
  + `  2 past orders -> at_risk = false even though the gap is huge`);

const declining = [
  { id: 'y1', diner_id: 'y', restaurant_id: 'r', dish_ids: [], days_ago: 60, amount: 40 },
  { id: 'y2', diner_id: 'y', restaurant_id: 'r', dish_ids: [], days_ago: 45, amount: 38 },
  { id: 'y3', diner_id: 'y', restaurant_id: 'r', dish_ids: [], days_ago: 30, amount: 22 },
  { id: 'y4', diner_id: 'y', restaurant_id: 'r', dish_ids: [], days_ago: 15, amount: 20 },
];
const dtrend = spendTrend(declining);
const dOk = check('declining spend detected', dtrend <= -ds.config.declining_spend_threshold, true);
console.log(`  ${dOk ? 'PASS' : 'FAIL'}  declining spend: ${pct(dtrend)} -> `
  + `${selectIntervention('declining_spend', 'weak', ds.interventionLookup)}`
  + `  (no fixture diner uses this row — verified synthetically)`);

const kw = matchTagsFromText('I waited ages and the chicken was dry', ds.guidedReviewTags).map((t) => t.id);
console.log(`  ${check('keyword match', kw, ['dish_dry', 'wait_time_long']) ? 'PASS' : 'FAIL'}`
  + `  keyword matcher on "I waited ages and the chicken was dry" -> [${kw.join(', ')}]`);

/* ── 6. sustained return + metrics ──────────────────────────────────────── */

console.log(`\n${rule}\n  6. SUSTAINED RETURN (+/-${pct(ds.config.sustained_return_tolerance)} of baseline,`
  + ` evaluated after ${ds.config.sustained_return_eval_days}d)\n${rule}`);
for (const r of recomputeSustainedReturn(ds)) {
  const band = `${num(r.baseline_cadence * (1 - ds.config.sustained_return_tolerance))}`
    + `-${num(r.baseline_cadence * (1 + ds.config.sustained_return_tolerance))}d`;
  const seeded = ds.sustainedReturnRecords.find((s) => s.diner_id === r.diner_id).status;
  const ok = check(`sustained ${r.diner_id}`, r.status, seeded);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.diner_id.padEnd(9)} baseline=${num(r.baseline_cadence)}d`
    + `  post=${r.post_win_back_cadence_30d === null ? 'n/a' : num(r.post_win_back_cadence_30d) + 'd'}`
    + `  band=${band}`
    + `  win_back ${r.win_back_days_ago}d ago -> ${r.status}`);
}
const pendingOk = check(
  'under 30 days -> pending',
  sustainedReturnStatus(14, 14, 12, ds.config),
  'pending',
);
console.log(`  ${pendingOk ? 'PASS' : 'FAIL'}  perfect cadence but only 12 days elapsed -> pending`);

const m = dashboardMetrics(ds, ANCHOR_RESTAURANT_ID);
console.log(`\n  Metrics view:`);
console.log(`    Win-back rate     : ${m.won_back}/${m.interventions_sent} = ${pct(m.win_back_rate)}`);
console.log(`    Sustained return  : ${m.sustained_recovered}/${m.sustained_evaluated} = `
  + `${pct(m.sustained_return_rate)}  (${m.sustained_pending} pending)`);

/* ── result ─────────────────────────────────────────────────────────────── */

console.log(`\n${rule}`);
if (failures.length) {
  console.log(`  ${failures.length} FAILURE(S):`);
  failures.forEach((f) => console.log(`    - ${f}`));
  console.log(rule);
  process.exit(1);
}
console.log('  ALL CHECKS PASSED — core logic matches the spec on every fixture path.');
console.log(rule + '\n');
