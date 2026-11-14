import test from 'node:test';
import assert from 'node:assert/strict';
import { GRUMPY, createGrumpy, stepGrumpy, calmGrumpy } from '../game/ai/grumpy.js';

const run = (g, s, env, dt = 1 / 60) => { const ev = []; for (let t = 0; t < s; t += dt) { const e = stepGrumpy(g, dt, env); if (e) ev.push({ e, t }); } return ev; };

test('idles inside its territory when nobody is near', () => {
    const g = createGrumpy(0, 0, {}, 1.3);
    run(g, 20, { player: null });
    assert.equal(g.state, 'idle');
    assert.ok(Math.hypot(g.x, g.y) < GRUMPY.territory, `strayed to ${g.x.toFixed(0)},${g.y.toFixed(0)}`);
});

test('always warns for warnS before a shove, and the shove hits once', () => {
    const g = createGrumpy(0, 0, {}, 2);
    const player = { x: 150, y: 0 };
    const ev = run(g, 1.5, { player });
    assert.equal(ev[0].e, 'warn');
    const hit = ev.find(x => x.e === 'hit');
    assert.ok(hit, 'the shove reached a player who stayed put');
    assert.ok(hit.t - ev[0].t >= GRUMPY.warnS - 1e-9, `warning lasted ${(hit.t - ev[0].t).toFixed(2)} s`);
    assert.equal(ev.filter(x => x.e === 'hit').length, 1, 'one hit per shove');
});

test('backing off during the warning cancels the shove', () => {
    const g = createGrumpy(0, 0, {}, 3);
    const player = { x: 150, y: 0 };
    run(g, 0.2, { player });
    assert.equal(g.state, 'warn');
    player.x = 600;
    const ev = run(g, 2, { player });
    assert.ok(!ev.some(x => x.e === 'hit'));
    assert.equal(g.state, 'idle');
});

test('after a shove it sulks home and stays calm for a while', () => {
    const g = createGrumpy(0, 0, {}, 4);
    const player = { x: 150, y: 0 };
    run(g, 1.2, { player });
    assert.ok(g.state === 'sulk' || g.state === 'calm', g.state);
    const ev = run(g, GRUMPY.sulkS + GRUMPY.calmS - 1.5, { player });
    assert.ok(!ev.some(x => x.e === 'warn'), 'no second warning while calming down');
});

test('a sudden event calms it; it never enters rock', () => {
    const g = createGrumpy(0, 0, {}, 5);
    run(g, 0.2, { player: { x: 150, y: 0 } });
    calmGrumpy(g);
    assert.equal(g.state, 'sulk');
    const rock = (x, y) => x < 120;                  // a wall just right of home
    const h = createGrumpy(0, 0, {}, 6);
    run(h, 3, { isOpen: rock, player: { x: 200, y: 0 } });
    assert.ok(h.x < 120, `at ${h.x.toFixed(0)}`);
});
