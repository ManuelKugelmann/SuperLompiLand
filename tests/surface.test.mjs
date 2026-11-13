import test from 'node:test';
import assert from 'node:assert/strict';
import { WaterSurface, waveY, SURFACE } from '../game/level/surface.js';

const energy = s => s.h.reduce((sum, h, i) => sum + h * h + s.v[i] * s.v[i], 0);

test('a calm surface is exactly the swell', () => {
    const s = new WaterSurface();
    for (const x of [-500, 0, 123.4, 900]) assert.equal(s.heightAt(x, 3.2), waveY(x, 3.2));
});

test('a splash moves the water where it lands and nowhere far away at first', () => {
    const s = new WaterSurface();
    s.recenter(0);
    s.splash(0, 30);
    s.step();
    assert.ok(s.offsetAt(0) > 5, 'pushed down at the impact');
    assert.equal(s.offsetAt(1500), 0, 'far columns untouched after one step');
});

test('ripples travel outward and then die away', () => {
    const s = new WaterSurface();
    s.recenter(0);
    s.splash(0, 40);
    for (let i = 0; i < 40; i++) s.step();
    assert.ok(Math.abs(s.offsetAt(400)) > 0.01, 'the disturbance reached 400 px');
    const mid = energy(s);
    for (let i = 0; i < 1500; i++) s.step();
    assert.ok(energy(s) < mid * 0.01, 'almost calm again');
});

test('offsets stay bounded however hard the surface is hit', () => {
    const s = new WaterSurface();
    s.recenter(0);
    for (let i = 0; i < 50; i++) { s.splash(i * 7 - 150, 500); s.step(); }
    for (const h of s.h) assert.ok(Math.abs(h) <= SURFACE.maxOffset);
});

test('recentering keeps a ripple at its place in the world', () => {
    const s = new WaterSurface();
    s.recenter(0);
    s.splash(64, 30);
    for (let i = 0; i < 5; i++) s.step();
    const before = s.offsetAt(64);
    s.recenter(640);
    assert.ok(Math.abs(s.offsetAt(64) - before) < 1e-6);
    assert.equal(Math.abs(s.origin % SURFACE.spacing), 0);
});
