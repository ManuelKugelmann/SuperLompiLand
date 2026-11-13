# Feedback relay

Small Cloudflare Worker that turns in-game feedback into GitHub issues
(label `player-feedback`). The game never holds a token.

Checks, in order: page origin, optional place filter (country / region / city
from the sender's IP), optional family code, 42 posts per hour in total.

## One-time setup

```bash
cd worker/feedback
npx wrangler login
npx wrangler kv namespace create RATE        # paste the id into wrangler.toml
npx wrangler secret put GITHUB_TOKEN         # fine-grained token: Issues read & write, this repo only
npx wrangler secret put FAMILY_CODE          # optional
npx wrangler deploy                          # prints the worker URL
```

Then put the worker URL into `FEEDBACK_URL` in `game/feedback.js` and deploy the game.
Without a URL the feedback entry stays hidden.

Place filter: set `ALLOWED_COUNTRY` (and optionally region / city) in
`wrangler.toml`. IP location is approximate — treat it as a filter against
strangers, not as a lock; the family code is the reliable gate.
