import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridStrip, makeCard, posedBuffers, poseBody, posePart, project, turnPose, heightAt } from '../game/rig/cards.js';

const SIZE = [200, 100];
const flat = { cols: 4, rows: 2, data: new Array(8).fill(0.5) };
const still = (u, v, o) => { o.x = 0; o.y = 0; };
const atRest = { yaw: 0, facing: 1, rotation: 0, sx: 1, sy: 1, x: 0, y: 0, dist: 640, fade: false, dark: 1 };

function run(card, posed, v) {
    const verts = new Float32Array(card.strip.length * 2), b = new Float32Array(card.strip.length), a = new Float32Array(card.strip.length);
    project(card, posed, v, verts, b, a);
    return { verts, b, a };
}

test('a strip covers every cell with two triangles plus joins', () => {
    assert.equal(gridStrip(3, 2).length, 2 * 4 * 2 + 2);
});

test('at rest the body card lands exactly on the picture, unshaded', () => {
    const card = makeCard({ rect: [20, 10, 160, 80], pivot: [100, 50], size: SIZE, height: flat, bulgePx: 30, cols: 4, rows: 3 });
    const posed = posedBuffers(card.n);
    poseBody(card, still, SIZE, posed);
    const { verts, b } = run(card, posed, atRest);
    for (let s = 0; s < card.strip.length; s++) {
        const i = card.strip[s];
        assert.ok(Math.abs(verts[s * 2] - (20 + card.u[i] * 160 - 100)) < 1e-3);
        assert.ok(Math.abs(verts[s * 2 + 1] - (10 + card.v[i] * 80 - 50)) < 1e-3);
        assert.ok(Math.abs(b[s] - 1) < 1e-6);
    }
});

test('the bulge map is sampled smoothly', () => {
    const map = { cols: 2, rows: 1, data: [0, 1] };
    assert.ok(heightAt(map, 0.5, 0.5) > 0.4 && heightAt(map, 0.5, 0.5) < 0.6);
});

test('a turn-around is continuous where the picture mirrors', () => {
    const card = makeCard({ rect: [0, 0, 200, 100], pivot: [100, 50], size: SIZE, height: flat, bulgePx: 30, cols: 4, rows: 2 });
    const posed = posedBuffers(card.n);
    poseBody(card, still, SIZE, posed);
    const a = turnPose(0.4999, 1), b = turnPose(0.5001, 1);
    assert.equal(a.facing, 1); assert.equal(b.facing, -1);
    const va = run(card, posed, { ...atRest, ...a }).verts, vb = run(card, posed, { ...atRest, ...b }).verts;
    for (let k = 0; k < va.length; k++) assert.ok(Math.abs(va[k] - vb[k]) < 1.5, `vertex ${k}: ${va[k]} vs ${vb[k]}`);
    assert.ok(Math.abs(turnPose(1, 1).yaw) < 1e-9);
});

test('paired fins only swing outward: a near fin never dips behind its rest plane', () => {
    const card = makeCard({ rect: [100, 50, 80, 40], pivot: [100, 70], size: SIZE, cols: 4, rows: 2 });
    const posed = posedBuffers(card.n);
    const part = { role: 'pectoral', axis: [0, 1], amp: 1, phase: 0, z: 20 };
    for (let ph = 0; ph < 12; ph += 0.3) {
        posePart(card, part, { phase: ph, drive: 1 }, [0, 0], false, posed);
        for (let i = 0; i < card.n; i++) assert.ok(posed.z[i] >= 20 - 1, `phase ${ph}: z ${posed.z[i]}`);
        posePart(card, part, { phase: ph, drive: 1 }, [0, 0], true, posed);   // its far twin stays behind
        for (let i = 0; i < card.n; i++) assert.ok(posed.z[i] <= -20 + 1);
    }
});

test('a fin turning edge-on fades out', () => {
    const card = makeCard({ rect: [100, 50, 80, 40], pivot: [100, 70], size: SIZE, cols: 4, rows: 2 });
    const posed = posedBuffers(card.n);
    posePart(card, { role: 'head', axis: [0, 1], amp: 0, phase: 0, z: 0 }, { phase: 0, drive: 0 }, [0, 0], false, posed);
    const { a } = run(card, posed, { ...atRest, yaw: Math.PI / 2 - 0.01, fade: true });
    assert.ok(Math.max(...a) < 0.05);
});

test('spine wave: still at rest, rigid front, travels to the tail, keeps the spine length', async () => {
    const { CARDS, makeSpine, spineTable, spineAt } = await import('../game/rig/cards.js');
    const t = makeSpine(), o = {}, sp = CARDS.spine;
    spineTable(1.3, 0, sp, t);
    for (const s of [0, 0.5, 1]) { spineAt(t, s, o); assert.ok(Math.abs(o.z) < 1e-9 && Math.abs(o.dx) < 1e-9 && Math.abs(o.a) < 1e-9); }
    // Over a cycle: the head nearly still, the swing grows steeply toward the tail, and stays a sane size.
    const peak = (s, key) => { let m = 0; for (let k = 0; k < 64; k++) { spineTable(k / 64 * 2 * Math.PI, 1, sp, t); spineAt(t, s, o); m = Math.max(m, Math.abs(o[key])); } return m; };
    assert.ok(peak(0, 'a') < 0.06, 'head yaw ' + peak(0, 'a'));
    assert.ok(peak(0.5, 'z') < 0.3 * peak(1, 'z'));
    assert.ok(peak(1, 'z') > 0.08 && peak(1, 'z') < 0.2, 'tail swing ' + peak(1, 'z'));
    assert.ok(peak(1, 'a') < 0.95, 'tail angle ' + peak(1, 'a'));
    // The bend travels toward the tail as the phase advances (the angle at the rear peaks later further back).
    const when = s => { let best = -1, at = 0; for (let k = 0; k < 64; k++) { spineTable(k / 64 * 2 * Math.PI, 1, sp, t); spineAt(t, s, o); if (o.a > best) { best = o.a; at = k; } } return at; };
    assert.notEqual(when(0.7), when(1));
    // The bent spine keeps its length: its points stay a body length apart along the curve.
    spineTable(0.7, 1, sp, t);
    let len = 0, px = 0, pz = 0;
    for (let i = 1; i <= 64; i++) { spineAt(t, i / 64, o); const x = -i / 64 + o.dx, z = o.z; spineAt(t, (i - 1) / 64, o); const x0 = -(i - 1) / 64 + o.dx; len += Math.hypot(x - x0, z - o.z); }
    assert.ok(Math.abs(len - 1) < 0.01, 'length ' + len);
});

test('on a slow tier a rig far off the middle of the view is posed half as often again; on full tiers every frame', async () => {
    const { poseGap, CARDS } = await import('../game/rig/cards.js');
    const slow = { ...CARDS, poseEvery: 3 }, mid = { x: 0, y: 0 };
    assert.equal(poseGap(100, 50, mid, slow), 3);
    assert.equal(poseGap(CARDS.farPose + 10, 0, mid, slow), 6);
    assert.equal(poseGap(5000, 0, mid, { ...CARDS, poseEvery: 1 }), 1);
});
