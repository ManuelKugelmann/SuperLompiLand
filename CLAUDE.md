# Super Lompi Land — working instructions

Colourful 2D underwater platformer for 10-year-olds. Mobile-first installable PWA.
Phaser 3 (WebGL) + Matter.js, Vite, plain JS (ESM).

**Design lives in `_ref/gamedesign/gamedesign.md`** (local only, gitignored). It is the
source of truth for look, gameplay, creatures, hazards, world and multiplayer. Read the
relevant chapter before changing any of them. Key chapters: 1.1-1.2 (simple to play,
AAA detail bar), 4.2a (Player core), 5.0b (world partition, bitfields), 5.5b (rooting),
6.2 (AI, swarms), 7.1 (realistic hazards), 10.0 (PBR x animated-film look), 10.9 (rigs),
10.10-10.11 (parallax, light), 13 (multiplayer), 14 (tech).

## Goal

A polished, fun game for 10-year-olds: simple, forgiving gameplay inside a dense, alive,
AAA-detailed world. Polish what exists before adding more.

## Hard rules

- **`@gks/sdk` is fine in code, never front-facing:** not in README, repo description,
  page titles, in-game text, manifest or commit subjects. Do not modify the SDK from this
  repo; stage changes under `_ref/` and propose upstream after asking.
- **Always landscape.** Portrait renders rotated 90° (`game/orientation.js`); scaling and
  input changes must keep that working.
- **Control schemes are switchable at runtime:** one per file in `game/controls/`, extends
  `ControllerBase`, registered in `game/controls/index.js`, drives the fish only through the
  `Player` API (`thrust`, `dragTo`, `launch`, `special`), removes everything in `destroy()`.
- **Hazards are realistic and inanimate** (chains, anchors, nets, lines, ships, waste,
  spills). No mines, atomic/biohazard items, faces, skulls or symbols.
- **Never put project, personal or studio names into prompts sent to outside services.**
- Every texture has a procedural fallback; the game runs with art files missing.
- **Open source and free only:** libraries, tools, formats and runtimes must be open source
  and free of charge (e.g. Phaser, Matter, delaunator/earcut, glTF, three.js). No paid or
  proprietary tools or SDKs (no Spine, no Live2D). Check the licence before adding a
  dependency.

## Code style: DRY and clean

- **One core, data-driven.** All playables are one `Player` class with profiles from
  `game/characters.js`; specials are entries in `game/specials.js`. NPCs become `Creature`
  (in progress). Both share `game/Rig.js`. No per-character branches in shared code.
- **Pure logic is Phaser-free and unit-tested** (`game/level/terrain.js`, `biomes.js`,
  `density.js`, `characters.js`, `specials.js`, `systems/worldState.js`, `net/*`, ...).
  New rules and tables go there with a test; Phaser classes only draw and wire up.
- **One source of truth per thing:** tunables at the top of the file that uses them;
  creature/hazard tables in `LevelGenerator.js`; biomes in `biomes.js`.
- No duplication: shared behaviour goes into the shared layer, not copied per caller. No
  frameworks, no abstraction for a single caller, no dead code; delete instead of commenting
  out. Small files with one job; names say what things are.
- Every expensive effect reads one named constant (quality tiers come later).

## Layout

```
main.js      standalone entry (host harness, WebGL config, forceLandscape)
index.js     host entry (IntroScene + gameMeta)
scenes/      Intro / Story / Main / Hud / End
game/        Player, Rig, specials, characters, controls/, level/, ui/, orientation, multiplayer
net/         multiplayer transport, secrets, snapshots (pure parts tested)
systems/     progression, worldState (bitfields)
tests/       unit tests (node --test)
public/      manifest, icons, img/ (generated art, loaded by relative URL)
scripts/     gen-icons.mjs, serve.mjs
_ref/        local reference clones + gamedesign (gitignored)
```

## Commands (run npm from Git Bash; the SDK is a git dependency)

```bash
npm run dev      # dev server :8080, service worker off
npm run build    # production build -> dist/
npm run serve    # serve dist/ on :4178 (real PWA/SW)
npm test         # unit tests
```

## Branches and deploy

- `main` -> release, `dev` -> latest dev build (`/dev/`), other branches -> `/<slug>/` preview.
- For now commit directly to `main` or `dev`; experimental work goes to `dev` first; `dev`
  is fast-forwarded when `main` moves. After the first release, work moves to sub-branches.
- Vite `base` is injected per branch: every asset URL stays relative (no leading `/`).

## Performance

Check `?debug=perf` after changes to world generation, effects or per-frame code.
Mid-range phone budgets: game logic well under 4 ms/frame; one chunk build under ~15 ms,
at most one per frame after start-up; objects < 600 and tweens < 300 at rest. GPU does
the drawing: no per-frame `Graphics` redraws or canvas texture updates, bake static things
once. The automation browser tab is throttled: measure logic time and object counts there,
frame rate on a device; use the real loop for leak checks.

## Verifying changes

Build and tests pass, then check the running game in the browser (desktop landscape and an
emulated portrait phone) before calling a gameplay or layout change done. Milestones (not
every commit) get a short dev log entry with 1-3 screenshots; the log keeps
growing, never prune old entries. Physics feel is tuned with the user on a device:
expose constants, never guess silently.
