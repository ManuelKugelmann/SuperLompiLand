import { createSlots, gridFor } from './atlasSlots.js';

/**
 * One big texture that holds the pictures of many chunks (atlasSlots.js hands out the places).
 * A picture's pixels go straight from the worker's array to the graphics card, a strip of rows at
 * a time (no canvas in between), and every picture in the atlas is drawn in the same draw call.
 * WebGL only: `ChunkAtlas.make` returns null where it cannot be had, and the caller keeps its
 * canvas pictures.
 */
export default class ChunkAtlas {
    /** `key` = texture key; `cell` = px a picture is wide and tall; `count` = pictures it must hold. */
    static make(scene, key, cell, count) {
        const r = scene.renderer, gl = r.gl;
        if (!gl || typeof r.createTexture2D !== 'function') return null;
        const side = gridFor(count);
        if (side * cell > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return null;
        return new ChunkAtlas(scene, key, cell, side);
    }

    constructor(scene, key, cell, side) {
        const r = scene.renderer, gl = r.gl;
        this.gl = gl; this.key = key; this.cell = cell;
        this.slots = createSlots(side, side, cell);
        const { w, h } = this.slots.size;
        this.wrapper = r.createTexture2D(0, gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.RGBA, null, w, h, true, true, false);
        this.texture = scene.textures.addGLTexture(key, this.wrapper);
        // A frame per place, half a pixel in from its edges: smooth sampling never reaches the picture next door.
        for (let i = 0; i < side * side; i++) { const p = this.slots.at(i); this.texture.add(String(i), 0, p.x + 0.5, p.y + 0.5, cell - 1, cell - 1); }
    }

    /** A free place (its index, also its frame's name), or null when the atlas is full. */
    take() { return this.slots.take(); }

    give(i) { this.slots.give(i); }

    /** Every place is free again (a new scene: the old one's pictures are gone). */
    reset() { this.slots.reset(); }

    /**
     * Rows `y0` to `y0 + rows` of a picture (`data`: its whole RGBA array, `cell` px wide) into place `i`.
     * The texture binding of unit 0 is put back as it was (the renderer keeps track of it).
     */
    upload(i, data, y0, rows) {
        const gl = this.gl, p = this.slots.at(i), c = this.cell;
        gl.activeTexture(gl.TEXTURE0);
        const before = gl.getParameter(gl.TEXTURE_BINDING_2D);
        gl.bindTexture(gl.TEXTURE_2D, this.wrapper.webGLTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, p.x, p.y + y0, c, rows, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer, data.byteOffset + y0 * c * 4, rows * c * 4));
        gl.bindTexture(gl.TEXTURE_2D, before);
    }
}
