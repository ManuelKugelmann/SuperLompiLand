// Web Worker: everything about a chunk that is pure maths happens here, off the
// main thread — sampling the density field and shading the terrain pictures.
// Message in:  { materials }  once, the rock material tiles (see materials.js)
//              { seed, key, ox, oy, span, n }
//              { seed, key, layer, cx, cy }  a rock layer chunk behind the play plane (rockLayerTable.js)
//              { recycle: [ArrayBuffer, ...] }  picture arrays the main thread is done with, to be written into again
// Message out: { key, coarse, rock, back, islands }   (typed arrays, transferred, not copied; islands: [{ key, state, near }],
//              the floating-rock tiles round this chunk that were not sent before: the main thread's field is given them)
//              { key, layer, rock }
import { createField, chunkGrids } from './density.js';
import { shadeChunk } from './shade.js';
import { setMaterials } from './materials.js';
import { densityTile } from './tileTerrain.js';
import { ROCK_LAYERS, layerField, layerPicture } from './rockLayerTable.js';

let field = null, fieldSeed = null;
const sentTiles = new Set();      // island tiles the main thread has been given
const layerFields = new Map();      // "seed:layer" -> field

// Picture arrays that came back, by size: two megabytes per chunk would otherwise be allocated and thrown away
// again and again, and the main thread's garbage collector stops the game to clear them.
const spare = new Map(), SPARE_MAX = 12;
const take = bytes => {
    const buf = spare.get(bytes)?.pop();
    return buf ? new Uint8ClampedArray(buf).fill(0) : new Uint8ClampedArray(bytes);
};

self.onmessage = e => {
    if (e.data.materials) { setMaterials(e.data.materials); return; }
    if (e.data.recycle) {
        for (const buf of e.data.recycle) {
            const list = spare.get(buf.byteLength) || [];
            if (list.length < SPARE_MAX) { list.push(buf); spare.set(buf.byteLength, list); }
        }
        return;
    }
    if (e.data.layer !== undefined) {
        const { seed, key, layer, cx, cy } = e.data, L = ROCK_LAYERS[layer], id = `${seed}:${layer}`;
        if (fieldSeed !== seed) { field = createField(seed); fieldSeed = seed; }
        if (!layerFields.has(id)) layerFields.set(id, layerField(createField(seed + L.seed), L, { route: x => field.routeY(x) }));
        const rock = layerPicture(layerFields.get(id), seed + L.seed, L, cx, cy);
        self.postMessage({ key, layer, rock }, [rock.buffer]);
        return;
    }
    const { seed, key, ox, oy, span, n } = e.data;
    if (fieldSeed !== seed) { field = createField(seed); fieldSeed = seed; sentTiles.clear(); }
    const islands = field.islandTilesFor(ox, oy, span).filter(t => !sentTiles.has(t.key));
    for (const t of islands) sentTiles.add(t.key);
    const coarse = chunkGrids(field, seed, ox, oy, span, n).fine;
    if (e.data.tiles) {      // the landscape from tiles (?tiles): only the chunk's shape, the graphics card shades it (tileTerrain.js)
        const tile = densityTile(field, ox, oy, span);
        self.postMessage({ key, coarse, tile, rock: null, back: null, islands }, [coarse.buffer, tile.buffer]);
        return;
    }
    if (e.data.noShade) { self.postMessage({ key, coarse, rock: null, back: null, islands }, [coarse.buffer]); return; }      // measuring only (?noshade): what the world costs without its pictures
    const { rock, back } = shadeChunk(field, seed, ox, oy, span, undefined, take);
    self.postMessage({ key, coarse, rock, back, islands }, [coarse.buffer, rock.buffer, back.buffer]);
};
