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

test('nobody rescues themselves: in the chapter of the friend the player plays, Lompi waits instead', () => {
    const plain = chapters(), first = plain[0].friend.id;
    const mine = chapters(undefined, undefined, first);
    assert.equal(mine[0].friend.id, JOURNEY.standIn);
    assert.equal(mine[0].x, plain[0].x, 'where it waits does not change');
    assert.ok(!mine.some(c => c.friend?.id === first), 'the played character waits nowhere');
    assert.equal(mine.filter(c => c.friend).length, plain.filter(c => c.friend).length, 'still as many friends');
    assert.equal(new Set(mine.filter(c => c.friend).map(c => c.friend.id)).size, 6, 'each one once');
    for (let i = 1; i < plain.length; i++) assert.equal(mine[i].friend?.id, plain[i].friend?.id, 'the other chapters keep theirs');
    assert.deepEqual(chapters(undefined, undefined, JOURNEY.standIn).map(c => c.friend?.id), plain.map(c => c.friend?.id), 'playing Lompi changes nothing');
    const j = createJourney([], mine);
    assert.equal(j.free(JOURNEY.standIn), true);
    assert.equal(j.count, 1);
});

test('a rescue belongs to its chapter: a net that was emptied stays empty whoever is played next, and older saves still count', () => {
    const first = chapters()[0].friend.id;
    // Played as the first chapter's friend: Lompi hangs there and is freed.
    const a = createJourney([], chapters(undefined, undefined, first));
    assert.ok(a.free(JOURNEY.standIn));
    const saved = a.toJSON();
    assert.deepEqual(saved, [chapters()[0].id], 'the save names the chapter');
    // Next time played as Lompi: the same net holds the first friend again, but it counts as freed.
    const b = createJourney(saved);
    assert.ok(b.has(first));
    assert.equal(b.count, 1);
    assert.equal(b.free(first), false, 'no second rescue of the same net');
    assert.equal(b.goalAt(chapters()[0].x, 'de'), 'Weiter nach Osten!');
    // An older save holds character ids and event ids.
    const kelp = chapters().find(c => c.id === 'kelp');
    const old = createJourney([kelp.friend.id, 'whale', 'nobody']);
    assert.ok(old.has(kelp.friend.id) && old.has('whale'));
    assert.equal(old.count, 1);
    assert.deepEqual(old.toJSON().sort(), ['kelp', 'whale']);
    assert.deepEqual(old.friends(), [kelp.friend.id], 'who came along is named by character, without the events');
    // The same old save, now played as that very friend: the kelp net (Lompi in it) is still empty.
    const again = createJourney([kelp.friend.id], chapters(undefined, undefined, kelp.friend.id));
    assert.ok(again.has(JOURNEY.standIn));
    assert.equal(again.count, 1);
});
