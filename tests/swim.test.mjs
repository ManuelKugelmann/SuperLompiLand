import test from 'node:test';
import assert from 'node:assert/strict';
import { SWIM, beatHz, Swimmer } from '../game/rig/swim.js';
import { BREATH, Breath } from '../game/rig/breath.js';

const DT = 1 / 60;
const run = (s, seconds, input) => { for (let i = 0; i < seconds * 60; i++) s.update(DT, input); return s; };

test('faster fish beat faster, within their limits', () => {
    const m = SWIM.carangiform;
    assert.equal(beatHz(m, 0), m.hz[0]);
    assert.ok(beatHz(m, 2) > beatHz(m, 1));
    assert.equal(beatHz(m, 100), m.hz[1]);
    // Strouhal relation in the free range: f = St * U / A.
    assert.ok(Math.abs(beatHz(m, 2) - m.strouhal * 2 / m.amplitude) < 1e-9);
});

test('the beat never jumps when the speed changes', () => {
    const s = new Swimmer(SWIM.carangiform);
    let last = 0, worst = 0;
    for (let i = 0; i < 600; i++) {
        s.update(DT, { speed: i % 120 < 60 ? 0.5 : 4, push: 1 });
        if (i) worst = Math.max(worst, Math.abs(s.tail - last));
        last = s.tail;
    }
    assert.ok(worst < 0.4, `largest step of the tail angle: ${worst}`);
});

test('a boxfish cruises with rippling fins and a quiet tail, and beats the tail in a sprint', () => {
    const cruise = new Swimmer(SWIM.ostraciiform), sprint = new Swimmer(SWIM.ostraciiform);
    let cruiseTail = 0, sprintTail = 0;
    for (let i = 0; i < 240; i++) {
        cruiseTail = Math.max(cruiseTail, Math.abs(cruise.update(DT, { speed: 1, push: 0.4 }).tail));
        sprintTail = Math.max(sprintTail, Math.abs(sprint.update(DT, { speed: 4, push: 1 }).tail));
    }
    assert.ok(cruiseTail < 0.15 && sprintTail > 0.35, `cruise ${cruiseTail}, sprint ${sprintTail}`);
    assert.ok(sprint.ripple > cruise.ripple && cruise.ripple > SWIM.ostraciiform.rippleRest);
});

test('the tail steers', () => {
    const s = run(new Swimmer(), 1, { speed: 1, push: 0, turn: 1 });
    assert.ok(s.tail > 0.4, `tail at ${s.tail}`);
    assert.ok(run(new Swimmer(), 1, { speed: 1, push: 0, turn: -1 }).tail < -0.4);
});

test('when the push stops the fish glides: the beat fades, the fins trim out', () => {
    const s = run(new Swimmer(SWIM.carangiform), 1, { speed: 3, push: 1 });
    assert.equal(s.gliding, false);
    run(s, 2.5, { speed: 2, push: 0 });
    assert.equal(s.gliding, true);
    let swing = 0;
    for (let i = 0; i < 60; i++) swing = Math.max(swing, Math.abs(s.update(DT, { speed: 2, push: 0 }).tail));
    assert.ok(swing < 0.03, `tail swing while gliding: ${swing}`);
    assert.ok(s.spread > 0.2, 'pectorals stand off a little');
});

test('braking flares the pectoral fins', () => {
    assert.ok(run(new Swimmer(), 0.5, { speed: 2, push: 1, brake: 1 }).spread > 0.9);
});

test('idle fins are never frozen', () => {
    const s = new Swimmer();
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 240; i++) { s.update(DT, {}); lo = Math.min(lo, s.pectoral); hi = Math.max(hi, s.pectoral); }
    assert.ok(hi - lo > 0.15, `pectoral range at rest: ${hi - lo}`);
    assert.ok(s.ripple > 0);
});

test('breathing: slow at rest, quick when out of breath, calming down again', () => {
    const cycles = (b, seconds, exertion) => { const c0 = b.cycles; run(b, seconds, exertion); return (b.cycles - c0) / seconds; };
    const b = new Breath(3);
    const rest = cycles(b, 10, 0), hard = cycles(b, 10, 1);
    assert.ok(Math.abs(rest - BREATH.restHz) < 0.1, `rest ${rest} Hz`);
    assert.ok(hard > rest * 2.5, `exhausted ${hard} Hz`);
    run(b, 12, 0);
    assert.ok(b.effort < 0.05 && cycles(b, 10, 0) < rest * 1.2, 'calm again');
});

test('the mouth opens and closes within its range, wider when out of breath', () => {
    const peak = exertion => { const b = new Breath(1); let top = 0; for (let i = 0; i < 600; i++) { b.update(DT, exertion); assert.ok(b.mouth >= 0 && b.mouth <= 1); top = Math.max(top, b.mouth); } return top; };
    assert.ok(peak(1) > peak(0) * 1.8);
    assert.ok(peak(0) > 0.2);
});

test('a bubble every few breaths, at different moments for different fish', () => {
    const blubs = seed => { const b = new Breath(seed), at = []; for (let i = 0; i < 60 * 60; i++) if (b.update(DT, 0).blub) at.push(i); return at; };
    const a = blubs(1), c = blubs(2);
    assert.ok(a.length >= 60 * BREATH.restHz / BREATH.blubEvery[1] - 1 && a.length <= 60 * BREATH.restHz / BREATH.blubEvery[0] + 1, `${a.length} bubbles in a minute`);
    assert.notDeepEqual(a.slice(0, 4), c.slice(0, 4));
    assert.deepEqual(a, blubs(1));
});
