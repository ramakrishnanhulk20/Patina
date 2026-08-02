# Patina

**Anyone can make a new account. Nobody can make an old one.**

Patina reads the history in accounts a person already owns and turns it into
portable evidence that a real human has been there for years. Built on the
[Vana](https://vana.org) data portability protocol, where the data stays in the
user's own Personal Server and is read once, under a grant they can revoke.

Live at **[patinadata.xyz](https://patinadata.xyz)**.

---

## The problem

Sybil resistance is unsolved and expensive. An airdrop, a quadratic funding
round, a DAO vote or a free trial all need to know whether they are talking to a
thousand people or to one person with a thousand wallets. The usual answers are
poor: biometrics are invasive, KYC destroys privacy, and most behavioural
signals the internet relies on today can simply be bought.

Somebody running an account farm can buy followers, bulk-upload posts and fill
in a convincing profile. What they cannot buy is **a decade**.

## The approach

Patina scores five things, weighted by how expensive each one is in *time*
rather than in money.

| Signal | Max | What it measures |
| --- | --- | --- |
| **Age** | 40 | The oldest date provable across every connected source |
| **Corroboration** | 20 | How many *independent* sources prove that date, weighted by how old each is |
| **Depth** | 20 | Posts, videos and repositories actually made |
| **Standing** | 10 | Others treating you as real. Weighted low: followers are buyable |
| **Breadth** | 10 | Independent accounts corroborating each other |

Corroboration replaced an earlier **Continuity** signal that counted distinct
months of post history. That was the better measure and it turned out to be
unreachable: per-item timestamps only existed on scopes the desktop app
collects, so on the web it scored zero for everybody and made a quarter of the
total unwinnable. A score with points nobody can earn is not a strict score,
it is a broken one.

Age and corroboration are earned outright. Everything else is **gated behind
them**: an attacker can manufacture breadth, depth and followers in an
afternoon, so those only count to the extent that real elapsed history backs
them up. A floor of 15% stops a genuinely young person being flattened to zero
for the crime of being nineteen.

Scored against representative profiles, under the weights above:

| | Score |
| --- | --- |
| Eleven years of ordinary history across four accounts | **83** |
| Genuinely young: three years, two accounts, real | **23** |
| Account farm: 3,900 bought followers, 120 posts in one week | **5** |

The gap between the first and last row is the whole product. The middle row is
the one to keep an eye on: a real person with a short history scores low by
design, and the further that sits above zero the better, because a low score is
evidence of absence rather than an accusation.

## Why this needs Vana

Delete the protocol and the product stops being expressible.

Reading someone's Instagram or GitHub history conventionally means OAuth, which
hands the raw data to whoever asked and keeps it indefinitely. Users refuse, and
platforms eventually shut it down. Vana inverts that: the data lives in the
user's own Personal Server, an app pays a per-read fee to see only the scopes
that were granted, the grant is revocable, and **another app can verify the same
proof without the user repeating any of it**. That last property is what makes a
portable score possible at all.

## Honest limits

Stated on the site itself, not buried here:

- **It cannot prove personhood.** It reports how much real history it can see.
  That is evidence, not a certificate.
- **A low score is not an accusation.** Young, private or quiet accounts score
  low and are doing nothing wrong.
- **Aged accounts can be bought.** That turns a free attack into an expensive
  one whose price climbs with age. It does not make it impossible.

## Running it

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

You will need a Vana app identity. Create or register one at
[account.vana.org/developers](https://account.vana.org/developers), put the key
in `.env.local`, then:

```bash
npm run register:moksha
```

Fund the app's escrow from the same page (faucet VANA on testnet, USDC.e on
mainnet) and connect a source at
[app.vana.org/sources](https://app.vana.org/sources) so there is something to
read.

### Commands

| | |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Scoring, normalisation and store tests |
| `npm run typecheck` | Types, against a config that ignores generated route types |
| `npm run verify` | Typecheck, tests, and a production build into a separate dist dir |

## Notes for anyone reading the code

- **`src/lib/score.ts`** is the whole argument. Every weight carries a comment
  explaining why it is what it is.
- **`src/lib/normalize.ts`** exists because Vana's server-side collection
  returns a different shape from the JSON Schemas published for the desktop
  connectors: the payload arrives inside an `items[]` array with different field
  names. Both shapes are handled, and a real captured payload is pinned in the
  tests so an upstream change breaks a test rather than the live site.
- **`src/app/connect/useConnect.ts`** replaces the SDK's popup helper with a
  same-tab redirect. Popups get blocked on mobile and background tabs are
  suspended mid-poll, which strands people at the exact moment they have
  approved.
- **Grants are keyed to the (user, app) pair, not to the scope.** Approving a
  second source *replaces* the first one's scopes, so every read is persisted
  when it happens. There is exactly one chance to read each source.

## Licence

MIT — see [LICENSE](LICENSE).
