# Super Lompi Land — working instructions

## What this is

Colorful 2D underwater pufferfish game. Mobile-first installable PWA.
Phaser 3 + Matter.js, Vite, plain JS (ESM). Design notes: `_ref/gamedesign/`
(local only, gitignored) — read `gamedesign.md` and `lookdev1.jpg` before
touching look, controls or level design.

## Hard rules

- **`@gks/sdk` is fine in code, never front-facing.** No mention in README, repo
  description, page titles, in-game text, store/manifest text or commit subjects.
- **Always landscape.** Portrait viewports (incl. OS-locked portrait) render the
  game rotated 90° via `game/orientation.js`. Anything touching scaling or input
  must keep that working.
- **Control schemes stay switchable at runtime.** A scheme lives in
  `game/controls/`, extends `ControllerBase`, is registered in
  `game/controls/index.js`, drives the fish only through the `Pufferfish` API,
  and removes all its listeners/UI in `destroy()`.
- **Procedural levels first**, authored content later.
- Do not modify the SDK from this repo. SDK/portal changes are staged in the
  local clones under `_ref/` and proposed upstream separately, after asking.

## Layout

```
main.js            standalone entry (SDK host harness + forceLandscape)
index.js           host entry (re-exports IntroScene + gameMeta)
scenes/            Intro / Main / End, scene keys
game/              Pufferfish, controls/, ui/, level generation, orientation
systems/           progression (localStorage)
public/            manifest, icons, img/ (generated art, loaded by URL)
scripts/           gen-icons.mjs, serve.mjs
_ref/              local reference clones + gamedesign (gitignored)
```

## Commands

Run npm from **Git Bash** — the SDK is a git dependency and PowerShell's npm does
not find `git`.

```bash
npm run dev      # dev server, port 8080, service worker OFF
npm run build    # production build -> dist/ (regenerates icons first)
npm run serve    # static server for dist/ on :4178 — tests the real PWA/SW
```

## Branches and deploy

- `main` -> release: https://manuelkugelmann.github.io/SuperLompiLand/
- `dev` -> latest dev build: https://manuelkugelmann.github.io/SuperLompiLand/dev/
- any other branch -> `/<slug>/` preview, removed when the branch is deleted
- Work lands on `dev`; `main` only moves when a release is asked for.
- Vite `base` is injected per branch by the deploy workflow — keep every asset
  URL relative (no leading `/`).

## Art

- Look: glossy cute 3D cartoon characters (see `lookdev1.jpg`); calm, flowing
  Alto's Odyssey atmosphere for backgrounds and pacing.
- Round-1 art is generated raster (Replicate) in `public/img/`. Every texture
  has a procedural fallback so the game runs with files missing.
- Never put project, personal or studio names into prompts sent to outside
  services.

## Verifying changes

Build must pass, then check the running game in the browser (desktop landscape
and an emulated portrait phone) before calling a gameplay or layout change done.
Physics feel is tuned with the user playing on a device — expose constants, do
not guess silently.
