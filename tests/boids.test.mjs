import test from 'node:test';
import assert from 'node:assert/strict';
import { createSwarm, SWARM } from '../game/ai/boids.js';

const seq = (s = 5) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const run = (sw, seconds, env = {}, dt = 1 / 30) => { for (let t = 0; t < seconds; t += dt) sw.step(dt, typeof env === 'function' ? env(t) : env); };
const spread = sw => { const c = sw.centre(); let m = 0; for (let i = 0; i < sw.count; i++) m = Math.max(m, Math.hypot(sw.x[i] - c.x, sw.y[i] - c.y)); return m; };

test('a swarm stays together and near home', () => {
    const sw = createSwarm({ count: 80, random: seq() });
    run(sw, 20);
    assert.ok(spread(sw) < 600, `spread ${spread(sw)}`);
    const c = sw.centre();
    assert.ok(Math.hypot(c.x, c.y) < SWARM.homeR + 300, 'near the anchor');
});

test('fish keep their distance from each other', () => {
    const sw = createSwarm({ count: 60, random: seq(9) });
    run(sw, 10);
    let close = 0;
    for (let i = 0; i < sw.count; i++) for (let j = i + 1; j < sw.count; j++) if (Math.hypot(sw.x[i] - sw.x[j], sw.y[i] - sw.y[j]) < 6) close++;
    assert.ok(close < sw.count * 0.05, `${close} pairs overlapping`);
});

test('speed limits hold: no fish faster than panic speed', () => {
    const sw = createSwarm({ count: 50, random: seq(3) });
    run(sw, 5, { player: { x: 0, y: 0, vx: 900, vy: 0 } });
    for (let i = 0; i < sw.count; i++) assert.ok(Math.hypot(sw.vx[i], sw.vy[i]) <= SWARM.maxSpeed * 1.16 + 1);
});

test('the swarm parts around a player swimming through it', () => {
    const sw = createSwarm({ count: 120, random: seq(11) });
    run(sw, 5);
    const c = sw.centre();
    let min = Infinity;
    run(sw, 2, t => {
        const p = { x: c.x - 400 + t * 400, y: c.y, vx: 400, vy: 0 };
        for (let i = 0; i < sw.count; i++) min = Math.min(min, Math.hypot(sw.x[i] - p.x, sw.y[i] - p.y));
        return { player: p };
    });
    assert.ok(min > 25, `closest fish to a passing player: ${min.toFixed(1)} px`);
});

test('a dash starts a panic that spreads beyond the dash radius', () => {
    const sw = createSwarm({ count: 150, random: seq(4) });
    run(sw, 5);
    const c = sw.centre();
    run(sw, 0.5, { player: { x: c.x, y: c.y, vx: SWARM.dashSpeed + 200, vy: 0 } });
    let far = 0;
    for (let i = 0; i < sw.count; i++) if (sw.panic[i] > 0.2 && Math.hypot(sw.x[i] - c.x, sw.y[i] - c.y) > SWARM.panicR) far++;
    assert.ok(far > 0, 'the wave reached fish outside the dash radius');
    run(sw, 8);
    let still = 0;
    for (let i = 0; i < sw.count; i++) if (sw.panic[i] > 0.2) still++;
    assert.equal(still, 0, 'calms down again');
});

test('startle panics the fish near the event only', () => {
    const sw = createSwarm({ count: 40, random: seq(6) });
    sw.startle(sw.x[0], sw.y[0], 1);
    assert.equal(sw.panic[0], 1);
    assert.equal([...sw.panic].filter(p => p > 0).length, 1);
});

test('fish never enter rock', () => {
    const open = (x, y) => y > -150 && y < 150;
    const sw = createSwarm({ count: 60, random: seq(8), homeR: 300 });
    run(sw, 15, { isOpen: open });
    for (let i = 0; i < sw.count; i++) assert.ok(open(sw.x[i], sw.y[i]), `fish ${i} at ${sw.y[i]}`);
});
