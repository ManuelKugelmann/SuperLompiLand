// 2.5D volume from a flat picture: the silhouette is inflated into a closed,
// rounded mesh — thick where the shape is wide, thin at its rim — and the side
// art is projected onto both flanks. So a fish turns, bends and catches light
// as a body instead of a warped card. Thin parts (fins, tail) are not inflated;
// they stay alpha cards.
// Pure maths, no Phaser, no DOM (tests/inflate.test.mjs).
import { distanceMap } from './soft.js';

export const INFLATE = {
    depth: 0.42,     // half thickness at the widest point, as a share of the shape's widest half-width
    rim: 0.12        // half thickness at the silhouette, as a share of the thickest point (a rounded edge, not a knife)
};

/**
 * @param alpha  opacity per cell (0..255), row by row — the body mask at the resolution the mesh should have
 * @returns {
 *   positions  Float32Array x, y, z per vertex; x/y in cells from the top-left corner, z toward the viewer
 *   uvs        Float32Array u, v per vertex (both flanks show the same picture)
 *   indices    Uint32Array, triangles wound counter-clockwise seen from outside
 *   triangles  count
 * }
 */
export function inflate(alpha, w, h, cfg = INFLATE) {
    // Solid cells. Two cells touching only at a corner would make the surface
    // pinch to a point there: fill one of the gaps.
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = alpha[i] > 40 ? 1 : 0;
    const cell = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : solid[y * w + x]);
    for (let pass = 0, changed = true; changed && pass < 4; pass++) {
        changed = false;
        for (let y = 0; y < h - 1; y++) {
            for (let x = 0; x < w - 1; x++) {
                const a = cell(x, y), b = cell(x + 1, y), c = cell(x, y + 1), d = cell(x + 1, y + 1);
                if (a && d && !b && !c) { solid[y * w + x + 1] = 1; changed = true; }
                else if (b && c && !a && !d) { solid[y * w + x] = 1; changed = true; }
            }
        }
    }

    // Half thickness at every grid corner: a round (square-root) profile of the
    // distance to the silhouette, never quite zero.
    const dist = distanceMap(solid.map(v => v * 255), w, h);
    let widest = 0;
    for (let i = 0; i < w * h; i++) if (dist[i] > widest) widest = dist[i];
    const top = widest * cfg.depth, low = top * cfg.rim;
    const W1 = w + 1, front = new Int32Array(W1 * (h + 1)).fill(-1);
    const positions = [], uvs = [];
    for (let y = 0; y <= h; y++) {
        for (let x = 0; x <= w; x++) {
            const n = cell(x - 1, y - 1) + cell(x, y - 1) + cell(x - 1, y) + cell(x, y);
            if (!n) continue;
            // Distance at the corner: the smallest of the cells around it (0 outside), so the rim is the rim.
            const at = (cx, cy) => (cell(cx, cy) ? dist[cy * w + cx] : 0);
            const d = Math.min(at(x - 1, y - 1), at(x, y - 1), at(x - 1, y), at(x, y));
            const z = low + (top - low) * Math.sqrt(Math.min(1, d / Math.max(1, widest)));
            front[y * W1 + x] = positions.length / 3;
            positions.push(x, y, z, x, y, -z);              // front vertex, then its twin on the back
            uvs.push(x / w, y / h, x / w, y / h);
        }
    }

    const indices = [];
    // Corners are given clockwise as seen on screen from outside (y points down),
    // which is counter-clockwise in a y-up, right-handed space: normals point out.
    const quad = (a, b, c, d) => indices.push(a, c, b, a, d, c);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!cell(x, y)) continue;
            const tl = front[y * W1 + x], tr = front[y * W1 + x + 1], bl = front[(y + 1) * W1 + x], br = front[(y + 1) * W1 + x + 1];
            quad(tl, bl, br, tr);
            quad(tl + 1, tr + 1, br + 1, bl + 1);                     // back flank, mirrored
            // Walls along the silhouette join the two flanks into one closed skin.
            if (!cell(x, y - 1)) quad(tl, tr, tr + 1, tl + 1);
            if (!cell(x, y + 1)) quad(br, bl, bl + 1, br + 1);
            if (!cell(x - 1, y)) quad(bl, tl, tl + 1, bl + 1);
            if (!cell(x + 1, y)) quad(tr, br, br + 1, tr + 1);
        }
    }
    return {
        positions: Float32Array.from(positions), uvs: Float32Array.from(uvs),
        indices: Uint32Array.from(indices), triangles: indices.length / 3
    };
}

/** Smooth per-vertex normals (area-weighted), for lighting the inflated body as a round shape. */
export function vertexNormals(positions, indices) {
    const normals = new Float32Array(positions.length);
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
        const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
        const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        for (const k of [a, b, c]) { normals[k] += nx; normals[k + 1] += ny; normals[k + 2] += nz; }
    }
    for (let i = 0; i < normals.length; i += 3) {
        const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
        normals[i] /= len; normals[i + 1] /= len; normals[i + 2] /= len;
    }
    return normals;
}

/** The mask shrunk to `width` cells across (box filter), so the mesh meets a triangle budget. */
export function shrinkMask(alpha, w, h, width) {
    const k = w / width, height = Math.max(1, Math.round(h / k)), out = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const x0 = Math.floor(x * k), x1 = Math.max(x0 + 1, Math.floor((x + 1) * k));
            const y0 = Math.floor(y * h / height), y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / height));
            let sum = 0, n = 0;
            for (let yy = y0; yy < Math.min(h, y1); yy++) for (let xx = x0; xx < Math.min(w, x1); xx++) { sum += alpha[yy * w + xx]; n++; }
            out[y * width + x] = n ? sum / n : 0;
        }
    }
    return { alpha: out, w: width, h: height };
}
