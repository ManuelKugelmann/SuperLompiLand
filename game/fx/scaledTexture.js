/**
 * A copy of a texture baked at a given size, for Blitter bobs (which cannot scale): one canvas
 * per (key, size), made once. Returns the copy's key, or null when the source is missing.
 */
export function scaledTexture(scene, key, w, h = w) {
    const tex = scene.textures, out = `${key}@${Math.round(w)}x${Math.round(h)}`;
    if (tex.exists(out)) return out;
    if (!tex.exists(key)) return null;
    const src = tex.get(key).getSourceImage(), c = tex.createCanvas(out, Math.round(w), Math.round(h));
    c.getContext().drawImage(src, 0, 0, Math.round(w), Math.round(h));
    c.refresh();
    return out;
}
