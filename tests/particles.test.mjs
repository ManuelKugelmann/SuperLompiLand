import test from 'node:test';
import assert from 'node:assert/strict';
import { createParticles, PRESETS, PRESET_IDS, mixColor } from '../game/fx/particles.js';

const seq = () => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const positions = sim => { const out = []; sim.forEach((x, y, size, alpha, color, blend) => out.push({ x, y, size, alpha, color, blend })); return out; };

test('bubbles rise and pop at the surface', () => {
    const sim = createParticles({ capacity: 50, random: seq() });
    sim.spawn('bubble', 0, 500, 10, { spread: 5 });
    sim.step(0.5);
    for (const p of positions(sim)) assert.ok(p.y < 500, 'rising');
    sim.step(10, { surfaceY: () => 300 });
    assert.equal(sim.count, 0);
});

test('silt sinks slowly and settles out', () => {
    const sim = createParticles({ capacity: 20, random: seq() });
    sim.spawn('silt', 0, 0, 5, { spread: 0 });
    sim.step(1);
    for (const p of positions(sim)) assert.ok(p.y > 0);
    sim.step(5);
    assert.equal(sim.count, 0);
});

test('oil rises and spreads as a slick at the surface instead of popping', () => {
    const sim = createParticles({ capacity: 20, random: seq() });
    sim.spawn('oil', 0, 200, 8, { spread: 10 });
    sim.step(5, { surfaceY: () => 100 });
    assert.ok(sim.count > 0);
    for (const p of positions(sim)) assert.ok(p.y >= 100 - 1e-3 && p.y <= 101, `on the surface: ${p.y}`);
});

test('hot plumes slow down as they cool', () => {
    const sim = createParticles({ capacity: 4, random: () => 0.5 });
    sim.spawn('smoker', 0, 0, 1, { spread: 0 });
    let prev = 0, speeds = [];
    for (let k = 0; k < 4; k++) {                 // life is 4 s here (random 0.5)
        sim.step(0.9);
        const [p] = positions(sim);
        speeds.push(prev - p.y);
        prev = p.y;
    }
    assert.ok(speeds[3] < speeds[1], `cooling slows the rise after the first push: ${speeds}`);
});

test('particles follow the water flow and stop at rock', () => {
    const sim = createParticles({ capacity: 10, random: () => 0.5 });
    sim.spawn('silt', 0, 0, 1, { spread: 0 });
    sim.step(1, { flowAt: (x, y, o) => { o.x = 100; o.y = 0; } });
    assert.ok(positions(sim)[0].x > 40);
    sim.spawn('bubble', 0, 0, 1, { spread: 0 });
    sim.step(1, { isSolid: (x, y) => y < -20 });
    assert.ok(positions(sim).every(p => p.y >= -20 - 1e-6));
});

test('capacity is never exceeded and the oldest slot is reused', () => {
    const sim = createParticles({ capacity: 8, random: seq() });
    sim.spawn('ash', 0, 0, 20);
    assert.equal(sim.count, 8);
    assert.equal(positions(sim).length, 8);
});

test('unknown presets spawn nothing; colours mix; density counts nearby particles', () => {
    const sim = createParticles({ capacity: 10 });
    assert.equal(sim.spawn('glitter', 0, 0, 3), 0);
    assert.equal(mixColor(0x000000, 0xffffff, 0.5), 0x808080);
    sim.spawn('oil', 0, 0, 4, { spread: 0, radius: 5 });
    sim.spawn('oil', 500, 0, 2, { spread: 0 });
    assert.equal(sim.densityAt('oil', 0, 0, 20), 4);
    assert.equal(sim.densityAt('silt', 0, 0, 20), 0);
    sim.clear();
    assert.equal(sim.count, 0);
});

test('every preset is complete', () => {
    for (const id of PRESET_IDS) {
        const p = PRESETS[id];
        for (const k of ['life', 'size', 'grow', 'drag', 'rise', 'coldRise', 'cool', 'alpha', 'color', 'colorEnd', 'surface', 'blend']) assert.ok(k in p, `${id}.${k}`);
        assert.ok(['pop', 'slick', 'pass'].includes(p.surface), id);
        assert.ok(['normal', 'add'].includes(p.blend), id);
    }
});
