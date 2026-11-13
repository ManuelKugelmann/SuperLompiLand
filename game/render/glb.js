// A small reader for binary glTF 2.0 (.glb): just what a creature needs — the
// triangles of the default scene with node transforms applied, normals, texture
// coordinates, base colour and the embedded base-colour picture. No skins, no
// animations, no extensions. Pure (ArrayBuffer in, typed arrays out), so it is
// engine-independent and unit-tested (tests/glb.test.mjs).

const COMPONENTS = { 5120: [Int8Array, 127], 5121: [Uint8Array, 255], 5122: [Int16Array, 32767], 5123: [Uint16Array, 65535], 5125: [Uint32Array, 4294967295], 5126: [Float32Array, 1] };
const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const READ = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' };

/**
 * @param {ArrayBuffer} buffer  the .glb file
 * @returns { primitives: [{ positions, normals, uvs, indices, color, image }], triangles }
 *   positions / normals  Float32Array xyz (normals null when the file has none)
 *   uvs      Float32Array uv, origin top-left (null when missing)
 *   indices  Uint32Array
 *   color    [r, g, b, a] base colour factor
 *   image    { bytes: Uint8Array, mime } embedded base-colour picture, or null
 */
export function parseGlb(buffer) {
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a .glb file');
    let json = null, bin = null;
    for (let at = 12; at < view.getUint32(8, true);) {
        const length = view.getUint32(at, true), type = view.getUint32(at + 4, true);
        if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, at + 8, length)));
        else if (type === 0x004e4942) bin = new DataView(buffer, at + 8, length);
        at += 8 + length + ((4 - (length % 4)) % 4);
    }
    if (!json) throw new Error('.glb without a JSON part');

    /** One accessor as a flat typed array (floats for attributes, Uint32 for indices). */
    const read = (index, asIndex = false) => {
        const acc = json.accessors[index], bv = json.bufferViews[acc.bufferView ?? 0];
        const n = SIZES[acc.type], [, max] = COMPONENTS[acc.componentType], width = COMPONENTS[acc.componentType][0].BYTES_PER_ELEMENT;
        const stride = bv.byteStride || n * width, start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
        const out = asIndex ? new Uint32Array(acc.count * n) : new Float32Array(acc.count * n);
        const get = READ[acc.componentType], scale = acc.normalized ? 1 / max : 1;
        for (let i = 0; i < acc.count; i++) {
            for (let k = 0; k < n; k++) out[i * n + k] = bin[get](start + i * stride + k * width, true) * scale;
        }
        return out;
    };

    const picture = material => {
        const tex = material?.pbrMetallicRoughness?.baseColorTexture;
        const img = tex && json.images?.[json.textures?.[tex.index]?.source];
        if (!img || img.bufferView === undefined) return null;
        const bv = json.bufferViews[img.bufferView];
        return { bytes: new Uint8Array(bin.buffer, bin.byteOffset + (bv.byteOffset || 0), bv.byteLength), mime: img.mimeType || 'image/png' };
    };

    const primitives = [];
    const visit = (nodeIndex, parent) => {
        const node = json.nodes[nodeIndex], world = multiply(parent, localMatrix(node));
        for (const prim of node.mesh === undefined ? [] : json.meshes[node.mesh].primitives) {
            if ((prim.mode ?? 4) !== 4 || prim.attributes.POSITION === undefined) continue;   // triangles only
            const positions = read(prim.attributes.POSITION);
            const normals = prim.attributes.NORMAL === undefined ? null : read(prim.attributes.NORMAL);
            for (let i = 0; i < positions.length; i += 3) {
                transform(world, positions, i, 1);
                if (normals) transform(world, normals, i, 0);
            }
            const indices = prim.indices === undefined
                ? Uint32Array.from({ length: positions.length / 3 }, (_, i) => i)
                : read(prim.indices, true);
            const material = json.materials?.[prim.material];
            primitives.push({
                positions, normals, indices,
                uvs: prim.attributes.TEXCOORD_0 === undefined ? null : read(prim.attributes.TEXCOORD_0),
                color: material?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1],
                image: picture(material)
            });
        }
        for (const child of node.children || []) visit(child, world);
    };
    const scene = json.scenes?.[json.scene ?? 0];
    for (const root of scene ? scene.nodes : (json.nodes || []).map((_, i) => i)) visit(root, IDENTITY);
    return { primitives, triangles: primitives.reduce((n, p) => n + p.indices.length / 3, 0) };
}

/** Centre a set of primitives on the origin and scale them so the largest side is `size` long. */
export function normalize(primitives, size = 1) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of primitives) {
        for (let i = 0; i < p.positions.length; i++) {
            const k = i % 3, v = p.positions[i];
            if (v < lo[k]) lo[k] = v;
            if (v > hi[k]) hi[k] = v;
        }
    }
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1, s = size / span;
    for (const p of primitives) {
        for (let i = 0; i < p.positions.length; i++) p.positions[i] = (p.positions[i] - (lo[i % 3] + hi[i % 3]) / 2) * s;
    }
    return { size: [(hi[0] - lo[0]) * s, (hi[1] - lo[1]) * s, (hi[2] - lo[2]) * s] };
}

// --- 4x4 matrices, column-major as in glTF ---------------------------------------

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a, b) {
    const out = new Array(16);
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
    }
    return out;
}

function localMatrix(node) {
    if (node.matrix) return node.matrix;
    const [x, y, z, w] = node.rotation || [0, 0, 0, 1], [sx, sy, sz] = node.scale || [1, 1, 1], [tx, ty, tz] = node.translation || [0, 0, 0];
    return [
        (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
        2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
        2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
        tx, ty, tz, 1
    ];
}

/** Transform the xyz at `i` in place; w = 1 for points, 0 for directions (which are renormalised). */
function transform(m, arr, i, w) {
    const x = arr[i], y = arr[i + 1], z = arr[i + 2];
    let ox = m[0] * x + m[4] * y + m[8] * z + m[12] * w, oy = m[1] * x + m[5] * y + m[9] * z + m[13] * w, oz = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    if (!w) { const len = Math.hypot(ox, oy, oz) || 1; ox /= len; oy /= len; oz /= len; }
    arr[i] = ox; arr[i + 1] = oy; arr[i + 2] = oz;
}
