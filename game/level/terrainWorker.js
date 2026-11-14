// Web Worker: everything about a chunk that is pure maths happens here, off the
// main thread — sampling the density field and shading the terrain pictures.
// Message in:  { materials }  once, the rock material tiles (see materials.js)
//              { seed, key, ox, oy, span, n }
// Message out: { key, coarse, rock, back }   (typed arrays, transferred, not copied)
import { createField, chunkGrids } from './density.js';
import { shadeChunk } from './shade.js';
import { setMaterials } from './materials.js';

let field = null, fieldSeed = null;

self.onmessage = e => {
    if (e.data.materials) { setMaterials(e.data.materials); return; }
    const { seed, key, ox, oy, span, n } = e.data;
    if (fieldSeed !== seed) { field = createField(seed); fieldSeed = seed; }
    const coarse = chunkGrids(field, seed, ox, oy, span, n).fine;
    const { rock, back } = shadeChunk(field, seed, ox, oy, span);
    self.postMessage({ key, coarse, rock, back }, [coarse.buffer, rock.buffer, back.buffer]);
};
