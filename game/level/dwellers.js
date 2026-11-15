// Where in a chunk a swimming creature may make its home (pure, no Phaser). Most may live anywhere
// in the chunk's open water; a surface dweller (row `surface`: the flying squid) only above that
// depth, a floor dweller (row `floor`: the rockfish, the nautilus) only within that many px over the
// seabed. A chunk whose band is empty is not offered that kind at all, so a creature is always made
// inside the chunk that owns it, and the usual open-water checks apply to its spot.

export const DWELLERS = {
    edge: 120,       // px kept from the chunk's sides
    floorGap: 80,    // px a floor dweller keeps over the seabed
    min: 40          // px a band must be tall to be used
};

/**
 * The y range [y0, y1] a creature of `row` may live at in the chunk from `oy` (`span` tall), with the seabed at `floor`;
 * `below`: a y it must stay under (a grumpy keeps off the calm route); null: none here.
 */
export function dwellerBand(row, oy, span, floor, below = -Infinity, cfg = DWELLERS) {
    let y0 = Math.max(oy + cfg.edge, below), y1 = oy + span - cfg.edge;
    if (row.surface) y1 = Math.min(y1, row.surface);
    if (row.floor) { y0 = Math.max(y0, floor - row.floor); y1 = Math.min(y1, floor - cfg.floorGap); }
    return y1 - y0 >= cfg.min ? [y0, y1] : null;
}
