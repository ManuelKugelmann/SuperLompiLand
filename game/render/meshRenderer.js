// A small raw-WebGL2 renderer for lit, textured creature meshes. It knows
// nothing about Phaser: it gets a WebGL2 context and draws into the current
// viewport, so the dev viewer uses it directly and the game can later host it
// in an Extern game object (Phaser 3.90 or 4).
//
// One shader for every candidate, so comparisons are fair:
//   light   soft key light from above, teal fill from the water, warm bounce
//           from below, up to two point lights, a rim, a depth tint
//   eyes    a mesh with an `eye` state ({ x, y, lid, pupil, iris, skin }) is drawn as a
//           procedural eye instead of a texture
//   motion  in the vertex shader: swim (a wave running to the tail), puff
//           (toward a ball), on top of the model rotation; a mesh can carry a
//           `part` matrix (hinge) to move on its own bone first
// Model space: +x nose, +y up, +z toward the viewer; the creature fits a unit box.

export const LIGHT = {
    sun: [-0.35, 0.8, 0.5],            // toward the light
    key: [1.0, 0.96, 0.86], keyStrength: 0.85,
    sky: [0.34, 0.47, 0.52], bounce: [0.22, 0.18, 0.15],
    points: [
        { pos: [0.9, -0.2, 0.8], color: [1.0, 0.72, 0.38] },     // warm, low on the right (a glowing friend, lava)
        { pos: [-1.0, 0.5, 0.4], color: [0.3, 0.75, 1.0] }       // cool, upper left (bioluminescence)
    ],
    pointStrength: 0.5,
    rim: 0.22,
    deep: [0.07, 0.2, 0.36]            // the colour everything fades toward with depth
};

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major matrix that turns a part about a pivot: first around z (flap), then around y (spread). */
export function hinge(px, py, pz, flap, spread = 0) {
    const cz = Math.cos(flap), sz = Math.sin(flap), cy = Math.cos(spread), sy = Math.sin(spread);
    // R = Ry(spread) * Rz(flap)
    const r = [cy * cz, sz, -sy * cz, 0, -cy * sz, cz, sy * sz, 0, sy, 0, cy, 0];
    const tx = px - (r[0] * px + r[4] * py + r[8] * pz), ty = py - (r[1] * px + r[5] * py + r[9] * pz), tz = pz - (r[2] * px + r[6] * py + r[10] * pz);
    return [...r, tx, ty, tz, 1];
}

const VERT = `#version 300 es
in vec3 aPos; in vec3 aNormal; in vec2 aUv;
uniform mat4 uProj; uniform mat4 uModel; uniform mat4 uPart;
uniform float uSwim; uniform float uPhase; uniform float uPuff; uniform float uLift;
out vec3 vNormal; out vec2 vUv; out vec3 vWorld;
void main() {
    // A part (a fin card on its own bone) is first moved within the creature.
    vec3 p = (uPart * vec4(aPos, 1.0)).xyz, n = normalize(mat3(uPart) * aNormal);
    // Puff: every point moves toward a ball around the centre.
    float r = length(p);
    vec3 ball = r > 1e-5 ? p / r : vec3(0.0, 1.0, 0.0);
    p = mix(p, ball * 0.4, uPuff * 0.7) * (1.0 + uPuff * 0.2) + ball * uLift * uPuff;   // parts stay on top of the puffed skin
    n = normalize(mix(n, ball, uPuff * 0.7));
    // Swim: the body bends sideways in a wave that grows toward the tail (-x).
    float t = clamp(0.5 - p.x, 0.0, 1.0);
    float bend = sin(uPhase - t * 3.2) * uSwim * t * t * 0.2;
    float slope = cos(uPhase - t * 3.2) * uSwim * t * t * 0.64;     // turn the normals with the bend
    p.z += bend;
    n = normalize(n + vec3(-slope * n.z, 0.0, slope * n.x) * 0.5);
    vec4 world = uModel * vec4(p, 1.0);
    vWorld = world.xyz; vNormal = mat3(uModel) * n; vUv = aUv;
    gl_Position = uProj * world;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vNormal; in vec2 vUv; in vec3 vWorld;
uniform sampler2D uTex; uniform vec4 uColor; uniform float uLit; uniform float uDepth;
uniform vec3 uSun, uKey, uSky, uBounce, uDeep, uP0, uC0, uP1, uC1; uniform float uRim; uniform float uMirror;
uniform float uEye, uLid, uPupil; uniform vec2 uLook; uniform vec3 uIris, uSkin;
out vec4 o;

// A procedural eye on a card: an eyeball with a shaded rim, a fibred iris with a
// dark limbal ring, a pupil, two catchlights that stay with the light while the
// eye turns, and an upper lid in the skin colour that casts a soft shadow.
vec4 eye() {
    vec2 p = vec2(vUv.x * 2.0 - 1.0, 1.0 - vUv.y * 2.0);
    float r = length(p);
    if (r > 1.0) discard;
    vec3 ball = vec3(p, sqrt(max(0.0, 1.0 - r * r)));
    vec3 col = mix(vec3(1.0, 0.99, 0.96), vec3(0.74, 0.8, 0.88), smoothstep(0.5, 1.0, r));
    vec2 q = p - uLook * 0.27;
    q.x /= mix(1.0, 0.8, abs(uLook.x));                        // the iris narrows as the eye turns sideways
    q.y /= mix(1.0, 0.86, abs(uLook.y));
    float ir = length(q) / 0.72;                               // a big iris: little white, a friendly look
    if (ir < 1.0) {
        float fibres = 0.5 + 0.5 * sin(atan(q.y, q.x) * 28.0 + ir * 5.0);
        vec3 iris = uIris * (0.55 + 0.6 * ir) * (0.88 + 0.2 * fibres);
        iris = mix(iris, uIris * 0.22, smoothstep(0.8, 1.0, ir));
        col = mix(col, iris, smoothstep(1.0, 0.93, ir));
        col = mix(vec3(0.02, 0.03, 0.06), col, smoothstep(0.92, 1.04, ir / (0.56 * uPupil)));
    }
    col *= 0.7 + 0.36 * max(dot(ball, uSun), 0.0);
    float key = smoothstep(0.2, 0.12, length(p - vec2(-0.3, 0.38)));
    float fill = smoothstep(0.09, 0.05, length(p - vec2(0.24, -0.3)));
    col = mix(col, vec3(1.0), key * 0.95 + fill * 0.55);
    float edge = 1.06 - uLid * 2.12 + p.x * p.x * 0.22;        // the lower edge of the lid, slightly arched
    if (p.y > edge) col = uSkin * (0.8 + 0.2 * ball.z);
    else col *= 1.0 - 0.32 * smoothstep(edge - 0.4, edge, p.y);
    col = mix(col, uSkin * 0.42, smoothstep(0.9, 1.0, r));     // a soft dark rim where the eye meets the skin
    return vec4(mix(col, uDeep, uDepth), 1.0);
}

void main() {
    if (uEye > 0.5) { o = eye(); return; }
    vec4 a = texture(uTex, vUv) * uColor;
    if (a.a < 0.4) discard;
    vec3 n = normalize(vNormal);
    if (gl_FrontFacing == (uMirror < 0.0)) n = -n;        // a mirrored model shows its faces the other way round
    float up = n.y * 0.5 + 0.5;
    float wrap = dot(n, uSun) * 0.5 + 0.5;                          // half-Lambert: soft, no black side
    vec3 light = mix(uBounce, uSky, up) + uKey * wrap * wrap;
    vec3 d0 = uP0 - vWorld, d1 = uP1 - vWorld;
    light += uC0 * max(dot(n, normalize(d0)), 0.0) / (1.0 + dot(d0, d0) * 1.5);
    light += uC1 * max(dot(n, normalize(d1)), 0.0) / (1.0 + dot(d1, d1) * 1.5);
    float rim = pow(1.0 - max(n.z, 0.0), 3.0) * uRim * up;
    vec3 c = a.rgb * mix(vec3(1.0), light, uLit) + rim * vec3(0.6, 0.9, 1.0) * uLit;
    o = vec4(mix(c, uDeep, uDepth), 1.0);
}`;

export default class MeshRenderer {
    /** @param {WebGL2RenderingContext} gl */
    constructor(gl) {
        this.gl = gl;
        const compile = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src); gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
            return s;
        };
        const prog = this.program = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
        ['aPos', 'aNormal', 'aUv'].forEach((name, i) => gl.bindAttribLocation(prog, i, name));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        this.u = {};
        for (let i = 0; i < gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i++) {
            const name = gl.getActiveUniform(prog, i).name;
            this.u[name] = gl.getUniformLocation(prog, name);
        }
        // A white pixel stands in until (or instead of) a picture.
        this.white = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.white);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    }

    /** Put a mesh on the GPU. `image` = anything texImage2D takes (ImageBitmap, <img>, canvas), or null. */
    upload({ positions, normals, uvs, indices, color = [1, 1, 1, 1] }, image = null) {
        const gl = this.gl, vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const attribute = (slot, data, size) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(slot);
            gl.vertexAttribPointer(slot, size, gl.FLOAT, false, 0, 0);
        };
        attribute(0, positions, 3);
        attribute(1, normals, 3);
        attribute(2, uvs || new Float32Array(positions.length / 3 * 2), 2);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        gl.bindVertexArray(null);
        let texture = this.white;
        if (image) {
            texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        return { vao, count: indices.length, texture, color, part: IDENTITY, lift: 0 };
    }

    /**
     * Draw meshes into the current viewport.
     * @param o.yaw,o.pitch  model rotation (radians)   @param o.scale  size on screen (1 = fills the view's height)
     * @param o.aspect       viewport width / height
     * @param o.mirror       1 = as built, -1 = mirrored left-right; values in between squash it flat (the turn-around)
     * @param o.swim 0..1, o.phase, o.puff 0..1         motion
     * @param o.lit 0..1     0 = show the picture as painted, 1 = fully lit by the scene
     * @param o.depth 0..1   fade toward the deep-water colour
     */
    draw(meshes, { yaw = 0, pitch = 0, scale = 1, aspect = 1, swim = 0, phase = 0, puff = 0, lit = 1, depth = 0, mirror = 1, light = LIGHT }) {
        const gl = this.gl, u = this.u;
        gl.useProgram(this.program);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
        // Mild perspective: a long lens, so the side view stays a side view.
        const dist = 6, f = dist * 1.9, near = 1, far = 20;
        gl.uniformMatrix4fv(u.uProj, false, [
            f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
        const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), s = scale;
        // model = translate(0, 0, -dist) * rotateX(pitch) * rotateY(yaw) * scale * mirror(x)
        const m = mirror;
        gl.uniform1f(u.uMirror, m);
        gl.uniformMatrix4fv(u.uModel, false, [
            cy * s * m, sx * sy * s * m, -cx * sy * s * m, 0,
            0, cx * s, sx * s, 0,
            sy * s, -sx * cy * s, cx * cy * s, 0,
            0, 0, -dist, 1]);
        gl.uniform1f(u.uSwim, swim); gl.uniform1f(u.uPhase, phase); gl.uniform1f(u.uPuff, puff);
        gl.uniform1f(u.uLit, lit); gl.uniform1f(u.uDepth, depth); gl.uniform1f(u.uRim, light.rim);
        const len = Math.hypot(...light.sun);
        gl.uniform3f(u.uSun, light.sun[0] / len, light.sun[1] / len, light.sun[2] / len);
        gl.uniform3fv(u.uKey, light.key.map(v => v * light.keyStrength));
        gl.uniform3fv(u.uSky, light.sky); gl.uniform3fv(u.uBounce, light.bounce); gl.uniform3fv(u.uDeep, light.deep);
        light.points.slice(0, 2).forEach((p, i) => {
            gl.uniform3f(u[`uP${i}`], p.pos[0], p.pos[1], p.pos[2] - dist);
            gl.uniform3fv(u[`uC${i}`], p.color.map(v => v * light.pointStrength));
        });
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(u.uTex, 0);
        for (const m of meshes) {
            gl.bindTexture(gl.TEXTURE_2D, m.texture);
            gl.uniform4fv(u.uColor, m.color);
            gl.uniformMatrix4fv(u.uPart, false, m.part);
            gl.uniform1f(u.uLift, m.lift);
            gl.uniform1f(u.uEye, m.eye ? 1 : 0);
            if (m.eye) {
                gl.uniform2f(u.uLook, m.eye.x, m.eye.y);
                gl.uniform1f(u.uLid, m.eye.lid); gl.uniform1f(u.uPupil, m.eye.pupil);
                gl.uniform3fv(u.uIris, m.eye.iris); gl.uniform3fv(u.uSkin, m.eye.skin);
            }
            gl.bindVertexArray(m.vao);
            gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
        }
        gl.bindVertexArray(null);
    }
}
