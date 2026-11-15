import test from 'node:test';
import assert from 'node:assert/strict';
import { WAVE, waveAt, Wave } from '../game/rig/wave.js';
import { CHARACTERS } from '../game/characters.js';

test('a wave comes in, waves the fin WAVE.waves times, beams, and is gone again', () => {
    assert.equal(waveAt(-0.1).on, false);
    assert.equal(waveAt(WAVE.s).on, false);
    const start = waveAt(0);
    assert.equal(start.k, 0); assert.equal(start.fin, 0); assert.equal(start.happy, 0);
    let peak = 0, happy = 0, flips = 0, last = 0, bob = 0;
    const N = 700;
    for (let i = 0; i < N; i++) {
        const p = waveAt(WAVE.s * i / N);
        peak = Math.max(peak, p.k); happy = Math.max(happy, p.happy); bob = Math.min(bob, p.bob);
        const swing = p.fin;      // the waving on top of the lift
        if (Math.abs(swing) > 1e-3) { const s = Math.sign(swing); if (last && s !== last) flips++; last = s; }
        assert.ok(p.yaw <= 0, 'it tilts toward the viewer');
        assert.ok(p.fin > -WAVE.swing - 1e-9, 'the fin never goes below its swing');
    }
    assert.ok(peak > 0.99 && happy > 0.99, 'fully in, fully beaming');
    assert.equal(flips, WAVE.waves * 2 - 1, 'three waves: up-down five times');
    assert.ok(bob < -WAVE.bob * 0.99, 'it bobs up once');
    const end = waveAt(WAVE.s * 0.999);
    assert.ok(end.k < 0.01 && end.happy < 0.01, 'it ends back at the swim pose');
});

test('a rig wave runs once from start(), and again when started again', () => {
    const w = new Wave();
    assert.equal(w.step(0.1).on, false);
    w.start();
    let frames = 0;
    while (w.step(1 / 60).on) frames++;
    assert.ok(Math.abs(frames - WAVE.s * 60) <= 2, `${frames} frames`);
    assert.equal(w.step(1 / 60).happy, 0);
    w.start(); assert.equal(w.step(1 / 60).on, true);
});

test('a profile names the part that waves, one of its own parts', async () => {
    const { readFileSync } = await import('node:fs');
    const rig = JSON.parse(readFileSync(new URL('../public/img/parts/rig.json', import.meta.url)));
    for (const c of CHARACTERS) {
        if (!c.wave) continue;
        assert.ok(c.wave.lift === undefined || Math.abs(c.wave.lift) < Math.PI, c.id);
        for (const st of Object.values(c.states)) {
            const r = rig[st.key];
            if (r) assert.ok(r.parts.some(p => p.name === c.wave.part), `${c.id}: no part ${c.wave.part} in ${st.key}`);
        }
    }
});
