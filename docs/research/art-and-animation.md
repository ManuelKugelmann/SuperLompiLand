# Art and animation guides — research notes (2026-11-13)

Web research for matching the lookdev (gamedesign ch. 1.1–1.3, 10, 11). Each item: what it
teaches → what we do with it. (S) = from search summaries, not opened; (?) = unverified.

## Underwater look
- **ABZÛ art (GDC 2017, Matt Nava)** — https://gdcvault.com/play/1024409/Creating-the-Art-of-ABZ (S) →
  colour and fog design per zone.
- **Animating thousands of fish (Godot docs)** — https://docs.godotengine.org/en/3.2/tutorials/3d/vertex_animation/animating_thousands_of_fish.html →
  boneless swim = sum of side sway, pivot, travelling wave masked to the rear half, and twist.
  Use the same formula on the rope body (Lompi) and on background schools.
- **Underwater colour physics** — red is absorbed first, then orange/yellow; distance turns
  blue-green (S): https://sees-rsrc.science.uq.edu.au/rstoolkit/en/html/marine/help/effect_colourdepth.html →
  per-layer and per-depth multiply that drops red and blends to a blue-green fog colour; the play
  plane keeps full colour ("our own lamp").
- **Phaser 3.60+ FX** — https://docs.phaser.io/phaser/concepts/fx (S) → camera postFX bloom for
  glows and glints, displacement for heat haze; no built-in caustics.
- **Cheap caustics** — https://www.alanzucconi.com/2019/09/13/believable-caustics-reflections/ (S) →
  two scrolling copies of a tileable caustic texture at different scale/speed, combined with
  min/multiply, added on top and faded with depth.
- **God rays** — https://godotshaders.com/shader/god-rays/ (S, licence unchecked) → animated
  noise along slanted gradients, or 3–5 additive gradient quads behind the play plane.

## Parallax and readability
- **Reducing visual confusion** — https://icewyrmgames.github.io/research/reducing-visual-confusion-in-your-game (S) →
  separate play from decoration by value and saturation; greyscale check as a debug toggle.
- **Atmospheric perspective in 2D layers** — https://www.slynyrd.com/blog/2026/5/27/pixelblog-62-landscape-backgrounds (S) →
  3–4 background layers with stepped fog (e.g. 0.7 / 0.45 / 0.2), play plane at full contrast,
  sparse dark foreground silhouettes.
- **Hollow Knight art analysis** — https://medium.com/3d-environmental-art/the-art-of-hollow-knight-f4c05dda3882 (S) →
  the play layer carries the contrast.
- **Parallax pitfalls** — https://www.wayline.io/blog/parallax-scrolling-game-development-pitfalls (S) →
  everything collidable at scroll factor 1.0.
- **Ori animation process (GDC)** — https://gdcvault.com/play/1021791/Animation-Bootcamp-The-Animation-Process (S) →
  a fog curve over depth; blur only on the farthest layer (desktop).

## Character appeal and animation
- **12 principles in games (Jonathan Cooper)** — https://www.gamedeveloper.com/production/the-12-principles-of-animation-in-video-games (S) →
  anticipation/follow-through must never delay control: puff = 2–3 frames squash, then
  overshoot spring, input instant.
- **12 principles reframed** — https://anim.works/?p=23056 (S) → volume-preserving squash and
  stretch (scaleX·scaleY ≈ const).
- **Rayman Origins/Legends animation (GDC 2013)** — https://www.youtube.com/watch?v=p-8eNkUCvnw →
  hand-drawn parts cut up and deformed in an in-house tool: the closest reference for our
  mesh cards; watch before building them.
- **Eyes** (S) → gaze target, ~50 ms saccades then holds, random blinks with occasional
  doubles 200–400 ms apart, partial blinks: the biggest appeal gain per line of code.

## Procedural animation
- **David Rosen, "An Indie Approach to Procedural Animation" (GDC 2014)** — https://gdcvault.com/play/1020049/Animation-Bootcamp-An-Indie-Approach (S) →
  2–3 key poses blended by springs by speed and turn rate.
- **argonaut, simple procedural animation** (YouTube @argonautcode, S) → distance-constraint
  chains with angle limits, outline built from the joints: tentacles, eels, tails.
- **Jakobsen, Advanced Character Physics** — https://www.gamedeveloper.com/programming/advanced-character-physics (S) →
  verlet + constraint relaxation: kelp and anemones pinned at the root, pushed by the flow and
  the player's wake.
- **FABRIK in 2D** — https://o1dmate.github.io/posts/fabrik-algorithm (S) → legs, claws,
  tentacles reaching for targets.

## Deformation tooling (free/open source only)
- **Spine** — runtimes need a paid editor licence (S): https://esotericsoftware.com/spine-runtimes-license → **not allowed** (rule: free and open source).
- **DragonBonesJS** — MIT, Phaser 3 plugin, maintenance looks stale (?) → only if acceptable.
- **Phaser Rope / Mesh** — https://docs.phaser.io/phaser/concepts/gameobjects/rope (S) → keep
  for bodies; mesh cards via Phaser `Mesh` or our own small vertex skinning (1–2 joints per vertex).
- **Phaser 4 licence** — the news-page footer points to Polyform Shield (?) → check before any upgrade.

## Lighting and fake PBR
- **Phaser 3 Light2D** — https://docs.phaser.io/phaser/concepts/gameobjects/light → needs a normal
  map (flat #7F7FFF fallback), no lights on Containers, rotated containers reported broken
  (https://github.com/phaserjs/phaser/issues/6086, S), capped light count, WebGL only.
- **Phaser 4 dynamic lighting** — https://phaser.io/news/2026/05/phaser-4-dynamic-lighting → `setLighting(true)`,
  self-shadow; Mesh/Rope support not mentioned (?).
- **Normal maps for sprites** (method from https://www.codeandweb.com/spriteilluminator/tutorials/how-to-create-light-effects-in-phaser3, S) →
  bake normals offline, then one small custom sprite shader: soft key light from above, teal
  bounce from below, rim from the normal's z, a mask channel for gloss and subsurface (fins
  glow warmer when backlit). Avoid Light2D for rigs because of the container and rope limits.

## Top actions for the art target
1. Depth tint per layer (absorb red, blue-green fog) + greyscale readability check.
2. 3–4 parallax layers on stepped fog, full-contrast play plane, dark sparse foreground, collidables at 1.0.
3. Eye controller (look-at, saccades, blinks); squash/stretch with overshoot on puff and impacts.
4. The four-motion swim formula on the rope body, scaled by speed.
5. Verlet / distance chains for fins, kelp, tentacles; FABRIK for claws and legs.
6. Additive caustics + god-ray quads or shader; camera bloom for glowing creatures.
7. One custom sprite shader: normal map, key + bounce + rim, backlit fins.
8. Watch the Rayman GDC 2013 talk, then build mesh cards as custom skinning (no Spine).
