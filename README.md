# Token Radar — Survey Chart

[![token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ZiramBayam/makefun-token-radar-v2/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ZiramBayam/makefun-token-radar-v2/reward.svg)](https://make.fun/bounty/token-radar-01)

A nautical survey of protocols before a ticker exists. The board ranks
pre-token protocols by an **implied value** computed only from the sealed
snapshot, and pairs every entry with a concrete, costed plan for farming it.
Protocols whose token already trades are kept in a separate `live` list beside
the board and are never ranked.

The page is "The map before the ticker": each rank is a sounding, each implied
value a depth reading, and the detail drawer is a survey card showing the model
inputs, the arithmetic with those inputs substituted, and the full farm route.

## The value model

One function, `impliedValue(protocol, snapshot)`, scores every pre-token
protocol (one where `mcap_usd`, `gecko_id` and `symbol` are all null):

```
implied = round( tvl^0.86 * 0.42 * growth * tenure * peer * breadth )
growth  = 1 + clamp(change_7d, -60, 120)/100 * 0.6
tenure  = 0.55 + min(age_days, 1460)/1460 * 0.45
peer    = 0.8 + 0.4 * percentile(tvl within its own category)
breadth = 1 + 0.03 * min(chain_count, 8)
```

TVL is compressed by the `0.86` exponent so that a giant protocol cannot bury a
fast-growing peer: a hundred-fold gap in TVL collapses to roughly fifty-fold in
the score, leaving room for growth, age, standing among peers and chain breadth
to change the order. Every other term comes from snapshot fields only — the
seven-day TVL change, the days since DefiLlama began tracking, the protocol's
rank within its own category, and how many chains it runs on. The watchlist is
a floor, not a ceiling; the board carries the highest-scoring pre-token
protocols below it too.

This is the entry's own claim about what a token *would* be worth if the record
stayed as it is. It does not predict whether or when a token is issued, and
make.fun makes no such claim.

## Running it

Node 22+, standard library only:

```
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

This writes `board.json`, `data.js` and `dossier.json` plus copies of the
`dashboard/` and `screenshots/` directories into the output directory. The
three screenshots are produced with the kit's `shots.mjs` helper.

## Enter

This entry was built for the
[make.fun token launch radar bounty](https://make.fun/bounty/token-radar-01).
If you got here through a referral, you can enter through
[this link](https://make.fun/?ref=m91yrre2&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01).
