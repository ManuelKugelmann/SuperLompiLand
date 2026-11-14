import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAIN, bonusFor, createChain, createSpin, coinWorth } from '../game/chain.js';

test('moves within the window build a chain; the fifth one enters flow', () => {
    const c = createChain();
    const verbs = ['leap', 'flip', 'landing', 'stream', 'special'];
    verbs.forEach((v, i) => {
        const r = c.add(v, i * 1000);
        assert.equal(r.count, i + 1);
        assert.equal(r.verb, v);
        assert.equal(r.entered, i + 1 === CHAIN.flowAt);
    });
    assert.ok(c.flow && c.count === 5 && c.last === 'special');
});

test('the same move does not count again at once, and unknown moves never count', () => {
    const c = createChain();
    assert.ok(c.add('stream', 0));
    assert.equal(c.add('stream', 1000), null, 'still the same current');
    assert.ok(c.add('stream', CHAIN.verbs.stream + 1));
    assert.equal(c.add('teleport', 5000), null);
    assert.ok(c.add('flip', 5000) && c.add('flip', 5000), 'two loops in a row both count');
    assert.equal(c.count, 4);
});

test('a chain runs out quietly and pays its bonus once', () => {
    const c = createChain();
    for (let i = 0; i < 7; i++) c.add(i % 2 ? 'flip' : 'trail', i * 500);
    assert.equal(c.tick(3000 + CHAIN.window), null, 'still inside the window');
    assert.deepEqual(c.tick(3000 + CHAIN.window + 1), { count: 7, bonus: bonusFor(7) });
    assert.equal(c.tick(99999), null);
    assert.equal(c.count, 0);
    assert.equal(c.flow, false);
});

test('a late move starts a new chain at one', () => {
    const c = createChain();
    c.add('leap', 0); c.add('landing', 1000);
    assert.equal(c.add('leap', 1000 + CHAIN.window + 1).count, 1);
});

test('ending a chain early returns what it was worth; an empty one returns nothing', () => {
    const c = createChain();
    assert.equal(c.end(), null);
    c.add('leap', 0); c.add('flip', 100); c.add('landing', 900);
    assert.deepEqual(c.end(), { count: 3, bonus: 1 });
    assert.ok(c.add('leap', 950), 'the move counts again in a new chain');
});

test('bonus: one coin per three moves', () => {
    assert.deepEqual([0, 2, 3, 5, 6, 12].map(n => bonusFor(n)), [0, 0, 1, 1, 2, 4]);
});

test('a flip is a long turn flown one way; a plain jump is none', () => {
    const circle = { flipTurn: Math.PI * 2 };
    const jump = createSpin();
    let plain = 0;
    for (let i = 0; i <= 40; i++) plain += jump.turn(-1.05 + i * 2.1 / 40);
    assert.equal(plain, 0, 'up, over and down is no flip');
    assert.ok(CHAIN.flipTurn > 2.6 && CHAIN.flipTurn < 4.3, 'more than a jump, less than what fits into one');
    const s = createSpin(circle);
    let loops = 0;
    for (let i = 0; i <= 100; i++) loops += s.turn(Math.atan2(Math.sin(i * 0.13), Math.cos(i * 0.13)));   // 13 rad
    assert.equal(loops, 2);
    const wobble = createSpin();
    let none = 0;
    for (let i = 0; i < 200; i++) none += wobble.turn(Math.sin(i * 0.3) * 2);
    assert.equal(none, 0, 'weaving left and right is no loop');
    const back = createSpin(circle);
    let l = 0;
    for (let i = 0; i <= 60; i++) l += back.turn(-i * 0.12);
    assert.equal(l, 1, 'backward loops count too');
    back.reset();
    assert.equal(back.turn(3), 0);
});

test('a coin counts more in a streak or in flow; the two do not stack and there is a cap', () => {
    assert.equal(coinWorth(1, false), 1);
    assert.equal(coinWorth(2, false), 2, 'streak x2');
    assert.equal(coinWorth(3, false), 3);
    assert.equal(coinWorth(1, true), CHAIN.flowCoins, 'flow alone');
    assert.equal(coinWorth(2, true), 2, 'no stacking');
    assert.equal(coinWorth(3, true), 3, 'the bigger one wins');
    assert.equal(coinWorth(7, true), CHAIN.coinCap, 'capped');
    assert.equal(coinWorth(undefined, false), 1, 'no streak information: one coin');
    assert.equal(coinWorth(0, false), 1);
});
