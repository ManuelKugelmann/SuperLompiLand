import test from 'node:test';
import assert from 'node:assert/strict';
import { CRAWLER, createCrawler, stepCrawler, settle } from '../game/ai/crawler.js';
import { FIELD, createField } from '../game/level/density.js';

const T = 0.5;
// A round boulder of radius 300 at the origin: density falls off with distance.
const boulder = (x, y) => 0.5 + (300 - Math.hypot(x, y)) / 400;
// A flat seabed at y = 1000.
const seabed = (x, y) => 0.5 + (y - 1000) / 380;
const run = (c, seconds, env, each) => { for (let i = 0; i < seconds * 60; i++) { stepCrawler(c, 1 / 60, { threshold: T, player: null, ...env }); each?.(c); } return c; };

test('a crawler settles onto the rock outline, with the normal pointing into the water', () => {
    const c = createCrawler(40, 950, seabed, T);
    assert.ok(c.onRock);
    assert.ok(Math.abs(c.y - 1000) < 0.5, `y ${c.y}`);
    assert.ok(Math.abs(c.nx) < 1e-6 && Math.abs(c.ny + 1) < 1e-6, 'up');
    const b = createCrawler(0, -340, boulder, T);
    assert.ok(Math.abs(Math.hypot(b.x, b.y) - 300) < 1, 'on the boulder');
    assert.ok(b.ny < -0.99);
});

test('in featureless water there is nothing to crawl on, and it stays put', () => {
    const c = createCrawler(0, 0, () => 0.2, T);
    assert.equal(c.onRock, false);
    run(c, 10, { density: () => 0.2 });
    assert.deepEqual([c.x, c.y], [0, 0]);
});

test('it crawls along the outline, pauses, and never leaves the rock', () => {
    const c = createCrawler(0, -300, boulder, T, {}, 3);
    const states = new Set(); let travelled = 0, px = c.x, py = c.y;
    run(c, 90, { density: boulder }, s => {
        states.add(s.state);
        assert.ok(Math.abs(Math.hypot(s.x, s.y) - 300) < 2, `off the rock: ${Math.hypot(s.x, s.y)}`);
        travelled += Math.hypot(s.x - px, s.y - py); px = s.x; py = s.y;
    });
    assert.ok(states.has('crawl') && states.has('pause'));
    assert.ok(travelled > 150, `crawled ${travelled}`);
    // The normal follows the curve of the rock.
    assert.ok(Math.abs(c.nx - c.x / 300) < 0.02 && Math.abs(c.ny - c.y / 300) < 0.02);
});

test('it keeps to its patch', () => {
    const c = createCrawler(0, 1000, seabed, T, { range: 120, speed: 1 }, 5);
    let far = 0;
    run(c, 240, { density: seabed }, s => { far = Math.max(far, Math.abs(s.x)); });
    assert.ok(far > 60, `it does roam: ${far}`);
    assert.ok(far < 120 + 5, `strayed ${far}`);
});

test('bumped by the player it pulls in and waits, then carries on', () => {
    const c = createCrawler(0, 1000, seabed, T, {}, 1);
    stepCrawler(c, 1 / 60, { density: seabed, threshold: T, player: { x: 30, y: 960 } });
    assert.equal(c.state, 'curl');
    const x = c.x;
    run(c, 1, { density: seabed, player: { x: 30, y: 960 } });
    assert.equal(c.x, x, 'does not move while pulled in');
    run(c, CRAWLER.curlS + 0.2, { density: seabed });
    assert.notEqual(c.state, 'curl');
    stepCrawler(c, 1 / 60, { density: seabed, threshold: T, player: { x: 900, y: 960 } });
    assert.notEqual(c.state, 'curl', 'a player far away is no bump');
});

test('on the real seabed crawlers stay on the outline for minutes', () => {
    const f = createField(1337);
    let placed = 0;
    for (const x of [2500, 9000, 16000, 23000]) {
        let y = 300;
        while (y < 6000 && f.density(x, y) < FIELD.threshold) y += 20;
        const c = createCrawler(x, y, f.density, FIELD.threshold, { speed: 0.6 }, x);
        if (!c.onRock) continue;
        placed++;
        for (let i = 0; i < 60 * 120; i++) {
            stepCrawler(c, 1 / 60, { density: f.density, threshold: FIELD.threshold, player: null });
            if (i % 30 === 0) assert.ok(Math.abs(f.density(c.x, c.y) - FIELD.threshold) < 0.02, `x ${x}: left the outline (${f.density(c.x, c.y)})`);
        }
        assert.ok(Math.hypot(c.x - c.home.x, c.y - c.home.y) < CRAWLER.range * 1.2);
    }
    assert.ok(placed >= 3);
    assert.equal(typeof settle, 'function');
});

test('a friend bumping it counts like the player', () => {
    const c = createCrawler(0, 1000, seabed, T, {}, 1);
    stepCrawler(c, 1 / 60, { density: seabed, threshold: T, player: { x: 900, y: 960 }, players: [{ x: 900, y: 960 }, { x: 20, y: 960 }] });
    assert.equal(c.state, 'curl');
});
