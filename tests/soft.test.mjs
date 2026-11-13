import test from 'node:test';
import assert from 'node:assert/strict';
import { softnessMap, SoftHalo } from '../game/rig/soft.js';

// A fat round body on the right with a thin tail sticking out to the left.
const W = 48, H = 32;
const alpha = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
        const body = Math.hypot(x - 32, y - 16) < 12;
        const tail = x >= 4 && x < 24 && Math.abs(y - 16) < 2;
        alpha[y * W + x] = body || tail ? 255 : 0;
    }
}
const map = softnessMap(alpha, W, H);
const soft = (x, y) => map.soft[y * W + x];

test('thin parts are soft, the thick body is rigid — including its rim', () => {
    assert.ok(soft(8, 16) > 0.9, `tail: ${soft(8, 16)}`);
    assert.ok(soft(32, 16) < 0.05, `body centre: ${soft(32, 16)}`);
    assert.ok(soft(32, 6) < 0.05, `body rim (top): ${soft(32, 6)}`);
    assert.ok(soft(42, 16) < 0.05, `body rim (right): ${soft(42, 16)}`);
    assert.ok(soft(1, 1) > 0.9, 'empty space moves with whatever is near');
});

test('the centre is the middle of the thick body, not of the whole picture', () => {
    assert.ok(Math.abs(map.cx * W - 32) < 2.5, `cx ${map.cx * W}`);
    assert.ok(Math.abs(map.cy * H - 16) < 1.5, `cy ${map.cy * H}`);
});

test('an empty picture does not break', () => {
    const empty = softnessMap(new Uint8Array(16), 4, 4);
    assert.ok(Number.isFinite(empty.cx) && Number.isFinite(empty.cy));
});

// One ray of four links pointing right from (x0, 0).
const ray = (halo, x0) => { for (let i = 0; i < halo.points; i++) { halo.tx[i] = x0 + i * 10; halo.ty[i] = 0; } };
const opts = { stiffness: 0.12, drag: 0.16 };

test('at rest the soft parts sit exactly where the picture puts them', () => {
    const halo = new SoftHalo(1, 5);
    ray(halo, 0);
    for (let i = 0; i < 30; i++) halo.step(opts);
    for (let i = 0; i < 5; i++) assert.ok(Math.abs(halo.x[i] - i * 10) < 1e-3 && Math.abs(halo.y[i]) < 1e-3);
});

test('when the body darts off, the tip trails behind, then catches up', () => {
    const halo = new SoftHalo(1, 5);
    ray(halo, 0);
    halo.step(opts);
    let lag = 0;
    for (let i = 1; i <= 6; i++) {            // the body moves down 12 px per step
        for (let k = 0; k < 5; k++) halo.ty[k] = i * 12;
        halo.step(opts);
        lag = halo.ty[4] - halo.y[4];
    }
    assert.ok(lag > 10, `tip lags by ${lag}`);
    assert.equal(halo.y[0], halo.ty[0], 'the base is pinned to the body');
    for (let i = 0; i < 120; i++) halo.step(opts);
    assert.ok(Math.abs(halo.y[4] - halo.ty[4]) < 0.5, 'settles');
});

test('links keep their length', () => {
    const halo = new SoftHalo(1, 5);
    ray(halo, 0);
    halo.step(opts);
    for (let i = 1; i <= 8; i++) {
        for (let k = 0; k < 5; k++) { halo.tx[k] = i * 9 + k * 10; halo.ty[k] = i * 14; }
        halo.step(opts);
        for (let k = 1; k < 5; k++) {
            const len = Math.hypot(halo.x[k] - halo.x[k - 1], halo.y[k] - halo.y[k - 1]);
            assert.ok(Math.abs(len - 10) < 1e-3, `link ${k}: ${len}`);
        }
    }
});

test('a current carries the soft parts along', () => {
    const halo = new SoftHalo(1, 5);
    ray(halo, 0);
    halo.step(opts);
    for (let i = 0; i < 80; i++) halo.step({ ...opts, flowY: 3 });
    assert.ok(halo.y[4] > 1, `tip pushed by the current: ${halo.y[4]}`);
    assert.ok(Math.abs(halo.y[0]) < 1e-6);
});

test('a jump (respawn, mirror) snaps instead of whipping across the screen', () => {
    const halo = new SoftHalo(1, 5);
    ray(halo, 0);
    halo.step(opts);
    ray(halo, 5000);
    halo.step({ ...opts, reach: 200 });
    assert.equal(halo.x[4], 5040);
});
