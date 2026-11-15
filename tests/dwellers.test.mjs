import test from 'node:test';
import assert from 'node:assert/strict';
import { DWELLERS, dwellerBand } from '../game/level/dwellers.js';

test('an ordinary swimmer may live anywhere in its chunk, clear of the sides', () => {
    assert.deepEqual(dwellerBand({}, 960, 960, 4000), [960 + DWELLERS.edge, 1920 - DWELLERS.edge]);
});

test('a surface dweller lives only up near the light: offered to the top chunk, never deeper', () => {
    const squid = { surface: 520 };
    const top = dwellerBand(squid, 0, 960, 4000);
    assert.ok(top && top[1] <= 520);
    assert.equal(dwellerBand(squid, 960, 960, 4000), null, 'not offered to a deeper chunk');
});

test('a floor dweller lives just over the seabed: only the chunk holding the seabed offers it', () => {
    const rock = { floor: 400 };
    const b = dwellerBand(rock, 1920, 960, 2600);
    assert.ok(b && b[0] >= 2600 - 400 && b[1] <= 2600 - DWELLERS.floorGap);
    assert.equal(dwellerBand(rock, 0, 960, 2600), null, 'the seabed is chunks below');
    assert.equal(dwellerBand(rock, 2880, 960, 2600), null, 'the seabed is above this chunk');
});

test('a grumpy keeps off the calm route: its band starts below the line it is given, or there is none', () => {
    const grump = { floor: 300 };
    const b = dwellerBand(grump, 960, 960, 1800, 1600);
    assert.ok(b && b[0] >= 1600);
    assert.equal(dwellerBand(grump, 960, 960, 1800, 1750), null, 'no room between the route keep-out and the seabed');
});
