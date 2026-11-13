// Playable characters. Each one moves differently and has its own special
// (specials.js; triggered by double tap / long press / Space).
//
// Movement numbers are multipliers on the base feel in Player.js (PLAYER):
//   thrust    swim power                 drag      water resistance (higher = stops sooner)
//   maxSpeed  top speed                  turn      how quickly the nose follows the movement
//   sink      gravity in water           airGravity / airTurn  flight behaviour above the surface
//   upright   never tilts along the movement (jellyfish, seahorse)
//   anim      how the body moves: swim (default, tail waves), pulse (jellyfish),
//             sway (seahorse), paddle (turtle: stiff shell, flipper strokes)
//   soft      how loose the thin parts are — fins, spines, tassels, tentacles (0 = stiff, 1 = flowing)
//   glide     wings: lift = share of gravity carried at full `speed` (px per step), `skips` off
//             wave tops per flight within `reach` px of the water, each keeping `refresh` of the speed
//   armor     share of hazard damage taken (1 = normal)
//
// The specials other than Lompi's puff are first proposals, to be tuned by play.

const one = (key, width, radius, wiggle, extra = {}) => ({ normal: { key, width, radius, air: 0.03, bounce: 0.35, wiggle, ...extra } });

export const CHARACTERS = [
    {
        id: 'lompi', name: 'Lompi', blurb: { de: 'Bläst sich auf und bleibt stehen', en: 'Puffs up and stops dead' },
        special: 'puff', soft: 0.6,
        states: {
            normal: { key: 'puffer_normal', width: 170, radius: 56, air: 0.03, bounce: 0.35, wiggle: 30 },
            inflated: { key: 'puffer_inflated', width: 255, radius: 98, air: 0.2, bounce: 0.75, wiggle: 9 }
        }
    },
    {
        id: 'shark', name: 'Sharky', blurb: { de: 'Schnell, träge in der Kurve · Sprint, bis zu 5-mal tippen', en: 'Fast, wide turns · sprint, tap up to 5 times' },
        special: 'sprint', thrust: 1.15, maxSpeed: 1.25, drag: 0.85, turn: 0.55, soft: 0.3,
        states: one('player_shark', 250, 62, 34)
    },
    {
        id: 'flyingfish', name: 'Flitzi', blurb: { de: 'Segelt weit über das Wasser · Sprung', en: 'Glides far above the water · leap' },
        special: 'leap', thrust: 1.1, maxSpeed: 1.15, drag: 0.85, airGravity: 0.3, airTurn: 2.4, soft: 0.5,
        // Wings: while fast they carry most of the weight, so it skims along just above the waves;
        // touching a wave top on the way down bounces it up again a few times, like a real flying fish.
        glide: { lift: 0.85, speed: 9, skips: 3, reach: 28, refresh: 1.04 },
        states: one('player_flyingfish', 230, 50, 26)
    },
    {
        id: 'firefish', name: 'Feuerfisch', blurb: { de: 'Wendig · Stachelschild', en: 'Nimble · spine shield' },
        special: 'shield', thrust: 0.95, drag: 1.25, turn: 1.6, soft: 1,
        states: one('player_firefish', 210, 60, 18)
    },
    {
        id: 'turtle', name: 'Schildi', blurb: { de: 'Langsam, hält viel aus · Panzer', en: 'Slow but tough · shell' },
        special: 'shield', thrust: 0.7, maxSpeed: 0.75, drag: 1.1, turn: 0.7, armor: 0.5, anim: 'paddle', soft: 0.35,
        states: one('friend_turtle', 250, 70, 14)
    },
    {
        id: 'jellyfish', name: 'Quallina', blurb: { de: 'Schwebt, sinkt kaum · Stoß nach oben', en: 'Floats, barely sinks · upward pulse' },
        special: 'pulse', thrust: 0.6, maxSpeed: 0.7, drag: 1.6, sink: 0.15, upright: true, anim: 'pulse', soft: 1,
        states: one('friend_jellyfish', 150, 58, 6)
    },
    {
        id: 'seahorse', name: 'Hüpfi', blurb: { de: 'Sehr genau, bleibt sofort stehen · Hüpfer', en: 'Very precise, stops at once · hop' },
        special: 'dash', thrust: 0.85, maxSpeed: 0.8, drag: 2.2, sink: 0.3, upright: true, anim: 'sway', soft: 0.5,
        states: one('friend_seahorse', 120, 52, 6)
    }
];

const STORE_KEY = 'sll_character';

export function getCharacter(id) {
    return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

export function loadSelectedId() {
    try { return window.localStorage.getItem(STORE_KEY) || CHARACTERS[0].id; } catch { return CHARACTERS[0].id; }
}

export function saveSelectedId(id) {
    try { window.localStorage.setItem(STORE_KEY, id); } catch { /* storage blocked */ }
}

/** Share of gravity (0..1) that a character's wings carry at this horizontal speed. */
export function glideLift(character, vx) {
    const g = character.glide;
    return g ? g.lift * Math.min(1, Math.abs(vx) / g.speed) : 0;
}

/**
 * Skipping off a wave top. `height` = px above the water, `skips` = skips so far in this flight.
 * Returns the new velocity { vx, vy }, or null when the flight just goes on (or ends in the water).
 */
export function skim(character, { vx, vy, height, skips }) {
    const g = character.glide;
    if (!g || skips >= g.skips || vy <= 0 || height > g.reach || Math.abs(vx) < g.speed * 0.6) return null;
    return { vx: vx * g.refresh, vy: -Math.max(1.4, vy * 0.5) };
}

// How a character's body moves through water and air, per 60 Hz physics step — the
// same numbers the physics uses, for anything that has to predict a body without
// running it (other players over the network). `base` = the PLAYER tunables from
// Player.js — pass them in where Phaser is around, so tuning there carries over; the
// defaults here are the shipped values.
//   keepWater / keepAir       share of the velocity kept each step
//   gravityWater / gravityAir downward acceleration, px per step squared
const WORLD_GRAVITY = 0.12 * 0.001 * (1000 / 60) ** 2;     // the scene's gravity as Matter applies it
export function motionOf(character, state = 'normal', base = { waterDrag: 0.6, airDrag: 0.0015, airGravity: 0.0011 }) {
    const st = character.states[state] || character.states.normal;
    return {
        keepWater: 1 - st.air * (character.drag ?? 1) * base.waterDrag,
        keepAir: 1 - base.airDrag,
        gravityWater: WORLD_GRAVITY * (character.sink ?? 1),
        gravityAir: WORLD_GRAVITY + base.airGravity * (character.airGravity ?? 1) * (1000 / 60) ** 2
    };
}
