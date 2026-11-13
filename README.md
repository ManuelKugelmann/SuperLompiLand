# Super Lompi Land

**▶ Play:** [Release](https://manuelkugelmann.github.io/SuperLompiLand/) · [Dev (latest push)](https://manuelkugelmann.github.io/SuperLompiLand/dev/)

A colorful 2D pufferfish game — underwater, Super Mario Land-ish — built as an
installable PWA with **switchable control schemes** for experimentation.

## Stack

- **Phaser 3** + **Matter.js** physics
- **Vite** build
- **PWA** (installable) via `vite-plugin-pwa`

## Run

```bash
npm install
npm run dev        # dev server (service-worker OFF in dev)
npm run build      # production build -> dist/
npm run serve      # zero-dep static server for dist/ (tests the real PWA/SW)
```

## Controls — switchable live (top-center switcher)

Swap any time in-game:

| Scheme | Move | Special (puff) |
|---|---|---|
| **Stick** | floating virtual stick, drag to swim | quick tap on the stick |
| **Tap-to-Move** | tap the water, fish swims there | tap on the fish |
| **Schleuder** (slingshot) | pull the fish back & release (Angry-Birds), aim slow-mo | — |

Add a scheme in `game/controls/` and register it in `game/controls/index.js` — it
appears in the switcher automatically. A physics-debug toggle is top-right.

## Deploy — GitHub Pages (dev/release routing)

`peaceiris/actions-gh-pages` with `keep_files`:

- `main` → `https://<owner>.github.io/<repo>/` — **release**
- any other branch → `https://<owner>.github.io/<repo>/<slug>/` — **dev preview**
- deleting a branch removes its preview (`cleanup.yml`)

Build base is injected per branch (`--base`), so subfolder deploys resolve assets
correctly. Enable Pages once with source = `gh-pages` branch.

Any static host works too (plain `dist/`): Uberspace (`rsync dist/ → ~/html`),
Netlify / Vercel / Cloudflare Pages (drag-drop or git).

## Layout

```
scenes/        Intro / Main / End
game/          Pufferfish entity, control schemes, in-game UI
systems/       progression (localStorage)
scripts/       icon generator, static server
```
