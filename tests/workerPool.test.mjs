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

test('a key asked for twice frees both workers; routed answers go to their own listener', () => {
    const made = [], log = [];
    const pool = createPool(() => { const w = fake(log)(); made.push(w); return w; }, 2);
    const main = [], layers = [];
    pool.onmessage = e => main.push(e.data.key);
    pool.route('layer:', e => layers.push(e.data.key));
    pool.postMessage({ key: 'layer:0:1,2' });
    pool.postMessage({ key: 'layer:0:1,2' });      // culled while pending, asked for again
    assert.deepEqual(pool.load(), [1, 1]);
    made[0].answer('layer:0:1,2'); made[1].answer('layer:0:1,2');
    assert.deepEqual(pool.load(), [0, 0], 'no worker stays counted busy');
    made[0].answer('3,4');
    assert.deepEqual(main, ['3,4']);
    assert.deepEqual(layers, ['layer:0:1,2', 'layer:0:1,2']);
});

test('a worker holds at most `depth` requests; the rest wait (play plane first) and can be taken back', () => {
    const made = [];
    const pool = createPool(() => { const w = fake([])(); made.push(w); return w; }, 1);
    pool.route('layer:', () => {}, { later: true });
    for (const key of ['layer:a', 'layer:b', 'layer:c', 'w1', 'layer:d', 'w2']) pool.postMessage({ key });
    assert.deepEqual(made[0].got.map(m => m.key), ['layer:a', 'layer:b'], `${WORKER_POOL.depth} at once`);
    assert.equal(pool.waiting(), 4);
    assert.equal(pool.cancel('layer:c'), true, 'not sent yet: taken back');
    assert.equal(pool.cancel('layer:a'), false, 'already with the worker');
    made[0].answer('layer:a');
    made[0].answer('layer:b');
    assert.deepEqual(made[0].got.map(m => m.key).slice(2), ['w1', 'w2'], 'the world chunks jump the queue');
    made[0].answer('w1');
    assert.equal(made[0].got.at(-1).key, 'layer:d');
    assert.equal(pool.waiting(), 0);
});
