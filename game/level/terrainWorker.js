// Web Worker: everything about a chunk that is pure maths happens here, off the
// main thread — sampling the density field and shading the terrain pictures.
// Message in:  { materials }  once, the rock material tiles (see materials.js)
//              { seed, key, ox, oy, span, n }
//              { seed, key, layer, cx, cy }  a rock layer chunk behind the play plane (rockLayerTable.js)
// Message out: { key, coarse, rock, back }   (typed arrays, transferred, not copied)
//              { key, layer, rock }
import { createField, chunkGrids } from './density.js';
import { shadeChunk } from './shade.js';
import { setMaterials } from './materials.js';
import { ROCK_LAYERS, LAYER_SHADE, layerField, layerChunkRect } from './rockLayerTable.js';

let field = null, fieldSeed = null;
const layerFields = new Map();      // "seed:layer" -> field

self.onmessage = e => {
    if (e.data.materials) { setMaterials(e.data.materials); return; }
    if (e.data.layer !== undefined) {
        const { seed, key, layer, cx, cy } = e.data, L = ROCK_LAYERS[layer], id = `${seed}:${layer}`;
        if (!layerFields.has(id)) layerFields.set(id, layerField(createField(seed + L.seed), L));
        const { ox, oy, span } = layerChunkRect(L, cx, cy);
        const { rock } = shadeChunk(layerFields.get(id), seed + L.seed, ox, oy, span, LAYER_SHADE);
        self.postMessage({ key, layer, rock }, [rock.buffer]);
        return;
    }
    const { seed, key, ox, oy, span, n } = e.data;
    if (fieldSeed !== seed) { field = createField(seed); fieldSeed = seed; }
    const coarse = chunkGrids(field, seed, ox, oy, span, n).fine;
    const { rock, back } = shadeChunk(field, seed, ox, oy, span);
    self.postMessage({ key, coarse, rock, back }, [coarse.buffer, rock.buffer, back.buffer]);
};
