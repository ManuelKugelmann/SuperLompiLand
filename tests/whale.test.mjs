import test from 'node:test';
import assert from 'node:assert/strict';
import { WHALE, createWhale, stepWhale, bodySpot, whaleCarry } from '../game/ai/whale.js';

const route = () => 900;
const run = (w, s, fish) => { const ev = []; for (let i = 0; i < s * 60; i++) { const e = stepWhale(w, 1 / 60, fish, route, i / 60); if (e) ev.push(e); } return ev; };
const cutAll = w => {
    const ev = [];
    for (let i = 0; i < WHALE.nets.length; i++) {
        const s = bodySpot(w, WHALE.nets[i], WHALE.netDrop[i]);
        const e = stepWhale(w, 1 / 60, { x: s.x, y: s.y }, route, 0);
        if (e) ev.push(e);
        for (let k = 0; k < WHALE.cutPause * 60 + 2; k++) stepWhale(w, 1 / 60, null, route, 0);      // swim on to the next piece
    }
    return ev;
};

test('caught, she drifts slowly east along the route', () => {
    const w = createWhale(1000, 9000);
    run(w, 5, null);
    assert.ok(w.x > 1000 + WHALE.drift * 4 && w.x < 1000 + WHALE.drift * 6);
    assert.ok(Math.abs(w.y - 900) <= WHALE.bob + 1e-9);
    assert.equal(w.state, 'caught');
});

test('she waits for a helper who falls far behind', () => {
    const w = createWhale(5000, 9000);
    run(w, 3, { x: 5000 - WHALE.waitBehind - 800, y: 900 });
    const x = w.x;
    run(w, 2, { x: 5000 - WHALE.waitBehind - 800, y: 900 });
    assert.ok(w.x - x < 2, 'stands still');
});

test('each net piece comes off once when the fish swims to it; the last one frees her', () => {
    const w = createWhale(1000, 9000);
    const ev = cutAll(w);
    assert.deepEqual(ev, ['cut', 'cut', 'cut', 'freed']);
    assert.equal(w.left, 0);
    assert.equal(w.state, 'sing');
});

test('a fish that is nowhere near cuts nothing', () => {
    const w = createWhale(1000, 9000);
    assert.deepEqual(run(w, 1, { x: 1000, y: 900 - WHALE.length }), []);
    assert.equal(w.left, WHALE.nets.length);
});

test('freed, she sings, rides east with momentum, dives at the end and is gone', () => {
    const w = createWhale(1000, 6000);
    cutAll(w);
    const ev = run(w, 40, null);
    assert.deepEqual(ev, ['ride', 'gone']);
    assert.ok(w.x >= 6000);
    assert.equal(w.state, 'gone');
});

test('the ride never jerks: her speed changes at most by her acceleration', () => {
    const w = createWhale(1000, 60000);
    cutAll(w);
    let last = w.v, worst = 0;
    for (let i = 0; i < 600; i++) { stepWhale(w, 1 / 60, null, route, i / 60); worst = Math.max(worst, Math.abs(w.v - last)); last = w.v; }
    assert.ok(worst <= WHALE.accel / 60 + 1e-9);
    assert.ok(Math.abs(w.v - WHALE.ride) < 1);
});

test('a rider at her back is carried at her speed; one who swims away is let go; nobody is carried before the ride', () => {
    const w = createWhale(1000, 60000);
    const seat0 = bodySpot(w, WHALE.seat[0], WHALE.seat[1]);
    assert.equal(whaleCarry(w, seat0, 0, 0), null, 'not while she is caught');
    cutAll(w);
    run(w, 8, null);
    const seat = bodySpot(w, WHALE.seat[0], WHALE.seat[1]);
    let vx = 0, vy = 0;
    for (let i = 0; i < 120; i++) { const p = whaleCarry(w, seat, vx, vy); vx = p.x; vy = p.y; }
    assert.ok(Math.abs(vx - w.v / 60) < 0.05, 'takes on her speed');
    assert.ok(Math.abs(vy) < 0.05);
    assert.equal(whaleCarry(w, { x: seat.x, y: seat.y + WHALE.seatRadius + 10 }, 0, 0), null);
});

test('one touch tears off one piece, even where two hang within reach', () => {
    const w = createWhale(1000, 9000);
    stepWhale(w, 1 / 60, null, route, 0);      // she takes her place on the route
    const a = bodySpot(w, WHALE.nets[0], WHALE.netDrop[0]), b = bodySpot(w, WHALE.nets[1], WHALE.netDrop[1]);
    const between = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    assert.ok(Math.hypot(a.x - between.x, a.y - between.y) < WHALE.cutRadius, 'both are in reach from here');
    let cuts = 0;
    for (let i = 0; i < WHALE.cutPause * 60 - 2; i++) if (stepWhale(w, 1 / 60, between, route, 0)) cuts++;
    assert.equal(cuts, 1);
    for (let i = 0; i < 10; i++) if (stepWhale(w, 1 / 60, between, route, 0)) cuts++;
    assert.equal(cuts, 2, 'staying there takes the next one after a moment');
});
