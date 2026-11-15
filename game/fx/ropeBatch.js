import Phaser from 'phaser';
import { CAUSTICS, CAUSTICS_ROPE } from './CausticsPipeline.js';

// Ropes (swaying plants, the cards of the animals' rigs, chains) drawn in the shared batch.
// Phaser draws every rope as its own triangle strip and empties the batch before each one: one
// draw call per rope (41 of 91 per frame on the lowest tier at the reef). Here a rope's strip is
// written as a list of triangles into the picture pipeline instead, so ropes join the batch of
// whatever is drawn around them: the same pixels, a fraction of the draw calls.

/** Strip pipeline -> the triangle-list pipeline that draws the same. */
const AS_TRIANGLES = { RopePipeline: 'MultiPipeline', [CAUSTICS_ROPE]: CAUSTICS };

const GetCalcMatrix = Phaser.GameObjects.GetCalcMatrix;

function renderRope(renderer, src, camera, parentMatrix) {
    const target = AS_TRIANGLES[src.pipeline?.name];
    if (!target || !renderer.pipelines.has(target)) return original.call(this, renderer, src, camera, parentMatrix);
    camera.addToRenderList(src);
    const pipeline = renderer.pipelines.set(renderer.pipelines.get(target), src);
    const calc = GetCalcMatrix(src, camera, parentMatrix).calc;
    if (src.dirty) src.updateVertices();
    const v = src.vertices, uv = src.uv, colors = src.colors, alphas = src.alphas, n = v.length >> 1;
    if (n < 3) return;
    const tris = 3 * (n - 2), alpha = src.alpha * camera.alpha, getTint = Phaser.Renderer.WebGL.Utils.getTintAppendFloatAlpha;
    if (pipeline.shouldFlush(tris)) pipeline.flush();
    renderer.pipelines.preBatch(src);
    const unit = pipeline.setGameObject(src), F = pipeline.vertexViewF32, U = pipeline.vertexViewU32, tintFill = src.tintFill, round = camera.roundPixels;
    let o = pipeline.vertexCount * pipeline.currentShader.vertexComponentCount - 1;
    const put = i => {
        const x = v[i * 2], y = v[i * 2 + 1];
        let tx = x * calc.a + y * calc.c + calc.e, ty = x * calc.b + y * calc.d + calc.f;
        if (round) { tx = Math.round(tx); ty = Math.round(ty); }
        F[++o] = tx; F[++o] = ty; F[++o] = uv[i * 2]; F[++o] = uv[i * 2 + 1]; F[++o] = unit; F[++o] = tintFill;
        U[++o] = getTint(colors[i], alphas[i] * alpha);
    };
    for (let k = 0; k + 2 < n; k++) { put(k); put(k + 1); put(k + 2); }
    pipeline.vertexCount += tris;
    pipeline.currentBatch.count = pipeline.vertexCount - pipeline.currentBatch.start;
    renderer.pipelines.postBatch(src);
}

let original = null;

/** Once per game: every rope from now on is drawn this way (WebGL only). */
export function installRopeBatching() {
    const proto = Phaser.GameObjects.Rope.prototype;
    if (original || !proto.renderWebGL) return;
    original = proto.renderWebGL;
    proto.renderWebGL = renderRope;
}
