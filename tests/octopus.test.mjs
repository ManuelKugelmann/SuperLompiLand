import test from 'node:test';
import assert from 'node:assert/strict';
import { OCTOPUS, createOctopus, stepOctopus } from '../game/ai/octopus.js';

const run = (o, s, fish) => { const ev = []; for (let t = 0; t < s; t += 0.05) { const e = stepOctopus(o, 0.05, typeof fish === 'function' ? fish(o) : fish); if (e) ev.push(e); } return ev; };

test('alone it crawls about its den and stays near it', () => {
    const o = createOctopus(1000);
    run(o, 40, null);
    assert.equal(o.state, 'roam');
    assert.ok(Math.abs(o.x - 1000) <= OCTOPUS.roam && o.camo === 0);
});

test('a calm visitor sees it hide, then grow curious once: coins', () => {
    const o = createOctopus(1000), calm = oc => ({ dx: 200, dist: 200, speed: 2 });
    run(o, 1, calm);
    assert.equal(o.state, 'hide'); assert.ok(o.camo > 0.9, 'melted into the sand');
    assert.deepEqual(run(o, OCTOPUS.curious + OCTOPUS.friendS + 3, calm), ['friend'], 'one gift per visit');
});

test('a dash makes it ink and jet away from the fish, then come home later', () => {
    const o = createOctopus(1000);
    assert.deepEqual(run(o, 0.1, { dx: 150, dist: 150, speed: 12 }), ['ink']);
    run(o, OCTOPUS.jetS + 0.2, null);
    assert.ok(o.x < 1000 - OCTOPUS.jet * 0.9, 'away from the fish (which came from the east)');
    run(o, OCTOPUS.back + 30, null);
    assert.equal(o.state, 'roam');
    assert.ok(Math.abs(o.x - 1000) <= OCTOPUS.roam * 2);
});
