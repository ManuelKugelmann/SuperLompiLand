// One scale for everything in the sea (spec 5.0j; user: "scale down to fit viewport", "fill and
// fit"): sizes come from real lengths, relative to Lompi. Up to a metre things are true to
// scale; bigger things are compressed so the biggest fills the view and nothing is larger
// (stylised, but consistent: a bigger thing is always drawn bigger). Pure: no Phaser.

export const SCALE = {
    lompi: { px: 170, m: 0.3 },     // Lompi (normal) is ~170 px long and stands for a 30 cm puffer
    view: { w: 1920, h: 1080 },     // the game's view (world px, main.js FIT)
    fill: 0.95                      // the biggest thing fills this share of the view, and fits in it
};

/**
 * World px for a real length in metres: true to scale up to a metre; beyond, a power curve whose
 * exponent makes the longest thing in LENGTHS exactly fill the view's width.
 */
export function sizeFor(m, cfg = SCALE) {
    const k = cfg.lompi.px / cfg.lompi.m;
    return Math.round(m <= 1 ? k * m : k * Math.pow(m, compressFor(cfg)));
}

/** World px wide for a thing of real length m whose picture is `aspect` (height / width) tall: it also fits the view's height. */
export function fitWidth(m, aspect, cfg = SCALE) {
    return Math.round(Math.min(sizeFor(m, cfg), cfg.fill * cfg.view.h / aspect));
}

const compressFor = cfg => Math.log(cfg.fill * cfg.view.w / (cfg.lompi.px / cfg.lompi.m)) / Math.log(LONGEST);

/**
 * Real lengths (metres, longest side as drawn) of the things in the sea. Playable characters
 * and friends keep their gameplay sizes (characters.js / FRIENDS); this table is for the
 * world: ships, wrecks, big animals and props.
 */
export const LENGTHS = {
    rowboat: [4, 5],
    fishingBoat: [12, 16],        // trawler, cutter
    hullBeam: 4.5,                // a fishing boat's hull seen bow-on from below (its beam)
    sailingWreck: [25, 32],
    ghostShip: 35,                // a galleon
    whale: 14,                    // humpback
    whaleCalf: 5,
    manta: 5,                     // wingspan
    whaleShark: 10,
    reefShark: 1.6,
    grouper: 1,
    turtle: 1,                    // green turtle, shell length
    oilDrum: 0.88,                // standing height of a 200 l drum
    anchor: 1.4,
    crate: 0.8,
    bottle: 0.3
};

const LONGEST = Math.max(...Object.values(LENGTHS).flat());

/** LENGTHS in world px ([min, max] stays a pair). */
export const SIZES = Object.fromEntries(Object.entries(LENGTHS)
    .map(([k, v]) => [k, Array.isArray(v) ? v.map(m => sizeFor(m)) : sizeFor(v)]));
