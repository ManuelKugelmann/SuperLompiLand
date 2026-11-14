import test from 'node:test';
import assert from 'node:assert/strict';
import { SEA_FAR, nextIslandX, socketView, passing } from '../game/level/seaFar.js';
import { BIOMES } from '../game/level/biomes.js';

const W = 1920, blue = BIOMES.find(b => b.id === 'blue'), kelp = BIOMES.find(b => b.id === 'kelp');

test('from the open blue the next island is the kelp island; after the last island there is none', () => {
    assert.equal(nextIslandX(blue.from + 5000), kelp.from);
    assert.equal(nextIslandX(BIOMES.at(-1).from + 100), null);
});

test('the socket of the island ahead rises out of the haze as you come closer and reaches the middle at its edge', () => {
    assert.equal(socketView(kelp.from - SEA_FAR.socketFrom - 500, W), null, 'too far: nothing yet');
    const far = { ...socketView(kelp.from - 9000, W) }, near = { ...socketView(kelp.from - 3000, W) };
    assert.ok(far.alpha > 0 && far.alpha < near.alpha, 'clearer when closer');
    assert.ok(near.alpha <= SEA_FAR.socketAlpha + 1e-9, 'always a shape in the haze');
    assert.ok(far.x > near.x && near.x > W / 2, 'ahead, to the right, coming in');
    assert.ok(Math.abs(socketView(kelp.from - 1000, W).x - (W / 2 + 1000 * SEA_FAR.socketScroll)) < 1e-9);
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
        assert.ok(p.wait >= SEA_FAR.passEvery[0] && p.wait <= SEA_FAR.passEvery[1]);
        assert.ok(p.time >= SEA_FAR.passTime[0] && p.time <= SEA_FAR.passTime[1]);
        assert.ok(p.depth > 0.2 && p.depth < 0.85 && Math.abs(p.dir) === 1);
        kinds.add(p.kind);
    }
    assert.equal(kinds.size, SEA_FAR.kinds.length);
});
