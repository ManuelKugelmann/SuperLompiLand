import test from 'node:test';
import assert from 'node:assert/strict';
import { inflate, vertexNormals, shrinkMask, INFLATE } from '../game/rig/inflate.js';

const mask = (w, h, inside) => {
    const a = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = inside(x + 0.5, y + 0.5) ? 255 : 0;
    return a;
};
// A fish-like blob: an ellipse with a notch, plus a second lobe.
const W = 40, H = 24;
const fish = mask(W, H, (x, y) => ((x - 24) / 13) ** 2 + ((y - 12) / 9) ** 2 < 1 || ((x - 8) / 6) ** 2 + ((y - 12) / 5) ** 2 < 1);

/** Every directed edge must be matched by exactly one opposite one: closed, manifold, consistently wound. */
function checkClosed(mesh) {
    const edges = new Map();
    for (let i = 0; i < mesh.indices.length; i += 3) {
        for (let k = 0; k < 3; k++) {
            const a = mesh.indices[i + k], b = mesh.indices[i + (k + 1) % 3];
            assert.notEqual(a, b, 'degenerate triangle');
            const key = `${a}>${b}`;
            assert.ok(!edges.has(key), `edge ${key} used twice in the same direction`);
            edges.set(key, true);
        }
    }
    for (const key of edges.keys()) {
        const [a, b] = key.split('>');
        assert.ok(edges.has(`${b}>${a}`), `edge ${key} has no partner: the skin is open there`);
    }
}

function volume(mesh) {
    let v = 0;
    const p = mesh.positions;
    for (let i = 0; i < mesh.indices.length; i += 3) {
        const a = mesh.indices[i] * 3, b = mesh.indices[i + 1] * 3, c = mesh.indices[i + 2] * 3;
        v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
            - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
            + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    return v / 6;
}

test('the inflated body is one closed, consistently wound skin', () => {
    const mesh = inflate(fish, W, H);
    checkClosed(mesh);
    assert.ok(mesh.triangles > 100 && mesh.indices.length === mesh.triangles * 3);
    assert.equal(mesh.positions.length / 3, mesh.uvs.length / 2);
});

test('outside faces outward: the volume is positive and plausible', () => {
    const mesh = inflate(fish, W, H);
    const cells = fish.reduce((n, a) => n + (a ? 1 : 0), 0);
    const v = volume(mesh);
    assert.ok(v > 0, `signed volume ${v}`);
    assert.ok(v < cells * 2 * 9 * INFLATE.depth, 'not thicker than the profile allows');
});

test('thick in the middle, thin at the rim, mirrored front to back', () => {
    const mesh = inflate(fish, W, H);
    const p = mesh.positions;
    let most = 0, least = Infinity, centre = 0;
    for (let i = 0; i < p.length; i += 6) {
        assert.equal(p[i + 2], -p[i + 5], 'back vertex mirrors the front one');
        assert.ok(p[i + 2] > 0, 'never zero thickness');
        most = Math.max(most, p[i + 2]); least = Math.min(least, p[i + 2]);
        if (p[i] === 24 && p[i + 1] === 12) centre = p[i + 2];
    }
    assert.ok(centre > most * 0.9, `centre ${centre} of ${most}`);
    assert.ok(least < most * 0.2, `rim ${least} of ${most}`);
});

test('both flanks show the picture: texture coordinates follow x and y', () => {
    const mesh = inflate(fish, W, H);
    for (let i = 0; i < mesh.positions.length / 3; i++) {
        assert.ok(Math.abs(mesh.uvs[i * 2] - mesh.positions[i * 3] / W) < 1e-6);
        assert.ok(Math.abs(mesh.uvs[i * 2 + 1] - mesh.positions[i * 3 + 1] / H) < 1e-6);
    }
});

test('shapes touching only at a corner are joined instead of pinching', () => {
    const a = new Uint8Array(16 * 16);
    for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) a[y * 16 + x] = 255;
    for (let y = 8; y < 14; y++) for (let x = 8; x < 14; x++) a[y * 16 + x] = 255;      // touches the first at one corner
    checkClosed(inflate(a, 16, 16));
});

test('a single cell and an empty mask do not break', () => {
    const one = new Uint8Array(9); one[4] = 255;
    const mesh = inflate(one, 3, 3);
    checkClosed(mesh);
    assert.equal(mesh.triangles, 12);
    assert.equal(inflate(new Uint8Array(9), 3, 3).triangles, 0);
});

test('normals point away from the body', () => {
    const mesh = inflate(fish, W, H), n = vertexNormals(mesh.positions, mesh.indices), p = mesh.positions;
    for (let i = 0; i < p.length; i += 6) {
        assert.ok(n[i + 2] > 0, 'front normals face the viewer');
        assert.ok(n[i + 5] < 0, 'back normals face away');
        assert.ok(Math.abs(Math.hypot(n[i], n[i + 1], n[i + 2]) - 1) < 1e-4);
    }
});

test('shrinking the mask sets the triangle budget', () => {
    const big = mask(200, 120, (x, y) => ((x - 100) / 80) ** 2 + ((y - 60) / 45) ** 2 < 1);
    const small = shrinkMask(big, 200, 120, 44), tiny = shrinkMask(big, 200, 120, 16);
    const a = inflate(small.alpha, small.w, small.h), b = inflate(tiny.alpha, tiny.w, tiny.h);
    checkClosed(a); checkClosed(b);
    assert.ok(a.triangles > 1500 && a.triangles < 4000, `hero budget: ${a.triangles}`);
    assert.ok(b.triangles > 150 && b.triangles < 700, `friend budget: ${b.triangles}`);
});
