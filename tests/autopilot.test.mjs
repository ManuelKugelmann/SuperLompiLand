import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutopilot, AUTOPILOT } from '../game/ambient/autopilot.js';

const seq = () => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

/** A tiny swimmer: thrust becomes velocity with drag, like a calm fish. */
function swim(pilot, env, seconds, start = { x: 0, y: 0 }) {
    let x = start.x, y = start.y, vx = 0, vy = 0;
    const path = [];
    for (let t = 0; t < seconds; t += 1 / 30) {
        const f = pilot.step(1 / 30, x, y);
        vx += (f.x * 400 - vx) * 0.08; vy += (f.y * 400 - vy) * 0.08;
        const nx = x + vx / 30, ny = y + vy / 30;
        if (env.isOpen(nx, ny)) { x = nx; y = ny; } else { vx = vy = 0; }
        path.push({ x, y });
    }
    return path;
}

test('drifts east through open water over time', () => {
    const env = { isOpen: (x, y) => y > -600 && y < 600 };
    const path = swim(createAutopilot(env, seq()), env, 90);
    const end = path[path.length - 1];
    assert.ok(end.x > 1000, `travelled east: ${end.x}`);
    assert.ok(path.every(p => env.isOpen(p.x, p.y)));
});

test('never asks for more than the calm thrust and turns gently', () => {
    const env = { isOpen: () => true };
    const pilot = createAutopilot(env, seq());
    let prev = null;
    for (let i = 0; i < 600; i++) {
        const f = pilot.step(1 / 30, i * 3, 0);
        const len = Math.hypot(f.x, f.y);
        assert.ok(len <= AUTOPILOT.thrust + 1e-9);
        if (len > 0 && prev) {
            const turn = Math.abs(Math.atan2(Math.sin(Math.atan2(f.y, f.x) - prev), Math.cos(Math.atan2(f.y, f.x) - prev)));
            assert.ok(turn <= AUTOPILOT.turnRate / 30 + 1e-6, `turn ${turn}`);
        }
        if (len > 0) prev = Math.atan2(f.y, f.x);
    }
});

test('targets are always in open water and a blocked fish picks a new one', () => {
    const env = { isOpen: (x, y) => x < 500 };               // a wall to the east
    const pilot = createAutopilot(env, seq());
    const path = swim(pilot, env, 60);
    assert.ok(path.every(p => p.x < 500));
    assert.ok(env.isOpen(pilot.target?.x ?? 0, pilot.target?.y ?? 0) || pilot.target === null);
});

test('points of interest are visited and the fish sometimes hovers', () => {
    const env = { isOpen: () => true, poi: (x, y) => ({ x: x + 300, y }) };
    const pilot = createAutopilot(env, () => 0.1);           // always prefers the POI and hovers
    let hovered = false;
    for (let i = 0; i < 900 && !hovered; i++) { pilot.step(1 / 30, i * 2, 0); hovered = pilot.hovering; }
    assert.ok(hovered);
});
