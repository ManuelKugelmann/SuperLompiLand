import test from 'node:test';
import assert from 'node:assert/strict';
import { SEA_ARCH, seaArch, archRock, passedThrough, archCoins } from '../game/level/seaArch.js';
import { BIOMES } from '../game/level/biomes.js';

const arch = seaArch();

test('the arch stands on the rocky shore, its opening reaching from above the water to under it', () => {
    const shore = BIOMES.find(b => b.id === 'shore');
    assert.ok(arch.x > shore.from && arch.x < shore.from + shore.width);
    assert.ok(arch.open.top < -200, 'opening rises well above the surface');
    assert.equal(arch.open.bottom, SEA_ARCH.under);
    assert.ok(arch.open.x1 - arch.open.x0 > 700, 'wide enough for a big jump');
});

test('under the water: open through the middle, rock in the legs, nothing outside', () => {
    const mid = (arch.open.x0 + arch.open.x1) / 2;
    for (const y of [10, 200, 400, SEA_ARCH.under - 60]) assert.equal(archRock(arch, mid, y), -1, `open at ${y}`);
    assert.equal(archRock(arch, arch.x0 + 60, 300), 1, 'west leg');
    assert.equal(archRock(arch, arch.x1 - 60, 300), 1, 'east leg');
    assert.equal(archRock(arch, mid, SEA_ARCH.under + 200), 1, 'rock under the opening');
    assert.equal(archRock(arch, arch.x0 - 50, 300), 0);
    assert.equal(archRock(arch, mid, -100), 0, 'above water the picture is the arch');
});

test('passing through: under the surface and in a jump; not over the top or below the opening', () => {
    const mid = (arch.open.x0 + arch.open.x1) / 2;
    assert.ok(passedThrough(arch, { x: mid - 20, y: 300 }, { x: mid + 20, y: 300 }), 'swim through');
    assert.ok(passedThrough(arch, { x: mid - 20, y: -150 }, { x: mid + 20, y: -150 }), 'fly through');
    assert.ok(!passedThrough(arch, { x: mid - 20, y: arch.open.top - 100 }, { x: mid + 20, y: arch.open.top - 100 }), 'over the top');
    assert.ok(!passedThrough(arch, { x: mid - 20, y: 900 }, { x: mid + 20, y: 900 }), 'below it');
    assert.ok(!passedThrough(arch, { x: mid + 10, y: 300 }, { x: mid + 40, y: 300 }), 'no crossing');
});

test('the bonus coins arc through the opening above the water', () => {
    const coins = archCoins(arch);
    assert.equal(coins.length, SEA_ARCH.coins);
    const top = coins[Math.floor(coins.length / 2)];
    assert.ok(top.y < 0 && top.y > arch.open.top, 'the arc peaks inside the opening above the water');
    assert.ok(coins[0].y > top.y && coins.at(-1).y > top.y);
});
