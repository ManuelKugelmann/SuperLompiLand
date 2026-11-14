# Style guide — look targets (art direction)

Measurable targets for matching the look of the reference images (density, saturation and
light; the character and hazard *designs* follow the spec, not the old reference sheets).
Binding rules live in the design spec (ch. 1.1–1.3, 10, 11); this page turns them into numbers
an asset or a biome can be checked against. Reviews use `scripts/capture-biomes.mjs`.

## 1. Value and saturation per depth

Measured on a 1600×900 capture without HUD (mean HSV over the frame below the HUD row).
The reference images average **V 0.75–0.82, S 0.64–0.65**.

| Depth band | Biomes | Mean V (brightness) | Mean S | Blown-out pixels (≥250) |
|---|---|---|---|---|
| Sunlit shallows (0–15 m) | beach, reef, mangrove | **0.65–0.80** | 0.50–0.70 | ≤ 15 % (sky/surface may exceed) |
| Mid water (15–35 m) | kelp, blue, wreck, harbour | **0.50–0.65** | 0.55–0.80 | ≤ 3 % |
| Deep (35 m+) | trench, abyss | **0.22–0.35** + glow accents | 0.60–0.85 | ≤ 1 % |

Status (4a4b1e4 + exposure): beach 0.75 ✓, reef 0.59 (low end), mangrove 0.63 ✓, kelp 0.44 ✗
(too dark: dark green rock fills most of the frame), blue 0.62 ✓, trench 0.28 ✓.

Light system knobs: `WATER_LIGHT` in `game/fx/WaterLight.js` (shafts, caustics, grade
saturation, red absorption, exposure, fade depth).

## 2. Hierarchy (what pops, what recedes)

1. **Play plane:** characters, friends, hazards, pickups — highest contrast and saturation,
   crisp edges. Friends warm and bright with a rainbow sheen; hazards matte, darker, angular.
2. **Ground and terrain:** calmer than characters (V 0.45–0.7 in the shallows), textured,
   overgrown; never a flat single colour; coral/moss/sand bands on every exposed edge.
3. **Mid and far layers:** lower contrast, shifted toward the water colour (fog steps about
   0.2 / 0.45 / 0.7), slightly blurred, never brighter than the play plane.
4. **Foreground silhouettes:** sparse, dark, soft-edged; never cover a hazard or the player.

**Greyscale check:** a capture converted to greyscale must still show the player, every hazard
and every pickup at a glance (value contrast, not hue alone).

## 3. Palettes (sampled from the references and the biome tints)

| Role | Colours |
|---|---|
| Sunlit water | `#01c7f8` `#2cd6ec` `#5de5fc` `#a3f1f8` (top highlight `#eff2db`) |
| Mid water | `#1bb5e2` `#1397d0` `#027fc5` `#279bc5` |
| Deep water | `#1f4d6b` `#123460` `#0b2a56` `#080f28` |
| Sand | `#cfbe88` `#cdab79` `#dcdda7` (shadow `#8e8d55`) |
| Rock | `#403b60` `#6d8183` `#3d4964` (moss `#5b836d`, `#94c198`) |
| Coral accents | `#bc4878` `#ff6b9a` `#f28c38` `#c792ff` `#7ee08a` |
| Friends' sheen | full spectrum, low opacity, moving |
| Hazards | rust `#8f4d56`, gunmetal `#4b4f58`, warning yellow `#e8c547` — matte |

## 4. Density per screen (spec 1.2)

Shallow and reef screens: corals, plants or rocks on **every** visible ground edge, **30+**
moving things on screen (a school counts once), plants sway, 3+ particle layers (bubbles,
motes, silt). Open water: schools, distant silhouettes and light keep it alive — never an
empty single-colour field. **Coins are accents** (short trails on good lines), not wallpaper.

## 5. Asset approval checklist

An asset is approved when it passes the spec 1.2 table (shape, surface, light, motion,
contact, reaction, sound, variety, fallback) **and**:
- reads at gameplay size and at hero zoom (two captures);
- sits in its depth band's value range and in the hierarchy above;
- uses the palette family of its biome; no plastic shine (spec 10.0), only eyes are glossy;
- has no hard straight cut, seam or flat single-colour area larger than a fish.
