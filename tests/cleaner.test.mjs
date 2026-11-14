import test from 'node:test';
import assert from 'node:assert/strict';
import { CLEANER, createStation, stepStation } from '../game/ai/cleaner.js';

const run = (st, fishAt, s) => {
    const seen = [];
    for (let t = 0; t < s; t += 0.05) { const e = stepStation(st, 0.05, fishAt(t)); if (e) seen.push(e); }
    return seen;
};

test('a calm visitor is cleaned and healed once per visit', () => {
    const st = createStation(0, 0);
    const seen = run(st, () => ({ x: 60, y: 20, speed: 40 }), CLEANER.cleanS + 3);
    assert.deepEqual(seen, ['clean', 'heal'], 'one clean, one heal while staying');
    run(st, () => ({ x: 2000, y: 0, speed: 40 }), 1);                 // swims away ...
    assert.deepEqual(run(st, () => ({ x: 50, y: 0, speed: 30 }), CLEANER.cleanS + 1), ['clean', 'heal'], '... and a new visit heals again');
});

test('a dash scatters the wrasse; they come back later; swimming through does not heal', () => {
    const st = createStation(0, 0);
    assert.deepEqual(run(st, () => ({ x: 30, y: 0, speed: CLEANER.calmSpeed * 3 }), 0.2), ['scatter']);
    assert.equal(st.state, 'scattered');
    run(st, () => null, CLEANER.scatterS + 0.2);
    assert.equal(st.state, 'grouper');
    const passing = run(st, t => ({ x: -300 + t * 400, y: 0, speed: 400 * 0.3 + 0 }), 1.2);
    assert.ok(!passing.includes('heal'), 'a quick pass is not enough');
});

test('nobody around: the wrasse stay on the grouper', () => {
    const st = createStation(0, 0);
    assert.deepEqual(run(st, () => null, 5), []);
    assert.equal(st.state, 'grouper');
});
