import test from 'node:test';
import assert from 'node:assert/strict';
import { BAITBALL, SWIRL, baitballSlot, inBaitball, ballCentre, fishAt, hiddenIn, plungeAt, plungeCoins, plungeDepth } from '../game/level/baitball.js';
import { isSea } from '../game/level/biomes.js';
import { FIELD, createField } from '../game/level/density.js';
import { rescueSpots } from '../game/rescues.js';
import { bloomFields } from '../game/level/blooms.js';
import { weatherZones } from '../game/level/weather.js';
import { chapters } from '../game/journey.js';

const s = baitballSlot(), f = createField(1337);

test('the bait ball\'s slot lies in open water on the calm route, near the end of the open blue', () => {
    assert.ok(isSea(s.x0) && isSea(s.x1));
    const y = f.routeY(s.x);
    assert.ok(y > 200 && y < 900, `route there at ${Math.round(y)}`);
    for (const [dx, dy] of [[0, 0], [-s.radius * 0.7, 0], [s.radius * 0.7, 0], [0, -200], [0, s.radius * 0.7]]) assert.ok(f.density(s.x + dx, y + dy) < FIELD.threshold, 'open water inside it');
    assert.ok(inBaitball(s.x, y, f.routeY) && !inBaitball(s.x + s.radius + 10, y, f.routeY));
    assert.equal(s.radius, BAITBALL.radius);
});

test('nothing else stands in the slot: no rescue, bloom, current, storm, friend or event', () => {
    const clear = (x0, x1, what) => assert.ok(x1 < s.x0 || x0 > s.x1, what);
    for (const r of rescueSpots()) clear(r.x, r.x, r.id);
    for (const b of bloomFields()) clear(b.x0, b.x1, b.id);
    const w = weatherZones();
    clear(w.storm[0], w.storm[1], 'storm');
    for (const d of w.downs) clear(d[0], d[1], 'current');
    for (const c of chapters()) { if (c.friend) clear(c.x, c.x, c.id); if (c.event) clear(c.event.x, c.event.endX, c.event.id); }
});

test('the swirl stays inside its slot, its fish go one way round', () => {
    const slot = baitballSlot(), routeY = () => 470, c = {}, o = {};
    for (const t of [0, 7, 31]) {
        ballCentre(t, routeY, c);
        assert.ok(Math.hypot(c.x - slot.x, c.y - 470) + SWIRL.radius * 1.07 < slot.radius);
    }
    for (let i = 0; i < SWIRL.count; i++) {
        fishAt(i, 3.3, o);
        assert.ok(Math.hypot(o.x, o.y / SWIRL.squash) <= SWIRL.radius * 1.07);
        if (o.y < -SWIRL.radius * 0.3) assert.equal(o.dir, 1);
        if (o.y > SWIRL.radius * 0.3) assert.equal(o.dir, -1);
    }
    assert.ok(hiddenIn(0, 0) && !hiddenIn(SWIRL.radius, 0));
});

test('a plunge: cue, dive, under water into the ball, back up; coins between surface and ball', () => {
    const P = SWIRL.plunge, at = s => plungeAt(P.every * 2 + s);
    assert.equal(at(0.1).phase, 'cue');
    assert.equal(at(P.cue + 0.1).phase, 'air');
    assert.equal(at(P.cue + P.air + 0.1).phase, 'water');
    const hit = at(P.cue + P.air + P.water + 0.1);
    assert.equal(hit.phase, 'rise'); assert.ok(hit.since > 0 && hit.n === 2);
    assert.ok(Math.abs(hit.dx) <= SWIRL.radius * P.reach);
    assert.ok(P.cue + P.air + P.water + P.rise < P.every);
    const coins = plungeCoins(hit, -470);
    assert.equal(coins.length, P.coins);
    for (const k of coins) assert.ok(k.y > -470 && k.y <= plungeDepth());
    for (let i = 1; i < coins.length; i++) assert.ok(Math.hypot(coins[i].x - coins[i - 1].x, coins[i].y - coins[i - 1].y) >= 60, 'coins never overlap');
});

test('one coin trail at a time: coins fade before the next plunge leaves its own', () => {
    assert.ok(SWIRL.plunge.life < SWIRL.plunge.every);
});
