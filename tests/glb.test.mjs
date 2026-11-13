import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGlb, normalize } from '../game/render/glb.js';

/** Build a tiny .glb in memory: one textured triangle on a node that is moved and scaled. */
function tinyGlb({ shortIndices = true } = {}) {
    const positions = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const normals = Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const uvs = Uint16Array.from([0, 0, 65535, 0, 0, 65535]);              // normalised shorts
    const indices = shortIndices ? Uint16Array.from([0, 1, 2]) : Uint32Array.from([0, 1, 2]);
    const picture = Uint8Array.from([137, 80, 78, 71, 1, 2, 3]);           // not a real picture, just bytes
    const parts = [positions, normals, uvs, indices, picture].map(a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    const views = [];
    let at = 0;
    for (const p of parts) { views.push({ buffer: 0, byteOffset: at, byteLength: p.byteLength }); at += p.byteLength + ((4 - (p.byteLength % 4)) % 4); }
    const bin = new Uint8Array(at);
    parts.forEach((p, i) => bin.set(p, views[i].byteOffset));
    const json = {
        asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
        nodes: [{ children: [1], translation: [10, 0, 0] }, { mesh: 0, scale: [2, 2, 2] }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
        materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 0.5, 0.25, 1], baseColorTexture: { index: 0 } } }],
        textures: [{ source: 0 }], images: [{ bufferView: 4, mimeType: 'image/png' }],
        accessors: [
            { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
            { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
            { bufferView: 2, componentType: 5123, normalized: true, count: 3, type: 'VEC2' },
            { bufferView: 3, componentType: shortIndices ? 5123 : 5125, count: 3, type: 'SCALAR' }
        ],
        bufferViews: views, buffers: [{ byteLength: bin.byteLength }]
    };
    let text = new TextEncoder().encode(JSON.stringify(json));
    const pad = (4 - (text.byteLength % 4)) % 4;
    if (pad) { const t = new Uint8Array(text.byteLength + pad).fill(32); t.set(text); text = t; }
    const total = 12 + 8 + text.byteLength + 8 + bin.byteLength;
    const out = new ArrayBuffer(total), view = new DataView(out), bytes = new Uint8Array(out);
    view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
    view.setUint32(12, text.byteLength, true); view.setUint32(16, 0x4e4f534a, true); bytes.set(text, 20);
    const b = 20 + text.byteLength;
    view.setUint32(b, bin.byteLength, true); view.setUint32(b + 4, 0x004e4942, true); bytes.set(bin, b + 8);
    return out;
}

test('reads triangles with the node transforms applied', () => {
    const { primitives, triangles } = parseGlb(tinyGlb());
    assert.equal(triangles, 1);
    const p = primitives[0];
    assert.deepEqual(Array.from(p.positions), [10, 0, 0, 12, 0, 0, 10, 2, 0]);      // scaled by 2, moved by 10
    assert.deepEqual(Array.from(p.normals), [0, 0, 1, 0, 0, 1, 0, 0, 1]);           // directions stay unit length
    assert.deepEqual(Array.from(p.indices), [0, 1, 2]);
});

test('normalised integer texture coordinates become 0..1', () => {
    const p = parseGlb(tinyGlb()).primitives[0];
    assert.deepEqual(Array.from(p.uvs).map(v => Math.round(v * 1000) / 1000), [0, 0, 1, 0, 0, 1]);
});

test('base colour and the embedded picture come along', () => {
    const p = parseGlb(tinyGlb()).primitives[0];
    assert.deepEqual(p.color, [1, 0.5, 0.25, 1]);
    assert.equal(p.image.mime, 'image/png');
    assert.deepEqual(Array.from(p.image.bytes), [137, 80, 78, 71, 1, 2, 3]);
});

test('32-bit indices work too', () => {
    assert.deepEqual(Array.from(parseGlb(tinyGlb({ shortIndices: false })).primitives[0].indices), [0, 1, 2]);
});

test('something that is not a .glb is refused', () => {
    assert.throws(() => parseGlb(new ArrayBuffer(32)), /not a \.glb/);
});

test('normalize centres the model and fits its largest side', () => {
    const { primitives } = parseGlb(tinyGlb());
    const { size } = normalize(primitives, 1);
    assert.deepEqual(Array.from(primitives[0].positions), [-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0]);
    assert.deepEqual(size, [1, 1, 0]);
});
