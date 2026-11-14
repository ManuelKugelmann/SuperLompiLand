import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuide, GUIDE } from '../game/guide.js';

const seq = () => { let s = 3; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const open = { isOpen: () => true };

test('stays away while the player makes progress', () => {
    const g = createGuide(open, seq());
    for (let t = 0; t < 60; t += 0.5) g.update(0.5, t * 100, 0);
    assert.equal(g.state, 'away');
});

test('appears ahead after a stall and waits in open water', () => {
    const g = createGuide({ isOpen: (x, y) => y > -500 && y < 500 }, seq());
    let r;
    for (let t = 0; t <= GUIDE.stallS + 1; t += 0.5) r = g.update(0.5, 100, 0);
    assert.equal(r.state, 'lead');
    assert.ok(r.target.x > 100 + GUIDE.lead[0] * 0.8, 'ahead, east');
    assert.ok(Math.abs(r.target.y) < 500);
});

test('following moves it on; real progress sends it away', () => {
    const g = createGuide(open, seq());
    for (let t = 0; t <= GUIDE.stallS + 1; t += 0.5) g.update(0.5, 0, 0);
    const first = g.target;
    g.update(0.1, first.x, first.y);                     // reached the guide (still not "progress")
    assert.equal(g.state, 'lead');
    assert.notDeepEqual(g.target, first);
    g.update(0.1, 5000, 0);                              // big step east
    assert.equal(g.state, 'leave');
    g.gone();
    assert.equal(g.state, 'away');
});

test('an ignored guide leaves and does not come straight back', () => {
    const g = createGuide(open, seq());
    let t = 0;
    for (; t <= GUIDE.stallS + 1; t += 0.5) g.update(0.5, 0, 0);
    for (let k = 0; k <= GUIDE.patienceS * 2 + 2; k++) g.update(0.5, 0, 0);
    assert.equal(g.state, 'leave');
    g.gone();
    for (let k = 0; k < (GUIDE.cooldownS - 5) * 2; k++) g.update(0.5, 0, 0);
    assert.equal(g.state, 'away');
    for (let k = 0; k < 12 * 2; k++) g.update(0.5, 0, 0);
    assert.equal(g.state, 'lead');
});

test('no open water ahead: it does not appear', () => {
    const g = createGuide({ isOpen: () => false }, seq());
    for (let t = 0; t <= GUIDE.stallS + 5; t += 0.5) g.update(0.5, 0, 0);
    assert.equal(g.state, 'away');
});

test('with a main route, the guide leads east and back into the lane', async () => {
    const { createGuide, GUIDE } = await import('../game/guide.js');
    const lane = x => 1000 + Math.sin(x / 3000) * 200;
    const g = createGuide({ isOpen: () => true, routeY: lane }, () => 0.5);
    let px = 0, py = 2200;                                   // lost, far below the lane
    let r;
    for (let t = 0; t <= GUIDE.stallS + 0.1; t += 0.1) r = g.update(0.1, px, py);
    assert.equal(r.state, 'lead');
    const gap = Math.abs(py - lane(px)), t = g.target;
    assert.ok(t.x > px, 'east');
    const next = Math.abs(t.y - lane(t.x));
    assert.ok(gap - next > 400, `first waypoint climbs toward the lane: ${gap.toFixed(0)} -> ${next.toFixed(0)}`);
});

test('a guide without a route still works (random open waypoints)', async () => {
    const { createGuide, GUIDE } = await import('../game/guide.js');
    const g = createGuide({ isOpen: () => true }, () => 0.5);
    let r;
    for (let t = 0; t <= GUIDE.stallS + 0.1; t += 0.1) r = g.update(0.1, 0, 0);
    assert.equal(r.state, 'lead');
});
