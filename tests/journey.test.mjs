import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNEY, chapters, createJourney } from '../game/journey.js';
import { BIOMES, WORLD_WEST, WORLD_END } from '../game/level/biomes.js';
import { CHARACTERS } from '../game/characters.js';

test('one chapter per biome, west to east, each event inside its biome', () => {
    const list = chapters();
    assert.equal(list.length, BIOMES.length);
    list.forEach((c, i) => {
        assert.equal(c.id, BIOMES[i].id);
        assert.ok(c.x > BIOMES[i].from && c.x < BIOMES[i].from + BIOMES[i].width);
        assert.ok(c.goal.de && c.goal.en);
    });
});

test('every playable friend but Lompi waits in exactly one chapter', () => {
    const ids = chapters().filter(c => c.friend).map(c => c.friend.id).sort();
    assert.deepEqual(ids, CHARACTERS.filter(c => c.id !== 'lompi').map(c => c.id).sort());
});

test('the first friend waits within half a minute of the start, on the calm route; the last chapter has no rescue: it ends the trip', () => {
    const list = chapters(), first = list[0];
    assert.ok(first.friend, 'the lagoon has a friend to free');
    // At cruise speed (about 330 px a second) half a minute is about 10 000 px.
    assert.ok(first.x > 4000 && first.x < 10000, `first friend at ${first.x}`);
    assert.equal(list[list.length - 1].friend, null);
    assert.equal(list.filter(c => c.friend).length, 6, 'six friends in all');
    assert.equal(new Set(list.filter(c => c.friend).map(c => c.friend.id)).size, 6, 'each one once');
});

test('freeing a friend is news once, is kept, and turns the goal into "onward"', () => {
    const j = createJourney();
    const c = j.list.find(ch => ch.friend);
    const before = j.goalAt(c.x, 'de');
    assert.equal(before, c.goal.de);
    assert.equal(j.free(c.friend.id), true);
    assert.equal(j.free(c.friend.id), false);
    assert.equal(j.free('nobody'), false);
    assert.equal(j.count, 1);
    assert.notEqual(j.goalAt(c.x, 'de'), before);
    const again = createJourney(JSON.parse(JSON.stringify(j)));
    assert.ok(again.has(c.friend.id));
    assert.equal(again.count, 1);
});

test('saved ids that mean nothing are dropped', () => {
    assert.equal(createJourney(['lompi', 'ghost', null]).count, 0);
});

test('progress runs 0..1 across the world and the chapter follows the place', () => {
    const j = createJourney();
    assert.equal(j.progress(WORLD_WEST - 500), 0);
    assert.equal(j.progress(WORLD_END + 500), 1);
    assert.ok(Math.abs(j.progress((WORLD_WEST + WORLD_END) / 2) - 0.5) < 1e-9);
    for (const c of j.list) assert.equal(j.chapterAt(c.x).id, c.id);
    assert.equal(j.total, 6);
    assert.ok(JOURNEY.far > JOURNEY.near && JOURNEY.specialRadius > JOURNEY.freeRadius);
});

test('the whale waits in the open blue, after the friend there, and is remembered without counting as a friend', () => {
    const j = createJourney();
    const blue = j.list.find(c => c.id === 'blue'), ev = j.event('whale');
    assert.ok(ev && ev.x > blue.x && ev.endX > ev.x);
    assert.equal(j.event('nothing'), null);
    assert.equal(j.free('whale'), true);
    assert.equal(j.count, 0);
    assert.ok(createJourney(j.toJSON()).has('whale'));
});
