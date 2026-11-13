// Dev-only creature viewer (viewer.html, served by `npm run dev`; not part of the build).
// Shows candidate ways of giving one creature volume side by side — same light,
// same poses, hero zoom on top and gameplay size below — so the technique is
// picked by how it looks and moves.
//
//   viewer.html?creature=lompi            which set of candidates (CREATURES below)
//             &pose=turntable|swim|turn|puff   hold one pose (default: all, in a loop)
//             &t=1.25                     freeze time (seconds) for repeatable shots
//             &only=inflate               one candidate only
import MeshRenderer from './meshRenderer.js';
import { parseGlb, normalize } from './glb.js';
import { inflate, vertexNormals, shrinkMask } from '../rig/inflate.js';
import { loftBody, fitProfile } from '../rig/loft.js';
import { softnessMap } from '../rig/soft.js';

/**
 * Candidates per creature. Kinds:
 *   card     the picture on a flat quad, unlit — what the game shows today
 *   inflate  silhouette inflation of the picture (rig/inflate.js), `cells` across
 *   loft     a procedural body lofted over rings (rig/loft.js), fitted to the picture's body; fins and
 *            tail stay on a flat card in the middle plane
 *   glb      a 3D model file; `turn` = [yaw, pitch] in degrees to bring its nose to +x
 * Picture-based candidates use the CONTROLLED VIEW: the character is only ever seen from the
 * angle it was painted from, so its rest pose is the painting exactly; it banks a little
 * (VIEW_YAW) and turns around by mirroring with a quick squash, never by rotating through
 * profile. Generated 3D models rotate freely, for comparison.
 * Model files from experiments live under _ref/ (not in the repo); missing ones are skipped.
 */
const CREATURES = {
    lompi: [
        { id: 'sprite', label: 'Current sprite', note: 'flat picture', kind: 'card', image: 'img/puffer_normal.png' },
        { id: 'inflate', label: 'Silhouette inflation', note: 'scripted, from the picture', kind: 'inflate', image: 'img/puffer_normal.png', cells: 44 },
        { id: 'loft', label: 'Procedural (fitted)', note: 'lofted rings + fin card', kind: 'loft', image: 'img/puffer_normal.png', stations: 28, sides: 20, width: 0.86, box: 2.3 },
        { id: 'trellis1', label: 'Image-to-3D (TRELLIS)', note: 'generated mesh', kind: 'glb', url: '_ref/experiments/lompi/trellis1.glb', turn: [90, 0] },
        { id: 'trellis2', label: 'Image-to-3D (TRELLIS.2)', note: 'generated mesh', kind: 'glb', url: '_ref/experiments/lompi/trellis2.glb', turn: [90, 0] },
        { id: 'rodin', label: 'Image-to-3D (Rodin)', note: 'generated mesh', kind: 'glb', url: '_ref/experiments/lompi/rodin.glb', turn: [90, 0] }
    ]
};

const POSES = ['turntable', 'swim', 'turn', 'puff'];
const POSE_SECONDS = 4;
const GAME_SIZE = 170 / 1080;      // Lompi's width in the game as a share of the screen height
// A character swims turned a little toward the camera, so its face always reads
// (the art is a three-quarter view; in exact profile a 3D body loses mouth and far eye).
// It passes through profile only briefly while turning around.
const FACE_YAW = -30 * Math.PI / 180;
const VIEW_YAW = 25 * Math.PI / 180;     // controlled view: how far a picture-based character may bank to either side
const FLIP_SHARE = 0.15;                 // controlled view: share of the turn pose spent on each mirror flip

const query = new URLSearchParams(window.location.search);
const canvas = document.getElementById('view');
const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
const renderer = new MeshRenderer(gl);

const loadImage = url => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
});

function alphaOf(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const rgba = ctx.getImageData(0, 0, img.width, img.height).data, alpha = new Uint8Array(img.width * img.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    return alpha;
}

/** Rotate positions and normals by yaw (around y) then pitch (around x), in place. */
function turnBy(prim, [yawDeg, pitchDeg]) {
    const cy = Math.cos(yawDeg * Math.PI / 180), sy = Math.sin(yawDeg * Math.PI / 180);
    const cx = Math.cos(pitchDeg * Math.PI / 180), sx = Math.sin(pitchDeg * Math.PI / 180);
    for (const arr of [prim.positions, prim.normals]) {
        for (let i = 0; i < arr.length; i += 3) {
            const x = arr[i] * cy + arr[i + 2] * sy, z0 = -arr[i] * sy + arr[i + 2] * cy;
            const y = arr[i + 1] * cx - z0 * sx, z = arr[i + 1] * sx + z0 * cx;
            arr[i] = x; arr[i + 1] = y; arr[i + 2] = z;
        }
    }
}

/** Build one candidate: GPU meshes plus a few facts for the label. Returns null when its file is missing. */
async function build(c) {
    if (c.kind === 'card') {
        const img = await loadImage(c.image), w = 1, h = img.height / img.width;
        const prim = {
            positions: Float32Array.from([-w / 2, h / 2, 0, w / 2, h / 2, 0, w / 2, -h / 2, 0, -w / 2, -h / 2, 0]),
            normals: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
            uvs: Float32Array.from([0, 0, 1, 0, 1, 1, 0, 1]), indices: Uint32Array.from([0, 2, 1, 0, 3, 2])
        };
        return { ...c, meshes: [renderer.upload(prim, img)], triangles: 2, lit: 0 };
    }
    if (c.kind === 'inflate') {
        const img = await loadImage(c.image);
        const small = shrinkMask(alphaOf(img), img.width, img.height, c.cells);
        const mesh = inflate(small.alpha, small.w, small.h);
        // From picture cells (y down) to model space (y up, unit width): flipping y flips the winding too.
        const positions = new Float32Array(mesh.positions.length), indices = new Uint32Array(mesh.indices.length);
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] = mesh.positions[i] / small.w - 0.5;
            positions[i + 1] = (small.h / 2 - mesh.positions[i + 1]) / small.w;
            positions[i + 2] = mesh.positions[i + 2] / small.w;
        }
        for (let i = 0; i < indices.length; i += 3) { indices[i] = mesh.indices[i]; indices[i + 1] = mesh.indices[i + 2]; indices[i + 2] = mesh.indices[i + 1]; }
        const prim = { positions, indices, uvs: mesh.uvs, normals: vertexNormals(positions, indices) };
        return { ...c, meshes: [renderer.upload(prim, img)], triangles: mesh.triangles, lit: 1 };
    }
    if (c.kind === 'loft') {
        const img = await loadImage(c.image), aspect = img.height / img.width;
        // The body is the thick part of the picture; thin parts (fins, tail) are left to the card.
        const small = shrinkMask(alphaOf(img), img.width, img.height, 96);
        const soft = softnessMap(small.alpha, small.w, small.h).soft;
        const bodyMask = small.alpha.map((a, i) => (a > 40 && soft[i] < 0.5 ? 1 : 0));
        const fit = fitProfile(bodyMask, small.w, small.h, { width: c.width, box: c.box });
        const profile = t => {
            const p = fit.profile(t);
            return { x: p.x / small.w - 0.5, y: (small.h / 2 - p.y) / small.w, h: p.h / small.w, w: p.w / small.w, n: p.n };
        };
        const body = loftBody({ stations: c.stations, sides: c.sides, profile, uv: (x, y) => [x + 0.5, 0.5 - y / aspect] });
        body.normals = vertexNormals(body.positions, body.indices);
        const card = {
            positions: Float32Array.from([-0.5, aspect / 2, 0, 0.5, aspect / 2, 0, 0.5, -aspect / 2, 0, -0.5, -aspect / 2, 0]),
            normals: Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
            uvs: Float32Array.from([0, 0, 1, 0, 1, 1, 0, 1]), indices: Uint32Array.from([0, 2, 1, 0, 3, 2])
        };
        return { ...c, meshes: [renderer.upload(card, img), renderer.upload(body, img)], triangles: body.triangles + 2, lit: 1 };
    }
    const res = await fetch(c.url).catch(() => null);
    if (!res || !res.ok || (res.headers.get('content-type') || '').includes('text/html')) return null;
    const glb = parseGlb(await res.arrayBuffer());
    normalize(glb.primitives, 1);
    const meshes = [];
    for (const prim of glb.primitives) {
        prim.normals = prim.normals || vertexNormals(prim.positions, prim.indices);
        if (c.turn) turnBy(prim, c.turn);
        const image = prim.image ? await createImageBitmap(new Blob([prim.image.bytes], { type: prim.image.mime })) : null;
        meshes.push(renderer.upload(prim, image));
    }
    return { ...c, meshes, triangles: glb.triangles, lit: 1 };
}

/** What the model does at time t (seconds): the four poses in a loop, or the one asked for. */
function poseAt(t, fixed = query.get('pose')) {
    const index = fixed ? Math.max(0, POSES.indexOf(fixed)) : Math.floor(t / POSE_SECONDS) % POSES.length;
    const u = (t % POSE_SECONDS) / POSE_SECONDS, name = POSES[index];
    const ease = v => v * v * (3 - 2 * v);
    const pose = { name, u, yaw: FACE_YAW, pitch: 0, swim: 0.15, phase: t * 7, puff: 0 };
    if (name === 'turntable') pose.yaw = Math.sin(u * Math.PI * 2) * Math.PI / 3;                 // ±60° around true profile
    else if (name === 'swim') { pose.swim = 1; pose.yaw += Math.sin(t * 7) * 0.1; }
    else if (name === 'turn') {
        // From facing right to facing left and back: the far side also ends turned toward the camera.
        const k = u < 0.5 ? ease(Math.min(1, u * 4)) : 1 - ease(Math.min(1, (u - 0.5) * 4));
        pose.yaw = FACE_YAW + (Math.PI - 2 * FACE_YAW) * k;
    } else pose.puff = ease(Math.min(1, Math.sin(u * Math.PI) * 1.6));
    return pose;
}

const only = query.get('only');
const wanted = (CREATURES[query.get('creature')] || CREATURES.lompi).filter(c => !only || c.id === only);
const candidates = (await Promise.all(wanted.map(c => build(c).catch(e => { console.warn(c.id, e.message); return null; })))).filter(Boolean);

const labels = document.getElementById('labels');
for (const c of candidates) {
    const el = document.createElement('div');
    el.innerHTML = `${c.label}<small>${c.note} · ${c.triangles.toLocaleString('en')} triangles</small>`;
    labels.appendChild(el);
    c.el = el;
}
const bar = document.getElementById('bar');
for (const name of [null, ...POSES]) {
    const b = document.createElement('button');
    b.textContent = name || 'loop';
    b.className = (query.get('pose') || null) === name ? 'on' : '';
    b.onclick = () => { if (name) query.set('pose', name); else query.delete('pose'); window.location.search = query.toString(); };
    bar.appendChild(b);
}
const shot = document.createElement('button');
shot.textContent = 'screenshot';
shot.onclick = () => { const a = document.createElement('a'); a.download = `creature-${poseAt(now()).name}.png`; a.href = canvas.toDataURL('image/png'); a.click(); };
bar.appendChild(shot);

const start = performance.now();
function now() { return query.has('t') ? Number(query.get('t')) : (performance.now() - start) / 1000; }

/** Draw one frame; `at` = { pose, t } draws that exact moment (capture scripts), else the running clock. */
function frame(at = null) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.enable(gl.SCISSOR_TEST);
    const pose = at ? poseAt(at.t, at.pose) : poseAt(now()), n = Math.max(1, candidates.length), cw = Math.floor(W / n);
    const heroH = Math.floor(H * 0.68), gameH = H - heroH;
    candidates.forEach((c, i) => {
        // Hero zoom on top, on bright shallow water; gameplay size below, a little deeper.
        for (const [y, h, scale, depth, clear] of [[gameH, heroH, 0.78, 0, [0.16, 0.56, 0.72]], [0, gameH, GAME_SIZE * (H / gameH), 0.18, [0.07, 0.36, 0.55]]]) {
            gl.viewport(i * cw, y, cw, h);
            gl.scissor(i * cw, y, cw - 2, h - 2);
            gl.clearColor(...clear, 1);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            const flat = c.kind === 'card';
            let yaw = pose.yaw, mirror = 1;
            if (c.kind !== 'glb') {
                // Controlled view (see CREATURES): bank a little, mirror to turn around.
                yaw = pose.name === 'turntable' ? pose.yaw / (Math.PI / 3) * VIEW_YAW : pose.name === 'swim' ? pose.yaw - FACE_YAW : 0;
                if (pose.name === 'turn') {
                    const flip = v => Math.cos(Math.PI * Math.min(1, Math.max(0, v)));     // 1 -> -1 through a flat squash
                    mirror = pose.u < 0.5 ? flip(pose.u / FLIP_SHARE) : -flip((pose.u - 0.5) / FLIP_SHARE);
                    if (Math.abs(mirror) < 0.08) mirror = mirror < 0 ? -0.08 : 0.08;
                }
                if (flat) yaw = 0;                                                         // today's sprite: no banking at all
            }
            renderer.draw(c.meshes, { ...pose, yaw, mirror, puff: flat ? 0 : pose.puff, scale: scale * Math.min(1, cw / h * 1.1), aspect: cw / h, lit: c.lit, depth });
        }
        c.el.style.left = `${(i * cw) / dpr}px`;
        c.el.style.width = `${cw / dpr}px`;
    });
    gl.disable(gl.SCISSOR_TEST);
    window.__viewer = { pose: pose.name, seconds: POSE_SECONDS, draw: (name, t) => frame({ pose: name, t }), candidates: candidates.map(c => ({ id: c.id, label: c.label, triangles: c.triangles })) };
    if (!at) requestAnimationFrame(() => frame());
}
frame();
