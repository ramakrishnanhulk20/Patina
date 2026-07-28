---
id: patina
name: Patina
status: live
externalUrl: https://patinadata.xyz
icon: P
iconUrl: https://patinadata.xyz/icon.svg
builderName: Ram
description: Turn the history in accounts you already own into portable proof you are a real person.
category: Identity
scopes:
  - youtube.profile
  - instagram.posts
  - github.profile
  - spotify.profile
---

## Builder

- Name: Ram
- Contact: ramakrishnanhulk20@gmail.com
- Repo: https://github.com/ramakrishnanhulk20/Patina

## Demo

- Demo URL: https://patinadata.xyz/connect
- Standings: https://patinadata.xyz/standings

## Notes

Anyone can make a new account. Nobody can make an old one.

Patina scores how much *time* is behind someone's accounts, and weights every
signal by how expensive it is in years rather than in money. Age and continuity
are earned outright; volume, followers and breadth only count to the extent
real elapsed history backs them up, because an account farm can manufacture all
three in an afternoon and cannot manufacture a decade.

Measured against real data: eleven years of ordinary history across four
accounts scores 76, a genuinely young but real three-year account scores 31, and
a farm with 3,900 bought followers and 120 posts uploaded in one week scores 6.

Why it needs the protocol: reading someone's history conventionally means OAuth,
which hands the raw data over and keeps it. Here the data stays in the user's
Personal Server, is read once under a revocable grant, and the resulting proof
can be checked by another app without the user repeating any of it.

Limits are stated on the site itself rather than buried: it reports how much
history it can see, which is evidence and not a certificate; a low score is not
an accusation, since young or private accounts legitimately score low; and an
aged account can be bought, which makes the attack expensive rather than
impossible.

Sign-in is required before connecting, so a profile belongs to a person rather
than to a browser, and one human on a phone and a laptop stays one score.
