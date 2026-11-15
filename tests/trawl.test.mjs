import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAWL, trawlSpot, headY, createTrawl, stepTrawl, holdAt, trawlRescues } from '../game/level/trawl.js';
import { rescueSpots, RESCUES } from '../game/rescues.js';
import { worldMap, LANDMARK_KINDS } from '../game/level/worldMap.js';

const world = { floor: () => 1900, route: () => 1000 };
const spot = trawlSpot();

/** Run a trawl for `secs` with the fish moving by `move(fish, t)`; returns the events in order. */
function run(fish, secs, move = () => {}) {
    const s = createTrawl(), events = [];
    for (let t = 0; t < secs; t += 1 / 30) { move(fish, t, s); stepTrawl(s, 1 / 30, fish, world); if (s.event) events.push(s.event); if (s.carry > 0) { const h = holdAt(s, world); fish.x = h.x; fish.y = h.y; } }
    return { s, events };
}

test('the headrope reaches just over the route, and the net is never lower than its least height', () => {
    assert.equal(headY(0, world), 1000 - TRAWL.over);
    assert.equal(headY(0, { floor: () => 1200, route: () => 1000 }), 1200 - TRAWL.minHeight);
});

test('set off by a fish passing east: first the warning, then the net from behind, outside the picture', () => {
    const fish = { x: spot.startX + 10, y: 1000, r: 50 };
    const { s, events } = run(fish, TRAWL.warnS + 0.1);
    assert.deepEqual(events, ['warn', 'tow']);
    assert.ok(fish.x - s.mouthX >= TRAWL.behind - TRAWL.speed * 0.2);
});

test('a fish cruising along the route is swept in once, carried, and let out over the headrope', () => {
    const fish = { x: spot.startX + 10, y: 1000, r: 50 };
    const { events } = run(fish, 14, (f, t, s) => { if (s.carry <= 0) f.x += 330 / 30; });
    assert.equal(events.filter(e => e === 'caught').length, 1);
    assert.ok(events.indexOf('released') > events.indexOf('caught'));
});

test('a fish that rises over the headrope, or sprints ahead, is never caught; the net lifts away at the end', () => {
    const over = { x: spot.startX + 10, y: 1000 - TRAWL.over - 120, r: 50 };
    assert.ok(!run(over, 30, f => { f.x += 330 / 30; }).events.includes('caught'));
    const sprint = { x: spot.startX + 10, y: 1000, r: 50 };
    const r = run(sprint, 30, f => { f.x += 1000 / 30; });
    assert.ok(!r.events.includes('caught'));
    assert.ok(r.events.includes('gone'), 'it lifts away');
});

test('the torn panel is a rescue on the seabed after the net, the landmark of its gap', () => {
    const [p] = trawlRescues();
    assert.ok(p.ground && p.x > spot.at);
    assert.ok(rescueSpots().some(s => s.id === 'trawl'));
    assert.ok(!RESCUES.big.some(x => Math.abs(x - p.x) < 9000), 'no big rescue on the same stretch');
    assert.ok(LANDMARK_KINDS.includes('trawl'));
    assert.ok(worldMap().features.some(f => f.kind === 'trawl'));
});
