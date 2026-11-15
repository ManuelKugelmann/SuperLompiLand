import Phaser from 'phaser';
import { SHADE, SAND_SKIN } from '../level/shade.js';
import { FIELD } from '../level/density.js';
import { MAT, MATERIALS } from '../level/materials.js';
import { TILE_TERRAIN, texelStep } from '../level/tileTerrain.js';
import { SURFACE_CAUSTICS as C } from './causticsMath.js';
import { WEB_GLSL, causticsView } from './CausticsPipeline.js';

// The landscape shaded on the graphics card (level/tileTerrain.js). A chunk is drawn as two plain
// quads (its back at depth -6, its rock at -2) whose texture is the shared atlas of density tiles;
// everything the shader needs to know about a chunk is in its tile (writeLook), so all chunks of a
// kind are drawn in one batch. It reads the chunk's tile round each pixel and works out what level/shade.js paints per
// pixel in the worker: the outline, the rounding of the rock toward its rim, the light, the palette
// from rim to core, the sand skin on upward faces, the back rock and the shade next to rock. The
// stone's grain comes from the shared material tiles (level/materials.js), repeated over the world.

export const TERRAIN = 'TileTerrain';
/** The chunks' backs (back rock, shade next to rock). */
export const TERRAIN_BACK = 'TileTerrainBack';
/** The same, lighter for the lowest tiers (a weak graphics chip): one stone, no ripples, no net of light, the slope from four reads. */
export const TERRAIN_LITE = 'TileTerrainLite';
const f = v => Number(v).toFixed(6), TAU = (Math.PI * 2).toFixed(6);
const S = SHADE, T = TILE_TERRAIN;

const VERT = `
#define SHADER_NAME TILE_TERRAIN_VS
precision highp float;
uniform mat4 uProjectionMatrix;
attribute vec2 inPosition;
attribute vec2 inTexCoord;
attribute float inTexId;
attribute float inTintEffect;
attribute vec4 inTint;
varying vec2 outPos;
varying vec2 outTex;
void main () {
    gl_Position = uProjectionMatrix * vec4(inPosition, 1.0, 1.0);
    outPos = inPosition;
    outTex = inTexCoord;
}`;

const frag = (lite, back) => `
#define SHADER_NAME TILE_TERRAIN_FS
${lite ? '#define LITE' : ''}
${back ? '#define BACK' : ''}
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;   // the density tiles
uniform sampler2D uMat;           // the material tiles, 4 x 2 places of ${MAT.size} px
uniform float uMatOn;
uniform vec2 uAtlas;              // the density atlas, px
uniform vec2 uScroll;             // the view's top left in the world
uniform float uTime;              // the net of light (CausticsPipeline's numbers this frame)
uniform float uStrength;
uniform vec3 uTint;
varying vec2 outPos;
varying vec2 outTex;              // where in the density atlas: the quad's frame spans the chunk's own texels

const float TH = ${f(FIELD.threshold)};
const float STEP = ${f(texelStep(960))};
const float BORDER = ${f(T.border)};
const float RANGE = ${f(T.range)};
const float CELL = ${f(T.size)};
vec2 origin;                      // this chunk's place in the atlas (its top left texel)

float dens(vec2 i) {
    vec4 c = texture2D(uMainSampler, (origin + i + 0.5) / uAtlas);
    return TH + ((c.r * 255.0 * 256.0 + c.g * 255.0) / 65535.0 - 0.5) * 2.0 * RANGE;
}
vec2 back(vec2 i) { return texture2D(uMainSampler, (origin + i + 0.5) / uAtlas).ba; }      // back rock cover, distance to rock (0..1 of occlusionReach)

// The chunk's look (row 0 of its tile, writeLook): texel k.
vec4 look(float k) { return texture2D(uMainSampler, (origin + vec2(k, 0.0) + 0.5) / uAtlas); }

// The palette from rim (0) to core (4), blended across the chunk (texels 0-4 at its left edge, 5-9 at its right).
vec3 pal(float k, float side) {
    float i = min(floor(k), 3.0), t = k - i;
    return mix(mix(look(i).rgb, look(i + 1.0).rgb, t), mix(look(i + 5.0).rgb, look(i + 6.0).rgb, t), side);
}

${WEB_GLSL}

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
    vec2 i = floor(p), q = fract(p); q = q * q * (3.0 - 2.0 * q);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), q.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), q.x), q.y);
}

// One material at world point w: colour relative to its mean (rgb), height (a).
// (A material texel is a rock-picture pixel: the stone has the grain size it has in the painted pictures.)
vec4 mat(float m, vec2 w) {
    vec2 cell = vec2(mod(m, 4.0), floor(m / 4.0)) * ${f(MAT.size)};
    vec2 p = cell + 1.0 + fract(w * ${f(S.rockSize / 960)} / ${f(MAT.size)}) * ${f(MAT.size - 2)};
    return texture2D(uMat, p / vec2(${f(MAT.size * 4)}, ${f(MAT.size * 2)}));
}

void main () {
    vec2 world = outPos + uScroll;
    vec2 tt = outTex * uAtlas - 0.5;               // atlas texels (texel i's middle at i)
    origin = floor(tt / CELL) * CELL;
    vec2 t = tt - origin;                          // texels into the tile: BORDER .. CELL - 1 - BORDER over the chunk
    // Each chunk draws exactly its own square: where two quads meet, no pixel is drawn twice (a see-through back would show a line).
    if (t.x < BORDER || t.y < BORDER || t.x >= CELL - 1.0 - BORDER || t.y >= CELL - 1.0 - BORDER) discard;
    vec2 i0 = floor(t), fr = t - i0;
    float side = (t.x - BORDER) / (CELL - 1.0 - 2.0 * BORDER);
    vec4 l14 = look(14.0), l15 = look(15.0);
    vec4 mats = vec4(l14.ba, l15.rg) * 255.0;      // main and second material, left and right
    float deepK = clamp(world.y / ${f(FIELD.maxDepth)}, 0.0, 1.0);
    vec3 deepTint = vec3(${S.deepTint.map(v => f(v / 255)).join(', ')});

    // The density and its slope, smooth across texels (central differences, blended): a slope that jumps from texel to texel would show as lines.
    float d00 = dens(i0), d10 = dens(i0 + vec2(1.0, 0.0)), d01 = dens(i0 + vec2(0.0, 1.0)), d11 = dens(i0 + vec2(1.0, 1.0));
    float d = mix(mix(d00, d10, fr.x), mix(d01, d11, fr.x), fr.y);
#ifdef LITE
    float gx = mix(d10 - d00, d11 - d01, fr.y) / STEP, gy = mix(d01 - d00, d11 - d10, fr.x) / STEP;
#else
    float gx00 = d10 - dens(i0 + vec2(-1.0, 0.0)), gx10 = dens(i0 + vec2(2.0, 0.0)) - d00;
    float gx01 = d11 - dens(i0 + vec2(-1.0, 1.0)), gx11 = dens(i0 + vec2(2.0, 1.0)) - d01;
    float gy00 = d01 - dens(i0 + vec2(0.0, -1.0)), gy01 = dens(i0 + vec2(0.0, 2.0)) - d00;
    float gy10 = d11 - dens(i0 + vec2(1.0, -1.0)), gy11 = dens(i0 + vec2(1.0, 2.0)) - d10;
    float gx = mix(mix(gx00, gx10, fr.x), mix(gx01, gx11, fr.x), fr.y) / (2.0 * STEP);
    float gy = mix(mix(gy00, gy10, fr.x), mix(gy01, gy11, fr.x), fr.y) / (2.0 * STEP);
#endif
    float gl = max(1e-5, length(vec2(gx, gy)));
    float dist = (d - TH) / gl;
#ifdef BACK
    {
        // The back: shade gathering in the water next to rock, and back rock under overhangs.
        vec2 bk = mix(mix(back(i0), back(i0 + vec2(1.0, 0.0)), fr.x), mix(back(i0 + vec2(0.0, 1.0)), back(i0 + vec2(1.0, 1.0)), fr.x), fr.y);
        float cov = bk.x;
        float occ = d >= TH ? 1.0 : 1.0 - smoothstep(0.0, 1.0, bk.y);
        float occA = ${f(S.occlusion)} * occ * occ;
        float rockA = ${f(S.backRockAlpha)} * cov;
        float a = occA + rockA * (1.0 - occA);
        if (a <= 0.004) discard;
        float tone = 0.8 + 0.4 * (uMatOn > 0.5 ? mat(mix(mats.x, mats.z, step(0.5, side)), world).a : 0.5);
        vec3 far = pal(2.0, side) * tone * (1.0 - ${f(1 - S.backRockDark)} * rockA / ${f(S.backRockAlpha)});
        far = mix(far, deepTint, ${f(S.deepMix)} * deepK);
        far = mix(far, mix(look(12.0).rgb, look(13.0).rgb, side), ${f(S.backRockFog)});
        vec3 col = (vec3(${[4, 22, 42].map(v => f(v / 255)).join(', ')}) * occA + far * rockA * (1.0 - occA)) / a;
        gl_FragColor = vec4(col * a, a);
    }
#else

    // The rock.
    if (d < TH - 0.02) discard;
    float alpha = clamp(dist / 1.4 + 0.5, 0.0, 1.0);
    if (alpha <= 0.0) discard;
    float inside = max(dist, 0.0);

    float outY = -gy / gl;
    float edge = inside >= ${f(S.bevel)} ? 0.0 : 1.0 - inside / ${f(S.bevel)};
    float tilt = edge * sqrt(edge) * ${f(S.relief)};
    vec3 stone = vec3(1.0);
    vec2 bumpN = vec2(0.0);
#ifdef LITE
    if (uMatOn > 0.5) stone = mat(side < 0.5 ? mats.x : mats.z, world).rgb * ${f(255 / 128 * MAT.colour)};
#else
    if (uMatOn > 0.5) {
        float m2 = smoothstep(${f(1 - MAT.share - 0.08)}, ${f(1 - MAT.share + 0.08)}, vnoise(world / ${f(MAT.maskScale)}));
        vec2 ms = side < 0.5 ? mats.xy : mats.zw;
        vec4 a = mat(ms.x, world), b = mat(ms.y, world.yx + vec2(151.0, 333.0));
        vec4 c = mix(a, b, m2);
        stone = c.rgb * ${f(255 / 128 * MAT.colour)};      // as shade.js: the stone's colour relative to its mean, times MAT.colour
        float hx = mix(mat(ms.x, world + vec2(1.5, 0.0)).a, mat(ms.y, world.yx + vec2(151.0, 334.5)).a, m2) - c.a;
        float hy = mix(mat(ms.x, world + vec2(0.0, 1.5)).a, mat(ms.y, world.yx + vec2(152.5, 333.0)).a, m2) - c.a;
        bumpN = vec2(hx, hy) * 2.0 * ${f(MAT.relief * 8)};
        float big = mat(ms.x, world / 6.0 + vec2(97.0, 211.0)).a;
        stone += ${f(MAT.macro * 2)} * (big - 0.5);
    }
#endif
    float nx = -gx / gl * tilt - bumpN.x, ny = outY * tilt - bumpN.y;
    float nl = 1.0 / sqrt(nx * nx + ny * ny + 1.0);
    nx *= nl; ny *= nl;
    vec3 L = normalize(vec3(${S.light.map(f).join(', ')}));
    float keyK = ${f(S.keyStrength)} * (1.0 - ${f(S.deepLight)} * deepK);
    float lambert = max(0.0, nx * L.x + ny * L.y + nl * L.z) * keyK;
    float up = 0.5 - 0.5 * ny;

    float r = min(1.0, inside / ${f(S.coreDist)});
    float depthIn = sqrt(r * sqrt(r)) * ${f(S.coreShade * 3.9999)};
    vec3 col = pal(depthIn, side);

    vec4 sand = mix(look(10.0), look(11.0), side);
    sand.w *= 255.0;      // reach in px
    float faceUp = outY > -0.25 ? 0.0 : smoothstep(0.25, 0.65, -outY) * smoothstep(${f(SAND_SKIN.flat[0])}, ${f(SAND_SKIN.flat[1])}, gl);
    float sandy = 0.0, under = 1.0;
    if (sand.w > 0.0 && faceUp > 0.0) {
        float deep = max(0.0, d - TH) / max(gl, ${f(SAND_SKIN.minSlope)}), fk = deep / sand.w;
        if (fk < 1.0) sandy = faceUp * mix(l14.r, l14.g, side) * (1.0 - smoothstep(0.3, 1.0, fk));
        else if (deep < sand.w + ${f(SAND_SKIN.under[0])}) under = 1.0 - ${f(SAND_SKIN.under[1])} * faceUp * sin(3.14159265 * (deep - sand.w) / ${f(SAND_SKIN.under[0])});
    }
#ifndef LITE
    if (sandy > 0.0) {
        // Rippled sand from the shared 'sand' material (crests run with the tile's y: turned to lie across the slope), else plain ripples.
        vec3 rip = uMatOn > 0.5 ? mat(${f(MATERIALS.indexOf('sand'))}, world.yx * vec2(1.0, 0.6)).rgb * ${f(255 / 128)}
            : vec3(1.0 + ${f(SAND_SKIN.ripple[0])} * sin(world.x * ${f(Math.PI * 2 / SAND_SKIN.ripple[1])} + world.y * ${f(Math.PI * 2 / SAND_SKIN.ripple[1] * 0.35)}));
        col = mix(col, sand.rgb * rip, sandy);
    }
#else
    col = mix(col, sand.rgb, sandy);
#endif
    col *= under;
    col = mix(col, deepTint, ${f(S.deepMix)} * deepK);
    vec3 bounce = vec3(${S.bounce.map(f).join(', ')}), sky = vec3(${S.sky.map(f).join(', ')}) - bounce, key = vec3(${S.key.map(f).join(', ')});
    vec3 light = bounce + sky * up + key * lambert;
    if (sandy > 0.0) {
        float lm = (light.r + light.g + light.b) / 3.0, k = sandy * ${f(SAND_SKIN.warm)};
        light = mix(light, vec3(lm * 1.06, lm, lm * 0.92), k) * (1.0 + sandy * ${f(SAND_SKIN.lift)});
    }
    col = col * stone * light;
#ifndef LITE
    // The net of light (as CausticsPipeline draws it on everything else): on faces that look up, in the top skin of the rock,
    // bent along the rock's own slope, fading with depth.
    float cd = clamp((${f(C.gone)} - world.y) / ${f(C.gone - C.full)}, 0.0, 1.0);
    cd *= cd * step(0.0, world.y);
    if (uStrength > 0.0 && cd > 0.0) {
        vec2 p = vec2(mod(world.x, ${f(C.period)}), world.y) + vec2(nx, ny) * ${f(C.wrap)};
        float wa = web(p * ${f(C.cells[0] / C.period)}, ${f(C.cells[0])}, uTime * ${f(C.drift[0])});
        float wb = web(p * ${f(C.cells[1] / C.period)} + 7.3, ${f(C.cells[1])}, uTime * ${f(C.drift[1])});
        float net = min(1.0, wa + 0.55 * wb);
        float shaft = ${f(C.shaft.floor)} + ${f(1 - C.shaft.floor)} * smoothstep(-0.3, 0.7, sin((p.x + world.y * ${f(C.shaft.slant)}) * ${TAU} * ${f(C.shaft.bands)} / ${f(C.period)} + uTime * ${f(C.shaft.speed)}));
        float catching = smoothstep(0.0, 0.5, -outY) * (1.0 - smoothstep(${f(C.skin[0] * S.rockSize * 1.5)}, ${f(C.skin[1] * S.rockSize * 1.5)}, inside));
        col += uTint * (net * shaft * cd * catching * uStrength);
    }
#endif
    gl_FragColor = vec4(col * alpha, alpha);
#endif
}`;

class TerrainPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game, name, lite = false, back = false) {
        super({ game, name, vertShader: VERT, fragShader: frag(lite, back) });
        this.view = { x: 0, y: 0 };
        this.matTexture = null;
        this.atlas = [1, 1];      // the density atlas's size, px (set with the atlas: setTerrainAtlas)
    }

    onPreRender() {
        this.set2f('uScroll', this.view.x, this.view.y);
        this.set2f('uAtlas', this.atlas[0], this.atlas[1]);
        this.set1f('uMatOn', this.matTexture ? 1 : 0);
        this.set1i('uMat', 1);
        const c = causticsView(this.game);
        this.set1f('uTime', c ? c.t : 0); this.set1f('uStrength', c ? c.strength : 0); this.set3f('uTint', c ? c.r : 1, c ? c.g : 1, c ? c.b : 1);
    }

    /** The material tiles on unit 1 for every quad (other pipelines use that unit too; binding it costs no batch). */
    onBind() {
        if (this.matTexture) this.bindTexture(this.matTexture, 1);
    }
}

const NAMES = [[TERRAIN, false, false], [TERRAIN_LITE, true, false], [TERRAIN_BACK, false, true]];

/** Make the pipeline known (WebGL only); `materials` = the prepared material tiles (or null: plain stone). True when it can be used. */
export function installTerrain(game, materials) {
    const r = game.renderer, pipes = r?.pipelines, gl = r?.gl;
    if (!pipes || !gl) return false;
    for (const [name, lite, back] of NAMES) if (!pipes.has(name)) pipes.add(name, new TerrainPipeline(game, name, lite, back));
    const p = pipes.get(TERRAIN);
    if (materials && !p.matTexture) {
        const N = MAT.size;
        p.matTexture = r.createTexture2D(0, gl.LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE, gl.RGBA, null, N * 4, N * 2, false, false, false);
        gl.activeTexture(gl.TEXTURE0);
        const before = gl.getParameter(gl.TEXTURE_BINDING_2D);
        gl.bindTexture(gl.TEXTURE_2D, p.matTexture.webGLTexture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);      // A is the stone's height, not a cover
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        MATERIALS.forEach((m, i) => gl.texSubImage2D(gl.TEXTURE_2D, 0, (i % 4) * N, Math.floor(i / 4) * N, N, N, gl.RGBA, gl.UNSIGNED_BYTE, materials[i]));
        gl.bindTexture(gl.TEXTURE_2D, before);
        for (const [name] of NAMES) pipes.get(name).matTexture = p.matTexture;
    }
    return true;
}

/** Per frame: the view's top left in the world. */
export function updateTerrain(game, scrollX, scrollY) {
    for (const [name] of NAMES) {
        const p = game.renderer?.pipelines?.get(name);
        if (p) { p.view.x = scrollX; p.view.y = scrollY; }
    }
}

/** The density atlas's size (px), for every terrain pipeline. */
export function setTerrainAtlas(game, w, h) {
    for (const [name] of NAMES) { const p = game.renderer?.pipelines?.get(name); if (p) p.atlas = [w, h]; }
}
