# Multiplayer relay

A tiny WebSocket relay for "swim together": one Durable Object per room. It
forwards fish state and emotes between the (at most 4) players of a room and
keeps nothing. Rooms vanish when empty.

The game works without it: until `RELAY_URL` is set in `net/config.js`, players
connect peer-to-peer (Trystero, signalling over public relays). The relay is the
more dependable path — no NAT or carrier problems, one server you control.

## What it sees

- A room **hash** in the URL (derived on the device from the room name with
  PBKDF2; the name never leaves the device), so it cannot list or guess rooms.
- Fish state (position, speed, facing, puff, character) and emote ids. No names,
  no text, no accounts. Frames are size-capped and type-checked; clients that
  flood or send junk are dropped.

## Deploy (once, on your own Cloudflare account — free plan is enough)

```bash
cd worker/relay
npx wrangler deploy
```

Then put the address it prints into `net/config.js`:

```js
export const RELAY_URL = 'wss://lompi-relay.<account>.workers.dev';
```

and push. `ALLOWED_ORIGINS` in `wrangler.toml` lists the pages that may connect.

## Free-plan budget

Durable Objects use the hibernation API, so an idle room costs nothing. Incoming
WebSocket messages count towards the daily request quota (100 000/day on the free
plan when this was written). A two-player session sends ~20 state messages per
second per player. If every message counted in full that would be only about
**40 minutes of two-player play per day**; Cloudflare bills incoming WebSocket
messages at a reduced ratio, which stretches this a lot — check the current
pricing page before relying on a number. To stretch it further, raise `SEND_MS`
in `game/Multiplayer.js`. The peer-to-peer path has no such limit.
