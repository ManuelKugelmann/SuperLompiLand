// Web Worker: computes the density grids of a chunk off the main thread, so the
// noise sampling (the bulk of the pure maths) never costs a frame.
// Message in:  { seed, key, ox, oy, span, n }
// Message out: { key, fine, back }   (Float32Arrays, transferred, not copied)
import { createField, chunkGrids } from './density.js';

let field = null, fieldSeed = null;

self.onmessage = e => {
    const { seed, key, ox, oy, span, n } = e.data;
    if (fieldSeed !== seed) { field = createField(seed); fieldSeed = seed; }
    const { fine, back } = chunkGrids(field, seed, ox, oy, span, n);
    self.postMessage({ key, fine, back }, [fine.buffer, back.buffer]);
};
