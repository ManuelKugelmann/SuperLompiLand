// Never out of reach (spec 5.5d): is a spot of open water connected to the rest of the sea,
// or is it a sealed pocket inside the rock? Coins and friends are only placed where the
// player can get to.
//
// A bounded flood fill over a coarse grid: from the spot outward through open cells. It is
// connected as soon as the fill touches the calm route or the open surface water, or grows
// past its budget (a region that big is no pocket). If the fill runs dry first, the spot is
// sealed. Answers are remembered for every cell the fill visited.
//
// Pure, no Phaser (tests/reach.test.mjs).

export const REACH = {
    cell: 80,           // px: grid of the fill; passages narrower than the player do not count
    budget: 320,        // cells: a region larger than this is taken as open sea
    surface: 240,       // px: water shallower than this is the open surface
    margin: 0.03        // density below the threshold by this much counts as open (room for a body)
};

/**
 * @param density    (x, y) -> rock density
 * @param threshold  density above this is rock
 * @param routeY     x -> y of the calm route's middle (always open), or null
 * @param lane       half width of the route that counts as reached
 * @returns reachable(x, y) -> boolean, with its own memory
 */
export function createReach(density, threshold, routeY = null, lane = 200, cfg = REACH) {
    const known = new Map();                    // "cx,cy" -> true | false
    const open = (cx, cy) => density((cx + 0.5) * cfg.cell, (cy + 0.5) * cfg.cell) < threshold - cfg.margin;
    const free = (cx, cy) => {
        const y = (cy + 0.5) * cfg.cell;
        return y < cfg.surface || (routeY !== null && Math.abs(y - routeY((cx + 0.5) * cfg.cell)) < lane);
    };

    return function reachable(x, y) {
        const sx = Math.floor(x / cfg.cell), sy = Math.floor(y / cfg.cell), start = `${sx},${sy}`;
        if (known.has(start)) return known.get(start);
        if (!open(sx, sy)) { known.set(start, false); return false; }
        const seen = new Set([start]), queue = [sx, sy];
        let answer = false;
        for (let i = 0; i < queue.length; i += 2) {
            const cx = queue[i], cy = queue[i + 1], key = `${cx},${cy}`;
            if (known.get(key) === true || free(cx, cy) || seen.size > cfg.budget) { answer = true; break; }
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy, nk = `${nx},${ny}`;
                if (seen.has(nk) || known.get(nk) === false || !open(nx, ny)) continue;
                seen.add(nk); queue.push(nx, ny);
            }
        }
        if (known.size > 20000) known.clear();
        for (const key of seen) known.set(key, answer);
        return answer;
    };
}
