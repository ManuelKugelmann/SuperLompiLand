import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKER_POOL, poolSize, createPool } from '../game/level/workerPool.js';

const fake = log => () => {
    const w = { got: [], postMessage(m) { w.got.push(m); log.push(w); }, terminate() { w.dead = true; }, answer(key) { w.onmessage({ data: { key } }); } };
    return w;
};

test('one core is kept for the game; never more than the most, never none', () => {
    assert.equal(poolSize(8), WORKER_POOL.max);
    assert.equal(poolSize(2), 1);
    assert.equal(poolSize(1), 1);
    assert.equal(poolSize(undefined), 1);
});

test('requests go to the least busy worker, answers free it, materials reach all', () => {
    const log = [], made = [];
    const pool = createPool(() => { const w = fake(log)(); made.push(w); return w; }, 3);
    const answers = [];
    pool.onmessage = e => answers.push(e.data.key);
    pool.postMessage({ materials: [1] });
    assert.ok(made.every(w => w.got.length === 1), 'materials to every worker');
    for (const key of ['a', 'b', 'c', 'd']) pool.postMessage({ key });
    assert.deepEqual(pool.load(), [2, 1, 1]);
    made[1].answer('b');
    assert.deepEqual(pool.load(), [2, 0, 1]);
    pool.postMessage({ key: 'e' });
    assert.equal(made[1].got.at(-1).key, 'e', 'the freed worker takes the next');
    assert.deepEqual(answers, ['b']);
    pool.postMessage({ recycle: [] });
    pool.terminate();
    assert.ok(made.every(w => w.dead));
});
