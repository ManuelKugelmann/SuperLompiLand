// One scale for everything in the sea (spec 5.0j): sizes come from real lengths, relative to
// Lompi. Up to a metre things are true to scale; bigger things are compressed by a power curve,
// so a ship still feels huge without filling ten screens (stylised, but consistent: a bigger
// thing is always drawn bigger). Pure: no Phaser.

export const SCALE = {
    lompi: { px: 170, m: 0.3 },   // Lompi (normal) is ~170 px long and stands for a 30 cm puffer
    compress: 0.62               // beyond a metre: px = px per metre * metres ^ compress
};

/** World px for a real length in metres. */
export function sizeFor(m, cfg = SCALE) {
    const k = cfg.lompi.px / cfg.lompi.m;
    return Math.round(m <= 1 ? k * m : k * Math.pow(m, cfg.compress));
}

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
    reefShark: 1.6,
    grouper: 1,
    turtle: 1,                    // green turtle, shell length
    oilDrum: 0.88,                // standing height of a 200 l drum
    anchor: 1.4,
    crate: 0.8,
    bottle: 0.3
};

/** LENGTHS in world px ([min, max] stays a pair). */
export const SIZES = Object.fromEntries(Object.entries(LENGTHS)
    .map(([k, v]) => [k, Array.isArray(v) ? v.map(m => sizeFor(m)) : sizeFor(v)]));
