import Phaser from 'phaser';
import { SURFACE_CAUSTICS as C } from './causticsMath.js';

/** Name under which the pipeline is registered; pictures that should catch caustics get it with setPipeline. */
export const CAUSTICS = 'SurfaceCaustics';

const TAU = (Math.PI * 2).toFixed(6), f = v => Number(v).toFixed(6);

// Like Phaser's own single-texture vertex shader, plus the vertex's place in the view.
const VERT = `
#define SHADER_NAME SURFACE_CAUSTICS_VS
precision mediump float;
uniform mat4 uProjectionMatrix;
uniform vec2 uResolution;
attribute vec2 inPosition;
attribute vec2 inTexCoord;
attribute float inTexId;
attribute float inTintEffect;
attribute vec4 inTint;
varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;
varying vec2 outPos;
void main () {
    gl_Position = uProjectionMatrix * vec4(inPosition, 1.0, 1.0);
    outTexCoord = inTexCoord;
    outTint = inTint;
    outTintEffect = inTintEffect;
    outPos = inPosition;
}`;

// Phaser's single-texture fragment shader, plus the net of light: worked out in world space
// (so it lies on the ground, not on the screen), pushed along the picture's own relief (so it
// bends over bumps: "wrapped", not flat), only on faces that are lit and look up, stronger near
// the surface and in the light shafts. The numbers are SURFACE_CAUSTICS (causticsMath.js).
const FRAG = `
#define SHADER_NAME SURFACE_CAUSTICS_FS
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform vec2 uScroll;      // the view's left edge wrapped to the pattern's period, and its top edge
uniform float uTime;
uniform float uStrength;
uniform vec3 uTint;
varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;
varying vec2 outPos;

float luma(vec4 c) { return dot(c.rgb, vec3(0.3, 0.59, 0.11)); }

// One layer: a square net of bright lines, warped so its cells swell and shrink like light under waves.
float net(vec2 p, float t) {
    p += 0.9 * vec2(sin(p.y * 0.5 + t), sin(p.x * 0.5 - t * 0.8));
    float v = sin(p.x) * sin(p.y);
    return pow(1.0 - abs(v), ${f(C.sharp)});
}

void main () {
    vec4 texture = texture2D(uMainSampler, outTexCoord);
    vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
    vec4 color = texture * texel;
    if (outTintEffect == 1.0) color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
    else if (outTintEffect == 2.0) color = texel;

    vec2 world = outPos + uScroll;
    float depth = clamp((${f(C.gone)} - world.y) / ${f(C.gone - C.full)}, 0.0, 1.0);
    depth *= depth * step(0.0, world.y);
    if (uStrength > 0.0 && depth > 0.0 && texture.a > 0.02) {
        // The picture's own relief: how its brightness changes sideways and downward.
        float l0 = luma(texture) / texture.a;
        float lx = luma(texture2D(uMainSampler, outTexCoord + vec2(0.004, 0.0))) / texture.a;
        float ly = luma(texture2D(uMainSampler, outTexCoord + vec2(0.0, 0.004))) / texture.a;
        vec2 relief = vec2(lx - l0, ly - l0);
        vec2 p = world + relief * ${f(C.wrap)};
        float k1 = ${TAU} * ${f(C.cells[0])} / ${f(C.period)}, k2 = ${TAU} * ${f(C.cells[1])} / ${f(C.period)};
        float a = net(p * k1, uTime * ${f(C.drift[0])});
        float b = net(vec2(p.x + p.y, p.x - p.y) * k2 * 0.5, uTime * ${f(C.drift[1])});
        float light = a * (0.45 + 0.55 * b) + 0.3 * b;
        float shaft = ${f(C.shaft.floor)} + ${f(1 - C.shaft.floor)} * smoothstep(-0.3, 0.7, sin((world.x + world.y * ${f(C.shaft.slant)}) * ${TAU} * ${f(C.shaft.bands)} / ${f(C.period)} + uTime * ${f(C.shaft.speed)}));
        float catching = smoothstep(${f(C.lit[0])}, ${f(C.lit[1])}, l0) * clamp(1.0 - relief.y * ${f(C.facing)}, 0.0, 1.0);
        color.rgb += uTint * (light * shaft * depth * catching * uStrength * color.a);
    }
    gl_FragColor = color;
}`;

class CausticsPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    constructor(game) {
        super({ game, name: CAUSTICS, vertShader: VERT, fragShader: FRAG });
        this.view = { x: 0, y: 0, t: 0, strength: 0, r: 1, g: 1, b: 1 };
    }

    onPreRender() {
        const v = this.view;
        this.set2f('uScroll', v.x, v.y);
        this.set1f('uTime', v.t);
        this.set1f('uStrength', v.strength);
        this.set3f('uTint', v.r, v.g, v.b);
    }
}

/** Make the pipeline known to the game (once; WebGL only, and only while SURFACE_CAUSTICS.strength is above 0). True when pictures can use it. */
export function installCaustics(game) {
    const pipes = game.renderer?.pipelines;
    if (!pipes || C.strength <= 0) return false;
    if (!pipes.has(CAUSTICS)) pipes.add(CAUSTICS, new CausticsPipeline(game));
    return true;
}

/**
 * Per frame: where the view is (its top left in the world), the time (s), how much light there
 * is (0..1: the sky's share, night or storm dim the net) and the water's hue (0xRRGGBB).
 */
export function updateCaustics(game, scrollX, scrollY, t, light = 1, hue = 0xffffff) {
    const p = game.renderer?.pipelines?.get(CAUSTICS);
    if (!p) return;
    const v = p.view, w = C.warmth, ch = s => ((hue >> s) & 255) / 255;
    v.x = ((scrollX % C.period) + C.period) % C.period; v.y = scrollY;
    v.t = t % (Math.PI * 2000);
    v.strength = C.strength * light;
    v.r = ch(16) + (1 - ch(16)) * w; v.g = ch(8) + (1 - ch(8)) * w; v.b = ch(0) + (1 - ch(0)) * w;
}
