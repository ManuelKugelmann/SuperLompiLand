import test from 'node:test';
import assert from 'node:assert/strict';
import { loftBody, loftTriangles, fitProfile } from '../game/rig/loft.js';

// A simple spindle: 2 long, tallest and widest in the middle.
const spindle = s => ({ x: s * 2 - 1, y: 0, h: Math.sin(Math.PI * s) * 0.4, w: Math.sin(Math.PI * s) * 0.3, n: 2.4 });
const body = loftBody({ stations: 10, sides: 12, profile: spindle });

function checkClosed(mesh) {
    const edges = new Set();
    for (let i = 0; i < mesh.indices.length; i += 3) {
        for (let k = 0; k < 3; k++) {
            const key = `${mesh.indices[i + k]}>${mesh.indices[i + (k + 1) % 3]}`;
            assert.ok(!edges.has(key), `edge ${key} used twice in the same direction`);
            edges.add(key);
        }
    }
    for (const key of edges) { const [a, b] = key.split('>'); assert.ok(edges.has(`${b}>${a}`), `open at ${key}`); }
}

function volume(mesh) {
    let v = 0;
    const p = mesh.positions;
    for (let i = 0; i < mesh.indices.length; i += 3) {
        const a = mesh.indices[i] * 3, b = mesh.indices[i + 1] * 3, c = mesh.indices[i + 2] * 3;
        v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
    }
    return v / 6;
}

test('the body is one closed skin, outside facing out, with the exact triangle count', () => {
    checkClosed(body);
    assert.equal(body.triangles, loftTriangles(10, 12));
    assert.equal(body.triangles, 240);
    assert.equal(body.positions.length / 3, 10 * 12 + 2);
    assert.ok(volume(body) > 0, `volume ${volume(body)}`);
});

test('budgets: swarm fish, friend and hero settings land in their ranges', () => {
    assert.ok(loftTriangles(5, 8) <= 120 && loftTriangles(5, 8) >= 40);
    assert.ok(loftTriangles(16, 14) >= 300 && loftTriangles(16, 14) <= 1200);
    assert.ok(loftTriangles(40, 28) >= 2000 && loftTriangles(40, 28) <= 4000);
});

test('the two sides are mirror images', () => {
    const p = body.positions, key = (x, y, z) => [x, y, z].map(v => Math.round(v * 1e5) + 0).join(','), seen = new Set();
    for (let i = 0; i < p.length; i += 3) seen.add(key(p[i], p[i + 1], p[i + 2]));
    for (let i = 0; i < p.length; i += 3) assert.ok(seen.has(key(p[i], p[i + 1], -p[i + 2])), `no mirror for vertex ${i / 3}`);
});

test('rings run from tail to nose, one bone per ring', () => {
    assert.equal(body.rings[0], -1);
    assert.equal(body.rings[body.rings.length - 1], 10);
    for (let j = 0; j < 10; j++) {
        const xs = [];
        for (let i = 0; i < body.rings.length; i++) if (body.rings[i] === j) xs.push(body.positions[i * 3]);
        assert.equal(xs.length, 12);
        assert.ok(xs.every(x => Math.abs(x - xs[0]) < 1e-6), 'a ring lies in one cross-section');
        if (j) assert.ok(xs[0] > body.positions[(1 + (j - 1) * 12) * 3], 'rings advance toward the nose');
    }
});

test('a boxier cross-section fills more of its bounding box', () => {
    const round = loftBody({ stations: 10, sides: 16, profile: s => ({ ...spindle(s), n: 2 }) });
    const boxy = loftBody({ stations: 10, sides: 16, profile: s => ({ ...spindle(s), n: 5 }) });
    assert.ok(volume(boxy) > volume(round) * 1.1);
});

test('texture coordinates come from the side view', () => {
    const m = loftBody({ stations: 4, sides: 8, profile: spindle, uv: (x, y) => [(x + 1) / 2, 0.5 - y] });
    for (let i = 0; i < m.positions.length / 3; i++) {
        assert.ok(Math.abs(m.uvs[i * 2] - (m.positions[i * 3] + 1) / 2) < 1e-6);
        assert.ok(Math.abs(m.uvs[i * 2 + 1] - (0.5 - m.positions[i * 3 + 1])) < 1e-6);
    }
});

test('fitting follows the silhouette of a body mask', () => {
    const W = 60, H = 40, mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) mask[y * W + x] = ((x - 30) / 22) ** 2 + ((y - 22) / 12) ** 2 < 1 ? 1 : 0;
    const { profile, x0, x1 } = fitProfile(mask, W, H, { width: 0.7 });
    assert.ok(Math.abs(x0 - 8) <= 1 && Math.abs(x1 - 52) <= 1, `span ${x0}..${x1}`);
    const mid = profile(0.5);
    assert.ok(Math.abs(mid.x - 30) < 1 && Math.abs(mid.y - 22) < 1, `middle ${mid.x},${mid.y}`);
    assert.ok(Math.abs(mid.h - 12) < 1 && Math.abs(mid.w - 12 * 0.7) < 1, `half height ${mid.h}, half width ${mid.w}`);
    assert.ok(profile(0.1).h < mid.h && profile(0).h === 0 && profile(1).h === 0, 'closes at the tips');
    checkClosed(loftBody({ stations: 12, sides: 10, profile }));
});

test('an empty mask gives an empty profile instead of failing', () => {
    const { profile } = fitProfile(new Uint8Array(16), 4, 4);
    assert.equal(profile(0.5).h, 0);
});
