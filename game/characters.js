// Playable characters. Each one moves differently and has its own special
// (triggered by the puff gesture: double tap / long press / Space).
//
// Movement numbers are multipliers on the base feel in Pufferfish.js (FISH):
//   thrust    swim power                 drag      water resistance (higher = stops sooner)
//   maxSpeed  top speed                  turn      how quickly the nose follows the movement
//   sink      gravity in water           airGravity / airTurn  flight behaviour above the surface
//   upright   never tilts along the movement (jellyfish, seahorse)
//   armor     share of hazard damage taken (1 = normal)
//
// The specials other than Lompi's puff are first proposals, to be tuned by play.

const one = (key, width, radius, wiggle, extra = {}) => ({ normal: { key, width, radius, air: 0.03, bounce: 0.35, wiggle, ...extra } });

export const CHARACTERS = [
    {
        id: 'lompi', name: 'Lompi', blurb: { de: 'Bläst sich auf und bleibt stehen', en: 'Puffs up and stops dead' },
        special: 'puff',
        states: {
            normal: { key: 'puffer_normal', width: 170, radius: 56, air: 0.03, bounce: 0.35, wiggle: 30 },
            inflated: { key: 'puffer_inflated', width: 255, radius: 98, air: 0.2, bounce: 0.75, wiggle: 9 }
        }
    },
    {
        id: 'shark', name: 'Sharky', blurb: { de: 'Schnell, träge in der Kurve · Sprint', en: 'Fast, wide turns · dash' },
        special: 'dash', thrust: 1.15, maxSpeed: 1.25, drag: 0.85, turn: 0.55,
        states: one('player_shark', 250, 62, 34)
    },
    {
        id: 'flyingfish', name: 'Flitzi', blurb: { de: 'Segelt weit über das Wasser · Sprung', en: 'Glides far above the water · leap' },
        special: 'leap', thrust: 1.1, maxSpeed: 1.15, drag: 0.85, airGravity: 0.3, airTurn: 2.4,
        states: one('player_flyingfish', 230, 50, 26)
    },
    {
        id: 'firefish', name: 'Feuerfisch', blurb: { de: 'Wendig · Stachelschild', en: 'Nimble · spine shield' },
        special: 'shield', thrust: 0.95, drag: 1.25, turn: 1.6,
        states: one('player_firefish', 210, 60, 18)
    },
    {
        id: 'turtle', name: 'Schildi', blurb: { de: 'Langsam, hält viel aus · Panzer', en: 'Slow but tough · shell' },
        special: 'shield', thrust: 0.7, maxSpeed: 0.75, drag: 1.1, turn: 0.7, armor: 0.5,
        states: one('friend_turtle', 250, 70, 14)
    },
    {
        id: 'jellyfish', name: 'Quallina', blurb: { de: 'Schwebt, sinkt kaum · Stoß nach oben', en: 'Floats, barely sinks · upward pulse' },
        special: 'pulse', thrust: 0.6, maxSpeed: 0.7, drag: 1.6, sink: 0.15, upright: true,
        states: one('friend_jellyfish', 150, 58, 6)
    },
    {
        id: 'seahorse', name: 'Hüpfi', blurb: { de: 'Sehr genau, bleibt sofort stehen · Hüpfer', en: 'Very precise, stops at once · hop' },
        special: 'dash', thrust: 0.85, maxSpeed: 0.8, drag: 2.2, sink: 0.3, upright: true,
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
