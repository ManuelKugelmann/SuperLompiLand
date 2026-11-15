import Phaser from 'phaser';
import { FLOW, streamDir } from './flow.js';

// The big sea currents made visible (flow.js streams; playtest: "clearer current viz"): each
// stream is a few long soft bands of streaks laid along its lane, side by side, that run with the
// water at their own pace, so the lane reads from afar, its slant and its direction at a glance.
// A band is one strip (Rope) whose picture scrolls along it; its ends fade out. Nothing per frame
// but the scroll: the bands are made when a stream comes near and dropped when it is left.

export const STREAM_LOOK = {
    key: 'stream_streaks',
    bands: [                   // across the lane (shares of FLOW.streamWidth from its middle), how bright, how fast (share of the stream's speed), how wide (px)
        { off: -0.6, alpha: 0.2, pace: 0.85, width: 70 },
        { off: 0, alpha: 0.32, pace: 1, width: 96 },
        { off: 0.65, alpha: 0.18, pace: 0.75, width: 60 }
    ],
    points: 28,                // points along a band
    fade: 0.16,                // share of a band's length over which each end fades out
    repeat: 640,               // px of lane one copy of the picture covers
    depth: 3.5,                // in the water with the creatures, behind the swimmer (depths.js)
    near: 1400                 // px beyond the view within which a stream's bands are made
};

/** The streak picture: soft dashes of different lengths along x, faded toward its top and bottom edges. Seamless along x. */
function ensureTexture(scene) {
    const L = STREAM_LOOK;
    if (scene.textures.exists(L.key)) return;
    const W = 256, H = 64, tex = scene.textures.createCanvas(L.key, W, H), c = tex.getContext();
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let k = 0; k < 14; k++) {
        const y = 10 + rnd() * (H - 20), len = 40 + rnd() * 110, x = rnd() * W, th = 1.5 + rnd() * 2.5, a = 0.35 + rnd() * 0.5;
        for (const dx of [0, -W]) {      // drawn twice: the dash that runs off the right edge comes back on the left
            const g = c.createLinearGradient(x + dx, 0, x + dx + len, 0);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, `rgba(235,250,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g;
            c.fillRect(x + dx, y - th / 2, len, th);
        }
    }
    tex.refresh();
}

export default class StreamLayer {
    /** `flow` = the scene's water (flow.js createFlow). */
    constructor(scene, flow) {
        this.scene = scene;
        this.flow = flow;
        this.live = new Map();      // stream index -> its bands
        ensureTexture(scene);
    }

    /** A stream's bands: strips along its lane, offset to the sides, their ends faded. */
    build(s) {
        const L = STREAM_LOOK, d = streamDir(s), nx = -d.y, ny = d.x, len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0), n = L.points;
        return L.bands.map(b => {
            const ox = nx * b.off * FLOW.streamWidth, oy = ny * b.off * FLOW.streamWidth;
            const points = Array.from({ length: n }, (_, i) => new Phaser.Math.Vector2(d.x * len * i / (n - 1), d.y * len * i / (n - 1)));
            const rope = this.scene.add.rope(s.x0 + ox, s.y0 + oy, L.key, null, points, true).setDepth(L.depth);
            rope.setScale(1, b.width / 64);      // the picture is 64 px across; the band takes its width
            rope.noCaustics = true;
            // Faded at its ends, and where the calm route takes the stream's pull away (flow.js): it shows only where it carries.
            const alphas = points.map((p, i) => { const u = i / (n - 1), e = Math.min(1, Math.min(u, 1 - u) / L.fade); return b.alpha * e * e * (3 - 2 * e) * this.flow.pullAt(s.x0 + ox + p.x, s.y0 + oy + p.y); });
            rope.setAlphas(alphas);
            return { rope, band: b, len };
        });
    }

    /** Per frame: bands for the streams near the view, their streaks running with the water. `t` = s. */
    update(t) {
        const L = STREAM_LOOK, v = this.scene.cameras.main.worldView, near = this.flow.streamsIn(v.x - L.near, v.right + L.near), keep = new Set();
        for (const s of near) {
            keep.add(s.index);
            if (!this.live.has(s.index)) this.live.set(s.index, this.build(s));
            for (const { rope, band, len } of this.live.get(s.index)) {
                // The picture slides along the band at the water's speed (px per step at 60 steps a second), each band at its own pace.
                const shift = (t * FLOW.streamSpeed * 60 * band.pace) / L.repeat, uv = rope.uv, n = rope.points.length, span = len / L.repeat;
                for (let i = 0; i < n; i++) { const u = span * i / (n - 1) - shift; uv[i * 4] = u; uv[i * 4 + 2] = u; }
            }
        }
        for (const [i, bands] of this.live) if (!keep.has(i)) { for (const b of bands) b.rope.destroy(); this.live.delete(i); }
    }

    destroy() {
        for (const bands of this.live.values()) for (const b of bands) b.rope.destroy();
        this.live.clear();
    }
}
