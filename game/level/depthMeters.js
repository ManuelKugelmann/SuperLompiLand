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
