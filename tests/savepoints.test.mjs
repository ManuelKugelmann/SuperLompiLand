import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE, savepoint, addSavepoint, latest, encode, decode, fromCookie, toCookie } from '../systems/savepoints.js';

test('one savepoint per nest, newest wins, sorted by nest', () => {
    let list = [];
    list = addSavepoint(list, savepoint({ nest: 2, coins: 40, character: 'lompi', t: 1 }));
    list = addSavepoint(list, savepoint({ nest: 0, coins: 5, character: 'lompi', t: 2 }));
    list = addSavepoint(list, savepoint({ nest: 2, coins: 90, character: 'shark', t: 3 }));
    assert.deepEqual(list.map(s => s.n), [0, 2]);
    assert.equal(list[1].c, 90);
    assert.equal(latest(list).n, 2);
    assert.equal(latest([]), null);
});

test('round trip through a cookie string, next to other cookies', () => {
    const list = [savepoint({ nest: 3, coins: 120, character: 'turtle', journey: ['seahorse', 'jellyfish'], relaxed: true, t: 1700 })];
    const assignment = toCookie(list);
    assert.ok(assignment.includes(`max-age=${SAVE.days * 86400}`));
    const jar = `other=1; ${assignment.split(';')[0]}; theme=dark`;
    assert.deepEqual(fromCookie(jar), list);
    assert.ok(assignment.length < 4000, 'fits one cookie');
});

test('garbage or foreign cookies give an empty list, never an error', () => {
    assert.deepEqual(fromCookie(''), []);
    assert.deepEqual(fromCookie('sll_saves=%7Bnot-json'), []);
    assert.deepEqual(decode(encode({ n: 1 })), []);
    assert.deepEqual(decode(encode([{ n: -1 }, { n: 1.5 }, null])), []);
});

test('a full world of savepoints stays small', () => {
    let list = [];
    for (let n = 0; n < 20; n++) list = addSavepoint(list, savepoint({ nest: n, coins: 9999, character: 'jellyfish', journey: ['a', 'b', 'c', 'd', 'e', 'f'], t: n }));
    assert.equal(list.length, SAVE.max);
    assert.ok(toCookie(list).length < 4000);
});
