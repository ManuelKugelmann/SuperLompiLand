import test from 'node:test';
import assert from 'node:assert/strict';
import { angleTo, turnToward, wanderHeading, leash, avoid } from '../game/ai/steering.js';
import { SWIMMER, createSwimmer, stepSwimmer, nearestRock } from '../game/ai/swimmer.js';

const open = () => true;
const run = (a, seconds, env, each) => { for (let i = 0; i < seconds * 60; i++) { stepSwimmer(a, 1 / 60, { isOpen: open, player: null, alarm: null, ...env, t: (env.t0 || 0) + i / 60 }); each?.(a, i); } return a; };

test('steering: shortest turns, limited turn rate', () => {
    assert.ok(Math.abs(angleTo(0.1, -0.1) + 0.2) < 1e-9);
    assert.ok(Math.abs(angleTo(3.1, -3.1) - (2 * Math.PI - 6.2)) < 1e-9, 'across the back');
    assert.equal(turnToward(0, 1, 0.1), 0.1);
    assert.equal(turnToward(0, 0.05, 0.1), 0.05);
});

test('steering: the wander course never repeats and differs per creature', () => {
    const a = [], b = [];
    for (let t = 0; t < 200; t += 2) { a.push(wanderHeading(t, 1)); b.push(wanderHeading(t, 2)); }
    assert.notDeepEqual(a, b);
    assert.ok(new Set(a.map(v => v.toFixed(2))).size > 40, 'varied');
    assert.ok(a.some(v => Math.cos(v) > 0) && a.some(v => Math.cos(v) < 0), 'both ways');
});

test('steering: the leash pulls home near the edge of the range and not inside it', () => {
    const home = { x: 0, y: 0 };
    assert.equal(leash(100, 0, home, 500, 0), 0);
    assert.ok(Math.abs(Math.abs(leash(900, 0, home, 500, 0)) - Math.PI) < 1e-9, 'outside: straight home');
    const edge = Math.abs(leash(400, 0, home, 500, 0));
    assert.ok(edge > 0.5 && edge < Math.PI);
});

test('steering: a blocked way is avoided, an open one kept', () => {
    assert.equal(avoid(open, 0, 0, 0.3, 150), 0.3);
    const wallAhead = (x) => x < 100;
    const out = avoid(wallAhead, 0, 0, 0, 150);
    assert.ok(Math.cos(out) * 150 < 100, `turned to ${out}`);
    assert.ok(Math.abs(angleTo(0, avoid(() => false, 0, 0, 0, 150))) > 3, 'boxed in: turn round');
});

test('alone, a swimmer roams its home range, rests now and then, and never repeats a path', () => {
    const a = createSwimmer({ x: 1000, y: 800 }, { range: 400 }, 3);
    const states = new Set(); let far = 0, path = 0; const seen = [];
    run(a, 120, {}, (s, i) => { states.add(s.state); far = Math.max(far, Math.hypot(s.x - 1000, s.y - 800)); path += s.v; if (i % 600 === 0) seen.push(`${Math.round(s.x)},${Math.round(s.y)}`); });
    assert.ok(states.has('wander') && states.has('rest'), [...states].join());
    assert.ok(far < 400 * 1.25, `strayed ${far}`);
    assert.ok(path > 1500, `moved ${path}`);
    assert.ok(new Set(seen).size >= seen.length - 1, 'no loop');
    const b = run(createSwimmer({ x: 1000, y: 800 }, { range: 400 }, 4), 120, {});
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 20, 'another creature, another course');
});

test('a gentle player nearby is noticed and looked at; up close it is greeted with one circle', () => {
    const a = createSwimmer({ x: 0, y: 0 }, {}, 1);
    const far = { x: 350, y: 0, vx: 0, vy: 0 };
    run(a, 2, { player: far });
    assert.equal(a.state, 'notice');
    assert.ok(a.lookX > 0.9, 'looks at the player');
    assert.ok(Math.abs(angleTo(a.heading, Math.atan2(far.y - a.y, far.x - a.x))) < 0.3, 'has turned to them');
    const near = { x: a.x + 180, y: a.y, vx: 0, vy: 0 };
    let greeted = false, done = false, min = Infinity, max = 0;
    run(a, 12, { player: near }, s => { if (greeted && s.state !== 'greet') done = true; if (s.state === 'greet') { greeted = true; const d = Math.hypot(s.x - near.x, s.y - near.y); min = Math.min(min, d); max = Math.max(max, d); } });
    assert.ok(greeted);
    assert.ok(min > 40 && max < SWIMMER.orbit * 2.2, `circle between ${min} and ${max}`);
    assert.ok(done && a.state !== 'greet', 'one circle, then on with its day');
    assert.ok(a.cooldown > 0, 'it does not greet again at once');
});

test('rushed at, it darts away and comes back to its routine', () => {
    const a = createSwimmer({ x: 0, y: 0 }, {}, 2);
    const rush = { x: -250, y: 0, vx: 16, vy: 0 };
    stepSwimmer(a, 1 / 60, { isOpen: open, t: 0, player: rush, alarm: null });
    assert.equal(a.state, 'flee');
    const x0 = a.x;
    run(a, 1, { player: { ...rush, vx: 0 } });
    assert.ok(a.x - x0 > 60, `fled ${a.x - x0}`);
    assert.ok(a.v > 1.5 * 1.5, 'faster than its usual pace');
    run(a, 3, {});
    assert.notEqual(a.state, 'flee');
    const b = createSwimmer({ x: 0, y: 0 }, {}, 2);
    stepSwimmer(b, 1 / 60, { isOpen: open, t: 0, player: { x: -250, y: 0, vx: -16, vy: 0 }, alarm: null });
    assert.notEqual(b.state, 'flee', 'a fast player swimming away scares nobody');
});

test('a special nearby is an alarm; far away it is not', () => {
    const a = createSwimmer({ x: 0, y: 0 }, {}, 5);
    stepSwimmer(a, 1 / 60, { isOpen: open, t: 0, player: null, alarm: { x: 2000, y: 0 } });
    assert.notEqual(a.state, 'flee');
    stepSwimmer(a, 1 / 60, { isOpen: open, t: 0, player: null, alarm: { x: 150, y: 0 } });
    assert.equal(a.state, 'flee');
    run(a, 0.5, { alarm: { x: 150, y: 0 } });
    assert.ok(a.x < -5, 'away from the bang');
});

test('it never swims into rock', () => {
    const cave = (x, y) => x > -300 && x < 300 && y > -200 && y < 200;
    for (const seed of [1, 2, 3, 4]) {
        const a = createSwimmer({ x: 0, y: 0 }, { range: 900 }, seed);
        run(a, 90, { isOpen: cave }, s => assert.ok(cave(s.x, s.y), `seed ${seed}: left the water at ${s.x},${s.y}`));
    }
});

test('a breather goes up for air now and then, holds at the surface and comes back down', () => {
    const sea = (x, y) => y > 0;
    const a = createSwimmer({ x: 0, y: 900 }, { breathe: true, range: 300 }, 6);
    let top = Infinity, breaths = 0, was = a.state, heldS = 0;
    run(a, 200, { isOpen: sea }, s => {
        top = Math.min(top, s.y);
        if (s.state === 'breathe' && was !== 'breathe') breaths++;
        if (s.state === 'breathe' && s.y <= SWIMMER.surfaceY + 8) heldS += 1 / 60;
        was = s.state;
        assert.ok(s.y > 0, 'never out of the water');
    });
    assert.ok(breaths >= 2, `breaths ${breaths}`);
    assert.ok(top <= SWIMMER.surfaceY + 8, `reached ${top}`);
    assert.ok(heldS > 1.5, `held ${heldS}`);
    assert.ok(a.y > 300 || a.state === 'breathe', 'back in its home range between breaths');
    const fish = run(createSwimmer({ x: 0, y: 900 }, { range: 300 }, 6), 200, { isOpen: sea });
    assert.ok(fish.y > 400, 'others stay down');
});

test('a breather that cannot reach the surface gives up and carries on', () => {
    const cave = (x, y) => y > 600;                      // a rock ceiling at 600
    const a = createSwimmer({ x: 0, y: 900 }, { breathe: true, range: 250 }, 2);
    a.air = 0;
    let breathing = 0;
    run(a, SWIMMER.breathGiveUpS + 5, { isOpen: cave }, s => { if (s.state === 'breathe') breathing += 1 / 60; assert.ok(s.y > 600); });
    assert.ok(breathing > 5 && breathing <= SWIMMER.breathGiveUpS + 0.1, `tried for ${breathing}`);
    assert.notEqual(a.state, 'breathe');
});

test('nearest rock: the closest wall within reach, a spot still in the water', () => {
    const floor = (x, y) => y < 1000;
    const p = nearestRock(floor, 0, 900, 220);
    assert.ok(p && Math.abs(p.x) < 1 && p.y >= 960 && p.y < 1000, JSON.stringify(p));
    assert.equal(nearestRock(floor, 0, 300, 220), null, 'none in reach');
});

test('an anchoring creature rests holding on to the rock, longer than others rest', () => {
    const floor = (x, y) => y < 1000;
    const a = createSwimmer({ x: 0, y: 880 }, { anchor: true, range: 150, speed: 0.6 }, 9);
    let restS = 0, nearS = 0;
    run(a, 240, { isOpen: floor }, s => {
        if (s.state !== 'rest') return;
        restS += 1 / 60;
        if (s.hold && Math.hypot(s.x - s.hold.x, s.y - s.hold.y) < 14) nearS += 1 / 60;
        assert.ok(floor(s.x, s.y));
    });
    assert.ok(restS > 30, `rested ${restS}`);
    assert.ok(nearS > restS * 0.5, `at the rock for ${nearS} of ${restS}`);
    const b = createSwimmer({ x: 0, y: 880 }, { range: 150, speed: 0.6 }, 9);
    let plain = 0;
    run(b, 240, { isOpen: floor }, s => { if (s.state === 'rest') plain += 1 / 60; });
    assert.ok(restS > plain * 1.3, `anchored ${restS} vs ${plain}`);
});

test('the breath is reached even when open water ends just under the waterline, as in the game', () => {
    const sea = (x, y) => y > 24;
    assert.ok(SWIMMER.surfaceY > 24 + 10, 'the breathing depth lies inside the water the creature may use');
    for (const seed of [1, 2, 3]) {
        const a = createSwimmer({ x: 0, y: 195 }, { breathe: true, range: 400, speed: 1.3, turn: 0.03 }, seed);
        a.air = 0;
        let top = Infinity, reachedAt = null;
        run(a, 12, { isOpen: sea }, (s, i) => { top = Math.min(top, s.y); if (reachedAt === null && s.y <= SWIMMER.surfaceY + 8) reachedAt = i / 60; });
        assert.ok(reachedAt !== null && reachedAt < 8, `seed ${seed}: stalled at ${top}`);
    }
});
