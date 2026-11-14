import test from 'node:test';
import assert from 'node:assert/strict';
import { SEA_FAR, nextIslandX, socketView, passing } from '../game/level/seaFar.js';
import { BIOMES } from '../game/level/biomes.js';

const W = 1920, blue = BIOMES.find(b => b.id === 'blue'), kelp = BIOMES.find(b => b.id === 'kelp');

test('from the open blue the next island is the kelp island; after the last island there is none', () => {
    assert.equal(nextIslandX(blue.from + 5000), kelp.from);
    assert.equal(nextIslandX(BIOMES.at(-1).from + 100), null);
});

test('the socket of the island ahead comes in from the right as a clear dark shoulder and grows across the view', () => {
    assert.equal(socketView(kelp.from - SEA_FAR.socketFrom - 500, W), null, 'too far: nothing yet');
    const far = { ...socketView(kelp.from - 9000, W) }, near = { ...socketView(kelp.from - 3000, W) };
    assert.ok(far.alpha >= SEA_FAR.socketAlpha[0] * 0.99 && far.alpha < near.alpha, 'clear from the start, darker when closer');
    assert.ok(near.alpha <= SEA_FAR.socketAlpha[1] + 1e-9);
    assert.ok(far.x > near.x && far.x < W, 'its foot is on screen from the start and moves in');
    assert.ok(socketView(kelp.from - 4000, W).x < W * 0.5, '4000 px out it already fills the right half');
});

test('along a coast there is no sea far view', () => {
    assert.equal(socketView(kelp.from + 2000, W), null);
    assert.equal(socketView(0, W), null);
});

test('big shapes pass now and then, the same for everyone, within their limits', () => {
    const kinds = new Set();
    for (let n = 0; n < 60; n++) {
        const p = passing(n);
        assert.deepEqual(p, passing(n));
        assert.ok(SEA_FAR.kinds.includes(p.kind));
        if (n === 0) assert.equal(p.wait, SEA_FAR.firstPass, 'the first one comes soon');
        else assert.ok(p.wait >= SEA_FAR.passEvery[0] && p.wait <= SEA_FAR.passEvery[1]);
        assert.ok(p.time >= SEA_FAR.passTime[0] && p.time <= SEA_FAR.passTime[1]);
        assert.ok(p.depth > 0.2 && p.depth < 0.85 && Math.abs(p.dir) === 1);
        kinds.add(p.kind);
    }
    assert.equal(kinds.size, SEA_FAR.kinds.length);
});
