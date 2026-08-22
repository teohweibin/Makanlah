# Mock data fixtures

All times are stored as **`days_ago` offsets**, never hardcoded dates — the dataset
stays valid whenever the demo is run. Resolve to a `Date` at read time.

| File | Entity |
|---|---|
| `config.json` | Thresholds for the core logic spec |
| `restaurants.json` | Anchor restaurant + struggling restaurant (`is_struggling: true`) |
| `diners.json` | 4 demo diners, each with an `expected_flag` the engine must reproduce |
| `orders.json` | Order history (drives baseline cadence) |
| `app_open_events.json` | Separate from orders — this is what makes silent-churn detectable |
| `reviews.json` | Guided-review history (source of *strong* evidence) |
| `guided_review_tags.json` | Tag catalog + keywords for the keyword-based matcher |
| `intervention_lookup.json` | Reason→Intervention rules **and** the presentation spec (icon/colour/copy) |
| `reward_tokens.json` | Reward tokens; `mint_address` filled at step 5. Redemption truth = chain, not this file |
| `interventions.json` | Prior-cycle campaigns, so Win-back rate has history on day one |
| `sustained_return_records.json` | Prior-cycle outcomes, so Sustained Return has a trend on day one |

## The four demo paths

| Diner | Baseline | Days since | Flag | Evidence | Intervention |
|---|---|---|---|---|---|
| Aina | 14d | 46d | `at_risk` | strong (review tagged `dish_dry:dish_ayam_percik`) | `dish_fix_reward` |
| Bryan | 7d | 29d | `at_risk` | strong (review tagged `wait_time_long`) | `priority_seating` |
| Chandra | 10d | 18d (under threshold) | `silent_churn` | weak (4 app opens, 0 orders in 14d) | `reorder_nudge` |
| Dahlia | 20d | 70d | `at_risk` | none (no review history) | `neutral_invite` |

Aina also has an order **and** a reward token at `rest_kedai_pakcik` — the same wallet
under a second restaurant context, which is the cross-restaurant recognition beat in step 5.

Note: the `declining_spend → value_bundle` row of the lookup table has no dedicated
demo diner (the PRD specifies four). The rule exists and the engine supports it; add a
fifth diner with a falling `amount` trend if you want it shown on screen.

All diner names are fictional and labelled as demo profiles. Wallet addresses are
placeholder strings until step 5 — no keys are committed.
