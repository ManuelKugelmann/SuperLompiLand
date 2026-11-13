// Procedural fish bodies: a skin lofted over rings along the spine.
//
// A body is described by a profile along its length — where the middle line
// runs, how tall and how wide it is, and how boxy its cross-section is. Rings
// of vertices follow that profile from the tail tip to the nose tip. Rings map
// one-to-one onto spine bones, the triangle count is exact, and the two sides
// are mirror images. The profile can be fitted to the side picture of a
// character, so the art projects straight onto the flanks.
// Pure maths, no Phaser, no DOM (tests/loft.test.mjs).

/**
 * @param o.stations  rings along the spine (tail tip and nose tip are extra single points)
 * @param o.sides     vertices per ring (even, so the body is symmetric)
 * @param o.profile   s (0 = tail .. 1 = nose) -> { x, y, h, w, n }
 *                    x, y  middle of the cross-section; h, w half height and half width;
 *                    n  superellipse exponent: 2 = round, larger = boxier
 * @param o.uv        (x, y) -> [u, v] texture coordinates of a point on the side picture
 * @returns { positions, uvs, indices, rings (ring index per vertex, -1 tail tip, stations nose tip), triangles }
 */
export function loftBody({ stations, sides, profile, uv = (x, y) => [x, y] }) {
    const positions = [], uvs = [], rings = [], indices = [];
    const push = (x, y, z, ring) => { positions.push(x, y, z); uvs.push(...uv(x, y)); rings.push(ring); };
    const at = j => profile((j + 1) / (stations + 1));         // rings sit strictly between the two tips
    const tail = profile(0), nose = profile(1);
    push(tail.x, tail.y, 0, -1);
    for (let j = 0; j < stations; j++) {
        const p = at(j), e = 2 / (p.n || 2);
        for (let k = 0; k < sides; k++) {
            const a = (k / sides) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
            // Superellipse: c drives the height, s the width, so k and sides - k mirror in z.
            push(p.x, p.y + Math.sign(c) * Math.pow(Math.abs(c), e) * p.h, Math.sign(s) * Math.pow(Math.abs(s), e) * p.w, j);
        }
    }
    push(nose.x, nose.y, 0, stations);
    const ring = (j, k) => 1 + j * sides + (k % sides), last = 1 + stations * sides;
    // Triangles are wound counter-clockwise seen from outside (x toward the nose, y up, z toward the viewer).
    for (let k = 0; k < sides; k++) indices.push(0, ring(0, k + 1), ring(0, k));
    for (let j = 0; j < stations - 1; j++) {
        for (let k = 0; k < sides; k++) {
            const a = ring(j, k), b = ring(j, k + 1), c = ring(j + 1, k + 1), d = ring(j + 1, k);
            indices.push(a, b, c, a, c, d);
        }
    }
    for (let k = 0; k < sides; k++) indices.push(last, ring(stations - 1, k), ring(stations - 1, k + 1));
    return {
        positions: Float32Array.from(positions), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices),
        rings: Int16Array.from(rings), triangles: indices.length / 3
    };
}

/** Triangles of a lofted body with these settings (for budgets and levels of detail). */
export function loftTriangles(stations, sides) {
    return 2 * sides * stations;
}

/**
 * Fit a body profile to a side picture's body mask (the thick part, without fins and tail).
 * @param body    1 per cell that belongs to the body, row by row
 * @param width   how wide the body is compared with its height (1 = round like a ball, 0.5 = slim)
 * @param box     superellipse exponent of the cross-section
 * @returns profile function for loftBody, in cells (x right, y DOWN as in the picture), plus the span { x0, x1 }
 */
export function fitProfile(body, w, h, { width = 0.8, box = 2.2 } = {}) {
    const top = new Float32Array(w).fill(-1), bottom = new Float32Array(w).fill(-1);
    let x0 = -1, x1 = -1;
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            if (!body[y * w + x]) continue;
            if (top[x] < 0) top[x] = y;
            bottom[x] = y + 1;
        }
        if (top[x] >= 0) { if (x0 < 0) x0 = x; x1 = x + 1; }
    }
    if (x0 < 0) return { profile: () => ({ x: 0, y: 0, h: 0, w: 0, n: box }), x0: 0, x1: 0 };
    // Heights between columns, smoothed a little so single-cell steps do not show.
    const column = x => {
        const i = Math.min(x1 - 1, Math.max(x0, Math.floor(x)));
        let t = 0, b = 0, n = 0;
        for (let k = -1; k <= 1; k++) {
            const c = Math.min(x1 - 1, Math.max(x0, i + k));
            if (top[c] < 0) continue;
            t += top[c]; b += bottom[c]; n++;
        }
        return n ? { top: t / n, bottom: b / n } : { top: 0, bottom: 0 };
    };
    const profile = s => {
        const x = x0 + (x1 - x0) * s, c = column(x), half = (c.bottom - c.top) / 2;
        // The silhouette gives the height; only right at the two tips the body closes to a point, rounded.
        const k = Math.min(1, Math.sqrt(Math.max(0, Math.min(s, 1 - s)) * 10));
        return { x, y: (c.top + c.bottom) / 2, h: half * k, w: half * k * width, n: box };
    };
    return { profile, x0, x1 };
}
