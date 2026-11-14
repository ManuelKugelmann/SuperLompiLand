import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAILS, trailOf, chooseTrail, trailLabel } from '../game/trails.js';

test('a trail is bought once with enough coins, then owned and worn', () => {
    const r = chooseTrail('glint', 50, []);
    assert.deepEqual(r, { ok: true, coins: 10, owned: ['glint'], worn: 'glint', missing: 0 });
    const again = chooseTrail('glint', 10, ['glint']);
    assert.equal(again.coins, 10);
    assert.equal(again.worn, 'glint');
});

test('too few coins: nothing changes and the missing coins are told', () => {
    const r = chooseTrail('plankton', 30, ['glint']);
    assert.equal(r.ok, false);
    assert.equal(r.coins, 30);
    assert.equal(r.missing, trailOf('plankton').price - 30);
});

test('no trail is always free; an unknown id is no trail', () => {
    assert.equal(chooseTrail('none', 0, []).worn, 'none');
    assert.equal(trailOf('nothing').id, 'none');
});

test('labels show price, owned and worn', () => {
    const g = trailOf('glint');
    assert.ok(trailLabel(g, [], 'none').includes(String(g.price)));
    assert.ok(!trailLabel(g, ['glint'], 'none').includes(String(g.price)));
    assert.ok(trailLabel(g, ['glint'], 'glint').endsWith('✓'));
    assert.ok(TRAILS.list.every(t => t.name.de && t.name.en));
});
