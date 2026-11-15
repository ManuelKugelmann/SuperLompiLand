// The hero creatures' eyes are cut out of their painted pictures (rig/faces.js `hole`), so the living
// eyeball (RigEyes) is drawn behind the picture and its painted rim and lids frame it (user: "rim
// around eyes, eye shape, not goggly"). This makes, once per texture, a copy with the holes cut in.

/**
 * A copy of texture `key` with the eye holes of `eyes` (a FACES `eyes`) cut out; returns its key
 * (or `key` itself when nothing is to be cut or the texture is missing). `map(x, y)` turns picture px
 * into the texture's px (an atlas places the picture's body elsewhere).
 */
export function holedTexture(scene, key, eyes, map = (x, y) => [x, y]) {
    const holes = eyes?.at?.filter(a => a.hole) ?? [];
    if (!holes.length || !scene.textures.exists(key)) return key;
    const out = `${key}_eyeholes`;
    if (scene.textures.exists(out)) return out;
    const src = scene.textures.get(key).getSourceImage();
    const t = scene.textures.createCanvas(out, src.width, src.height), c = t.getContext();
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    for (const a of holes) {
        c.beginPath();
        a.hole.forEach(([x, y], i) => { const [u, v] = map(x, y); if (i) c.lineTo(u, v); else c.moveTo(u, v); });
        c.closePath(); c.fill();
    }
    t.refresh();
    return out;
}
