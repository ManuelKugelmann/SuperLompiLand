# Super Lompi Land — working instructions

## What this is

Colorful 2D underwater pufferfish game. Mobile-first installable PWA.
Phaser 3 + Matter.js, Vite, plain JS (ESM). Design notes: `_ref/gamedesign/`
(local only, gitignored) — read `gamedesign.md` and the `lookdev*.png` images before
touching look, controls or level design.

## Goal

A polished, well-rounded, fun game for 10-year-olds. Every change is judged
against that: readable at a glance, forgiving, rewarding to explore, no rough
edges left in what is shipped. Prefer finishing and polishing what exists over
adding half-done features.

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
game/              Pufferfish (any playable character), characters, controls/, ui/, level/, orientation
tests/             unit tests for the pure modules
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
npm test         # unit tests (node --test, no extra dependencies)
```

## Code shape

- Pure logic lives in Phaser-free modules and is unit-tested: `game/level/terrain.js`
  (noise, marching squares), `game/level/biomes.js` (journey layout, spawn tables),
  `game/characters.js`, `game/orientationMath.js`. New rules and tables go there,
  with a test; Phaser classes only draw and wire things up.
- One source of truth per thing: tunables at the top of the file that uses them,
  creature and hazard tables in `LevelGenerator.js`, biomes in `biomes.js`.
- Keep it simple: no frameworks, no abstractions for a single caller.

## Branches and deploy

- `main` -> release: https://manuelkugelmann.github.io/SuperLompiLand/
- `dev` -> latest dev build: https://manuelkugelmann.github.io/SuperLompiLand/dev/
- any other branch -> `/<slug>/` preview, removed when the branch is deleted
- For now, work may be committed and pushed directly to `main` or to `dev`.
  Unfinished or experimental work goes to `dev` first; when `main` moves, `dev`
  is fast-forwarded so it is never behind.
  After the first "release", development moves to sub-branches (each gets its
  own `/<slug>/` preview) and `main` only takes finished work.
- Vite `base` is injected per branch by the deploy workflow — keep every asset
  URL relative (no leading `/`).

## Art

- Look: follow the `lookdev*.png` images closely — these exact characters, their
  dense glossy detail and saturated reef colours, plus the man-made hazards
  (toxic barrel robot, net, claw, atomic buoy). Generic cartoon fish are wrong.
  Art is derived from crops of the lookdev, not from text prompts alone.
- Round-1 art is generated raster (Replicate) in `public/img/`. Every texture
  has a procedural fallback so the game runs with files missing.
- Never put project, personal or studio names into prompts sent to outside
  services.

## Performance

Check with `?debug=perf` (on a real phone when it matters) after any change to
world generation, effects or per-frame code. Budgets on a mid-range phone:

- game logic (physics + world+fx) well under 4 ms per frame; it is ~0.3 ms on desktop
- building one chunk under ~15 ms, never more than one per frame after start-up
- at rest: objects < 600, tweens < 300; both must fall back after effects end
  (spawned circles/stars are destroyed by their tween's onComplete)
- terrain is baked into render textures once per chunk — never redraw vector
  shapes every frame (that cost more than everything else together)

The automation browser tab is often throttled to a few fps and its frame rate
means nothing; measure logic time and object counts there, frame rate on a device.
When stepping the scene by hand in a test, tweens do not advance reliably, so
object counts grow — use the real loop for leak checks.

## Verifying changes

Build must pass, then check the running game in the browser (desktop landscape
and an emulated portrait phone) before calling a gameplay or layout change done.
Physics feel is tuned with the user playing on a device — expose constants, do
not guess silently.
