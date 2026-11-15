import test from 'node:test';
import assert from 'node:assert/strict';
import { ART, atlasFiles, artIndex, artFrom } from '../game/art.js';
import { BIOMES } from '../game/level/biomes.js';

test('one atlas per biome and one common one; the half-size twins keep the keys', () => {
    const full = atlasFiles(), half = atlasFiles(true);
    assert.equal(full.length, BIOMES.length + 1);
    full.forEach((f, i) => {
        assert.ok(f.json.endsWith(`${f.key}.json`) && f.path === ART.dir);
        assert.equal(half[i].key, f.key, 'the game asks for the same key at either size');
        assert.ok(half[i].json.endsWith(`${f.key}@half.json`));
    });
});

test('a picture comes from the current biome atlas, else the common one, else any atlas, else its own texture', () => {
    const index = artIndex([
        { key: ART.common, frames: ['__BASE', 'coin', 'coral_2'] },
        { key: ART.biome('reef'), frames: ['coral_2', 'coral_fan'] },
        { key: ART.biome('kelp'), frames: ['kelp_stalk_1'] }
    ]);
    assert.deepEqual(artFrom(index, 'coral_2', 'reef'), [ART.biome('reef'), 'coral_2']);
    assert.deepEqual(artFrom(index, 'coral_2', 'kelp'), [ART.common, 'coral_2']);
    assert.deepEqual(artFrom(index, 'kelp_stalk_1', 'reef'), [ART.biome('kelp'), 'kelp_stalk_1']);
    assert.deepEqual(artFrom(index, 'urchin', 'reef'), ['urchin', undefined], 'not in any atlas: its own texture (or stand-in)');
    assert.equal(index.has('__BASE'), false);
});
