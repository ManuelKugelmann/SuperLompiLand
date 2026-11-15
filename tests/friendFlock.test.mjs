import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOCK, flockStep } from '../game/friendFlock.js';

const DT = 1 / 60, still = { vx: 0, vy: 0 };

test('a friend settles at its place without overshooting far', () => {
    const a = { x: 0, y: 0, vx: 0, vy: 0 }, target = { x: 400, y: 100 };
    let maxX = 0;
    for (let i = 0; i < 300; i++) { flockStep(a, target, [], still, DT); maxX = Math.max(maxX, a.x); }
    assert.ok(Math.hypot(a.x - 400, a.y - 100) < 5, `settled at ${a.x.toFixed(1)},${a.y.toFixed(1)}`);
    assert.ok(maxX < 440, `overshoot ${maxX.toFixed(1)}`);
});

test('friends aiming at the same place keep apart instead of overlapping', () => {
    const fs = [{ x: 0, y: 0, vx: 0, vy: 0 }, { x: 5, y: 0, vx: 0, vy: 0 }, { x: 0, y: 5, vx: 0, vy: 0 }];
    for (let i = 0; i < 600; i++) for (const f of fs) flockStep(f, { x: 200, y: 0 }, fs, still, DT);
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
        const d = Math.hypot(fs[i].x - fs[j].x, fs[i].y - fs[j].y);
        assert.ok(d > FLOCK.sepR * 0.5, `pair ${i},${j} only ${d.toFixed(0)} px apart`);
    }
});

test('the flock keeps up with a moving lead and never exceeds its top speed', () => {
    const a = { x: 0, y: 0, vx: 0, vy: 0 }, lead = { vx: 600, vy: 0 };
    let worst = 0;
    for (let i = 0; i < 600; i++) {
        const t = i * DT, target = { x: 600 * t - 300, y: 0 };
        flockStep(a, target, [], lead, DT);
        worst = Math.max(worst, Math.hypot(a.vx, a.vy));
        if (t > 4) assert.ok(Math.abs(a.x - target.x) < 120, `lagging ${(target.x - a.x).toFixed(0)} px at ${t.toFixed(1)} s`);
    }
    assert.ok(worst <= FLOCK.maxSpeed + 1e-9);
});

test('by time, not by frame: one long step lands where many short ones do', () => {
    const a = { x: 0, y: 0, vx: 0, vy: 0 }, b = { x: 0, y: 0, vx: 0, vy: 0 }, target = { x: 300, y: 0 };
    for (let i = 0; i < 30; i++) flockStep(a, target, [], still, DT);
    flockStep(b, target, [], still, 0.5);
    assert.ok(Math.abs(a.x - b.x) < 25, `${a.x.toFixed(1)} vs ${b.x.toFixed(1)}`);
});

test('when its place turns round, the friend turns once, not back and forth', () => {
    const a = { x: 0, y: 0, vx: 0, vy: 0 }, place = { x: 0, y: 0 };
    let flips = 0, side = 0;
    for (let i = 0; i < 480; i++) {
        const v = i < 180 ? 600 : -600;          // the place runs on, then comes back along the path
        place.x += v * DT;
        flockStep(a, place, [], { vx: v, vy: 0 }, DT);
        const s = Math.sign(a.vx);
        if (s && side && s !== side) flips++;
        if (s) side = s;
    }
    assert.equal(flips, 1);
});
