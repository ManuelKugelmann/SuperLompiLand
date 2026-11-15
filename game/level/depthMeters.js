// The depth a child reads in the HUD and on the end screen (spec 5.0m). World y in px is a game unit
// (y / 100 would make the deep sea "55 m"); this shows a believable number instead: true to scale near
// the surface, then growing faster, so the trench floor reads about 1 000 m. Pure, tested; logic keeps using y.

/** [world y px, metres] points, joined by straight pieces; past the last one the last piece goes on. */
export const DEPTH_SCALE = [[0, 0], [2000, 20], [3000, 60], [4000, 200], [5000, 500], [5600, 1000], [8600, 4000]];

/** Metres shown for world y: whole metres, from 100 m on rounded to tens. */
export function depthMeters(y, table = DEPTH_SCALE) {
    if (y <= table[0][0]) return 0;
    let i = 1;
    while (i < table.length - 1 && y > table[i][0]) i++;
    const [y0, m0] = table[i - 1], [y1, m1] = table[i];
    const m = m0 + (m1 - m0) * (y - y0) / (y1 - y0);
    return m >= 100 ? Math.round(m / 10) * 10 : Math.round(m);
}

/**
 * Depth marks (spec 5.0w "depth must be felt"): going down past one of these metres rings a bell that is
 * lower every mark, and the HUD's depth line glows. A mark rings again only after Lompi has come back
 * up above `rearm` of it, so swimming along a mark's depth does not ring it over and over.
 */
export const DEPTH_MARKS = { at: [10, 20, 50, 100, 200, 500, 1000, 2000, 3000], rearm: 0.7 };

/** A bell keeper: step(metres) returns the index of the mark just passed going down, else -1. */
export function createDepthBell(cfg = DEPTH_MARKS) {
    const armed = cfg.at.map(() => true);
    let last = 0;
    return {
        step(m) {
            let rang = -1;
            cfg.at.forEach((mark, i) => {
                if (!armed[i] && m < mark * cfg.rearm) armed[i] = true;
                if (armed[i] && last < mark && m >= mark) { armed[i] = false; rang = i; }
            });
            last = m;
            return rang;
        }
    };
}

/**
 * How bright the water is at a depth (spec 5.0w, user: "depth scale not felt"): [metres, brightness] points,
 * joined by straight pieces. Shallow water is as painted; by 50 m the picture is clearly darker, by 100 m a
 * dark blue, past 200 m nearly night where creature light matters. One table, read by the camera grade.
 */
export const DEPTH_LIGHT = [[0, 1], [15, 1], [30, 0.9], [60, 0.76], [120, 0.6], [250, 0.5], [600, 0.44], [1000, 0.42]];      // gentler since 2026-11-15 (user: 'depth darkening too quick'); the floor keeps Lompi and the coins readable

/** Brightness for a depth in metres (0..1, never brighter deeper). */
export function depthLight(m, table = DEPTH_LIGHT) {
    if (m <= table[0][0]) return table[0][1];
    for (let i = 1; i < table.length; i++) {
        const [m0, b0] = table[i - 1], [m1, b1] = table[i];
        if (m <= m1) return b0 + (b1 - b0) * (m - m0) / (m1 - m0);
    }
    return table.at(-1)[1];
}
