# MakanLagi

**Helping restaurants keep the customers they've already earned.**

Built for DevLeague Lab 4 — Customer Experience & Engagement.

A restaurant loses a regular and never finds out why. The diner doesn't complain, they
just stop coming. MakanLagi catches that moment: it notices when a regular's rhythm
breaks, works out *why* from what they actually told you, and sends each person the one
message that fits their reason — not the same coupon to everybody.

Rewards are SPL tokens on Solana. Whether a reward has been used is read from the
diner's wallet, not from our database, so no venue can quietly rewrite it and the reward
travels with the diner between restaurants.

---

## Demo route

The fastest path through the whole loop:

| # | Where | What to show |
|---|---|---|
| 1 | `/diner` | Write "the chicken was a bit dry", optionally attach a photo |
| 2 | — | Gemini reads text **and** photo, returns follow-up options written for *this* meal |
| 3 | — | Tap one → reward confirmation, SPL token minted to the diner's devnet wallet |
| 4 | `/dashboard` | The diner now appears with the AI's own summary, not a template |
| 5 | `/diner` → **Use Reward** | 6-digit code, valid 10 minutes |
| 6 | `/dashboard` → **Redeem a reward** | Enter the code → token **burned on devnet** |
| 7 | `/diner` | Same reward now reads "Already used" — because the chain says so |

Then switch the dashboard to the second restaurant to show the same wallet recognised
somewhere it has almost no history.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS v4 |
| Data | JSON fixtures in `/data` |
| AI | Google Gemini (`gemini-3.6-flash`, multimodal) |
| Chain | Solana devnet via `@solana/web3.js` + `@solana/spl-token` |
| Animation | GSAP |

---

## Running it locally

### 1. Install

```bash
npm install
```

### 2. Environment

Copy the template and fill in your own keys:

```bash
cp .env.example .env.local
```

`.env.local` is gitignored and must never be committed.

| Variable | Needed for | Get it from |
|---|---|---|
| `GEMINI_API_KEY` | Review analysis | https://aistudio.google.com/apikey |
| `SOLANA_PAYER_SECRET_KEY` | Minting rewards | Written by `npm run chain:setup` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Chain reads | Defaults to public devnet |

### 3. Solana devnet setup

```bash
npm run chain:setup      # generates payer + demo diner wallets, writes .env.local
```

If the faucet rate-limits you (common), fund the printed payer address manually at
https://faucet.solana.com and re-run. Then:

```bash
npm run chain:fixtures   # mints the seeded reward tokens
npm run chain:smoke      # end-to-end: mint → read → burn → read
```

`chain:smoke` passing is the signal that the chain half works.

### 4. Run

```bash
npm run dev
```

---

## Routes

**Diner**

| Path | Purpose |
|---|---|
| `/diner` | Hub: tonight's order, guided review, My Rewards, Discover, Settings |
| `/diner/[dinerId]/wallet` | Full wallet view with QR codes |
| `/diner/[dinerId]/invite/[restaurantId]` | Win-back invitation |
| `/order/[orderId]/review` | Standalone review flow |
| `/discover` | Discover & Support pool |

**Restaurant**

| Path | Purpose |
|---|---|
| `/dashboard` | Owner entry point |
| `/restaurant/[id]` | Dashboard: today's action, drifting regulars, redeem, metrics |
| `/restaurant/[id]/diner/[dinerId]` | Why one diner was flagged, with their photo and words |

**API**

| Path | Purpose |
|---|---|
| `POST /api/analyze-review` | The only route to Gemini — the key never reaches the browser |

---

## How the logic works

Thresholds live in [`data/config.json`](data/config.json); the maths lives in
[`lib/engine.ts`](lib/engine.ts) as pure functions.

```
baseline_cadence  = average(days between consecutive orders)
                    requires >= 3 orders, otherwise we do not guess

at_risk           = days_since_last_order > 2 x baseline_cadence

silent_churn      = opened the app inside the window AND ordered zero times in it

evidence_strength = verified_with_photo | strong | weak | none

sustained_return  = recovered if cadence 30 days after a win-back is within
                    ±20% of baseline; pending if fewer than 30 days have passed
```

`evidence_strength` decides both the message and the reward:

| Evidence | Reward | Owner sees |
|---|---|---|
| `verified_with_photo` | 15% | Verified — photo + review |
| `strong` | 10% | Verified from review |
| `weak` / `none` | **0%** | Inferred from behavior / No signal |
| photo rejected or suspicious | **0%** | — |

Vague feedback and untrusted photos earn nothing, but **the review is still recorded and
still reaches the owner** — withholding a reward is not the same as silencing a complaint.

Reward size is decided by [`lib/reward.ts`](lib/reward.ts), never by the model's own
`reward_multiplier`. The model proposes evidence quality; our code decides what it is
worth, and a hard cap (`max_reward_percent`) applies to every path.

---

## Why Solana is load-bearing

Not decoration — remove it and two things stop being true:

1. **Redemption is a burn, not a flag.** Entering a code burns the SPL token on devnet.
   There is no `redeemed = true` column anywhere. A restaurant cannot mark a reward used
   without the chain agreeing, and cannot un-burn one.
2. **The dashboard reads redemption from the chain.** `readRedemption()` queries the
   diner's token account. If devnet is unreachable the UI says so rather than falling
   back to our JSON — a fallback would make the integration indistinguishable from a
   database.

That also makes rewards **portable**: a diner arriving at a second restaurant is
recognised through their wallet, not through a customer row that venue never had.

---

## AI review analysis

[`lib/analyzeReview.ts`](lib/analyzeReview.ts) sends the review text and optional photo
to Gemini in **one** multimodal call and gets back structured JSON: sentiment, issue
category, the specific dish, follow-up options, a photo verdict, and a plain-English
summary written for the owner.

There is no keyword matching anywhere. Every follow-up option shown to a diner is
generated for that meal — which is why they read like *"Lacked enough sauce"* rather than
coming from a fixed list.

The photo verdict is a plausibility judgment, not forensics. It catches stock images and
screenshots; it will not reliably catch someone photographing a real burnt chicken from
somewhere else. The honest claim is that it *raises the cost* of faking a complaint.

Model choice matters: `gemini-1.5-flash` is retired and `gemini-2.5-flash` still appears
in ListModels but 404s for new keys. Both verified against the live API. Override with
`GEMINI_MODEL` if needed.

---

## Verification

```bash
npm run verify        # core logic against the fixtures — all four diner paths
npm run chain:smoke   # mint → read → burn → read on real devnet
```

`npm run verify` is the guard on the four demo personas: Aina (dish issue, strong
evidence), Bryan (wait time, strong), Chandra (silent churn, weak), Dahlia (no signal).
If a change breaks one of those paths, this catches it. **Check the exit code** — a
failure can print nothing.

---

## Known limits

Read this before demoing.

- **All runtime state is in memory.** Submitted reviews, photos, redemption codes,
  accepted invitations and the nudge toggle live in the server process and are wiped on
  restart. Run each demo beat in one continuous session, and don't rebuild mid-demo.
- **This breaks on serverless.** On Vercel each request may hit a different instance, so
  a redemption code issued on one will not be found on another. Making the deployment
  fully work needs external storage (Redis) for `lib/store.ts` and `lib/redemption.ts`.
- **Redemption needs the demo wallets.** Burning a token requires the diner's key from
  `.wallets/wallets.json`, which is gitignored and exists only on the machine that ran
  `chain:setup`. In production the diner signs in their own wallet; this file is a demo
  shortcut.
- **`verified_with_photo` has never fired in testing.** Every photo tried so far came
  back `rejected`. The 15% tier, the 📷 badge and the "photo + review" label are built
  and unit-tested but unproven against a real Gemini verdict. **Test with a genuine photo
  of a plate before demoing** — under the current policy the failure mode is 0%.
- **Gemini takes 7–14 seconds**, shown as "Checking your review…". Variance is wide.
- **The API route is unauthenticated** — fine for a local demo, needs a rate limit before
  any public deploy.
- **No auth anywhere.** `/diner?as=diner_b` shows another diner's screen. Scoping is by
  URL parameter, not by login.
- **The public devnet RPC rate-limits.** A dedicated endpoint would remove that risk.

---

## Working on this

Branch per feature, merge through pull requests. Never push to `main`.

```bash
git checkout main
git pull origin main
git checkout -b your-branch
# work, then
git add .
git commit -m "description of change"
git push origin your-branch
```

Two traps that have already cost time here:

- **`components/ui.tsx` is a client component.** Importing anything from it into a server
  page fails at *runtime* with a perfectly green typecheck. Shared vocabulary belongs in
  `lib/` — see `lib/plain.ts` and `lib/solana-links.ts`.
- **Content inside a `<Suspense>` boundary was arriving un-hydrated**, so interactive
  elements rendered but did nothing. If you wrap a section containing buttons, check the
  buttons actually respond.

Sweep the routes after every merge — a green build does not prove the pages render:

```bash
for u in "" dashboard diner discover restaurant/rest_warung_mama; do printf "%-40s " "/$u"; curl -s -o /dev/null -w "%{http_code}\n" -L "http://localhost:3000/$u"; done
```

---

## Security

- No keys, seed phrases or `.env` files in the repo — `.gitignore` covers `.env.*` and
  `.wallets/`
- `.env.example` holds placeholders only
- All diner data is fictional and labelled as demo profiles
- Diner photos are sent to Google for analysis and held in server memory; they are never
  written to disk or committed

**Never commit `.wallets/wallets.json`.** It contains devnet private keys and this is a
public repository.
