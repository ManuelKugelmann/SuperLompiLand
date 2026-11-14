import test from 'node:test';
import assert from 'node:assert/strict';
import { SEABIRD, createSeabird, stepSeabird, shadowX } from '../game/ai/seabird.js';

const surfaceY = () => 0;
const DT = 1 / 60;

/** Run until `until(event, bird)` or `s` seconds; returns the events seen. */
function run(b, env, s, until = () => false) {
    const seen = [];
    for (let t = 0; t < s; t += DT) {
        if (env.move) env.move(DT);
        const e = stepSeabird(b, DT, env);
        if (e) seen.push(e);
        if (until(e, b)) break;
    }
    return seen;
}

test('a still fish near the surface is announced, then dived at and hit once', () => {
    const b = createSeabird(0, surfaceY);
    const player = { x: 100, y: 80 };
    const seen = run(b, { surfaceY, player }, 6);
    assert.equal(seen[0], 'aim');
    assert.ok(seen.indexOf('dive') > 0);
    assert.equal(seen.filter(e => e === 'hit').length, 1);
});

test('the dive comes only after the aim hover (always readable)', () => {
    const b = createSeabird(0, surfaceY);
    const player = { x: 50, y: 60 };
    let aimAt = null, diveAt = null, t = 0;
    run(b, { surfaceY, player }, 4, e => { t += DT; if (e === 'aim') aimAt = t; if (e === 'dive') { diveAt = t; return true; } });
    assert.ok(diveAt - aimAt >= SEABIRD.aimS - DT * 2);
});

test('a deep, hidden, puffed or far fish is left alone', () => {
    for (const [player, extra] of [[{ x: 50, y: 400 }, {}], [{ x: 50, y: 60 }, { covered: () => true }], [{ x: 50, y: 60, big: true }, {}], [{ x: 5000, y: 60 }, {}]]) {
        const b = createSeabird(0, surfaceY);
        const seen = run(b, { surfaceY, player, ...extra }, 5);
        assert.ok(!seen.includes('hit'), JSON.stringify(player));
        assert.ok(!seen.includes('aim'), JSON.stringify(player));
    }
});

test('a fish that swerves once the dive is committed escapes', () => {
    const b = createSeabird(0, surfaceY);
    const player = { x: 80, y: 100 };
    const env = { surfaceY, player, move: () => { if (b.state === 'dive') player.x += 6; } };   // 360 px/s sideways
    const seen = run(b, env, 5);
    assert.ok(seen.includes('dive'));
    assert.ok(!seen.includes('hit'));
});

test('puffing during the dive makes it bounce off; no hit', () => {
    const b = createSeabird(0, surfaceY);
    const player = { x: 80, y: 90 };
    const env = { surfaceY, player, move: () => { if (b.state === 'dive') player.puffed = true; } };
    const seen = run(b, env, 5);
    assert.ok(seen.includes('bounce'));
    assert.ok(!seen.includes('hit'));
});

test('with no player in reach it hunts a shoal, then rests and climbs back', () => {
    const b = createSeabird(0, surfaceY);
    const shoal = { x: 120, y: 90 };
    const seen = run(b, { surfaceY, player: { x: 0, y: 900 }, shoals: [shoal] }, 3);
    assert.ok(seen.includes('splash'));
    assert.ok(seen.includes('strike'));
    run(b, { surfaceY, player: null }, SEABIRD.restS + SEABIRD.climbS + 2, (e, bird) => bird.state === 'circle');
    assert.equal(b.state, 'circle');
    assert.ok(b.y < -SEABIRD.height * 0.8);
});

test('a friend in a room is dived at but only the local fish counts as a hit', () => {
    const b = createSeabird(0, surfaceY);
    const friend = { x: 60, y: 70 };
    const seen = run(b, { surfaceY, player: { x: 0, y: 900 }, players: [friend] }, 5);
    assert.ok(seen.includes('dive'));
    assert.ok(!seen.includes('hit'));
});

test('cooldown: at most one dive at the player every few seconds', () => {
    const b = createSeabird(0, surfaceY);
    const player = { x: 60, y: 70 };
    const seen = run(b, { surfaceY, player }, SEABIRD.playerCooldownS * 0.9);
    assert.equal(seen.filter(e => e === 'dive').length, 1);
    assert.equal(shadowX(createSeabird(0, surfaceY)), 0);
});
