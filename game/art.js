// Where a picture is drawn from (user: "art in atlases always a good idea; biome tiles and assets in one
// file"): a shared atlas when one holds it (one texture for many things: they batch into few draw calls),
// else its own texture, or the procedural stand-in made under that key. Atlases come one per biome
// ('atlas_<biome id>') and one for what every biome uses ('atlas_common'); a picture in several is taken
// from the current biome's first. Works with any, some or none of the atlas files present.

import { BIOMES } from './level/biomes.js';

export const ART = {
    common: 'atlas_common',
    biome: id => `atlas_${id}`,
    dir: 'img/atlas/'
};

/** Every atlas the game may load, as Phaser multiatlases (pages of 2048 px): [{ key, json, path }]; `half` = the half-size twins
 *  (same frame names, quality tier `halfArt`). Missing files are fine: the pictures come from their own textures. */
export function atlasFiles(half = false) {
    return [ART.common, ...BIOMES.map(b => ART.biome(b.id))].map(key => ({ key, json: `${ART.dir}${key}${half ? '@half' : ''}.json`, path: ART.dir }));
}

/** The index of loaded atlases: picture key -> the atlas keys that hold it. `atlases` = [{ key, frames: [names] }]. Pure. */
export function artIndex(atlases) {
    const index = new Map();
    for (const a of atlases) for (const f of a.frames) {
        if (f === '__BASE') continue;
        if (!index.has(f)) index.set(f, []);
        index.get(f).push(a.key);
    }
    return index;
}

/** [texture key, frame] for a picture: the biome's atlas, then the common one, then any that holds it; else its own key. Pure. */
export function artFrom(index, key, biomeId = null) {
    const at = index.get(key);
    if (!at) return [key, undefined];
    const want = biomeId ? ART.biome(biomeId) : null;
    if (want && at.includes(want)) return [want, key];
    if (at.includes(ART.common)) return [ART.common, key];
    return [at[0], key];
}

/** The scene's lookup (built once per game from the atlases the title screen loaded): art(scene, key, biomeId) -> [texture, frame]. */
export function art(scene, key, biomeId = null) {
    const reg = scene.game.registry;
    let index = reg.get('artIndex');
    if (!index) {
        index = artIndex(atlasFiles().filter(f => scene.textures.exists(f.key)).map(f => ({ key: f.key, frames: scene.textures.get(f.key).getFrameNames() })));
        reg.set('artIndex', index);
    }
    return artFrom(index, key, biomeId);
}
