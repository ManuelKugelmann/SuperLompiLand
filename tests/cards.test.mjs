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
