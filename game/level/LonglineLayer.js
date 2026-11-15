import Phaser from 'phaser';
import { LONGLINE, longlineSpan, lineY, floats, branches, hookAt, hookTouched, stingCosts } from './longline.js';

/** How the longline looks: floats bobbing on the surface, one line for main line and branches, a baited hook on each. */
export const LONGLINE_LOOK = {
    depth: 3.0,          // set pieces in the play plane (depths.js): in front of the ground, behind the swimmers
    lineTint: 0x34464e,  // monofilament: a thin dark line reads against bright water (a pale one vanished in the shallows)
    lineAlpha: 0.85,
    lineStep: 90,        // px between two points of the main line
    float: [64, 46],     // px of a float picture
    hook: [40, 70]       // px of a hook picture (its eye at the top): big enough to read as a danger on a phone
};

const KEYS = { line: 'longline_line', hook: 'longline_hook', float: 'longline_float' };

/** Procedural pictures (the painted ones, when there, are loaded under the same keys). */
function ensureTextures(scene) {
    const t = scene.textures;
    if (!t.exists(KEYS.line)) {
        const c = t.createCanvas(KEYS.line, 6, 16), x = c.getContext();
        x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(0, 0, 1, 16); x.fillRect(5, 0, 1, 16);
        x.fillStyle = '#ffffff'; x.fillRect(1, 0, 4, 16); c.refresh();
    }
    if (!t.exists(KEYS.hook)) {
        const [w, h] = [52, 92], c = t.createCanvas(KEYS.hook, w, h), x = c.getContext();
        // A steel J hook hanging from its eye, a pale bait on the bend.
        x.lineCap = 'round'; x.strokeStyle = '#8b959c'; x.lineWidth = 6;
        x.beginPath(); x.arc(26, 8, 5, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.moveTo(26, 13); x.lineTo(26, 62); x.arc(16, 62, 10, 0, Math.PI, false); x.lineTo(6, 50); x.stroke();
        x.strokeStyle = '#c9d2d6'; x.lineWidth = 2; x.beginPath(); x.moveTo(24, 16); x.lineTo(24, 60); x.stroke();
        x.fillStyle = '#d9a48a'; x.beginPath(); x.ellipse(15, 70, 13, 9, -0.3, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(120,60,50,0.5)'; x.beginPath(); x.ellipse(13, 73, 7, 4, -0.3, 0, Math.PI * 2); x.fill();
        c.refresh();
    }
    if (!t.exists(KEYS.float)) {
        const [w, h] = [96, 72], c = t.createCanvas(KEYS.float, w, h), x = c.getContext();
        const g = x.createLinearGradient(0, 14, 0, 70);
        g.addColorStop(0, '#ff9a3c'); g.addColorStop(1, '#c4521c');
        x.fillStyle = g; x.beginPath(); x.ellipse(48, 44, 40, 26, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(8, 40, 80, 7);
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.ellipse(34, 30, 14, 6, -0.3, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#5b4a3a'; x.lineWidth = 4; x.beginPath(); x.moveTo(48, 18); x.lineTo(48, 2); x.stroke();
        c.refresh();
    }
}

/**
 * The longline event (longline.js is the rule). Built when the fish comes near, dropped when it is far: one
 * rope for the whole line (floats down to the main line, along it with each branch down to its hook and back),
 * a float picture per float, a hook picture per branch. The hooked turtle is a rescue (RescueLayer).
 * `on`: { cue(x, y) when it is about to come into view, sting(x, y, costs) when a hook is touched }.
 */
export default class LonglineLayer {
    constructor(scene, surfaceAt, on) {
        this.scene = scene; this.surfaceAt = surfaceAt; this.on = on;
        this.span = longlineSpan();
        this.list = this.span ? branches(this.span) : [];
        this.hits = 0; this.cued = false; this.built = null; this.stungAt = -Infinity;
        this.p = {};
    }

    build() {
        const s = this.scene, L = LONGLINE_LOOK;
        ensureTextures(s);
        const pts = this.path(0).map(([x, y]) => new Phaser.Math.Vector2(x, y));
        const rope = s.add.rope(0, 0, KEYS.line, null, pts, false).setDepth(L.depth).setColors(L.lineTint).setAlpha(L.lineAlpha);
        const fl = floats(this.span).map(x => s.add.image(x, 0, KEYS.float).setDisplaySize(...L.float).setOrigin(0.5, 0.62).setDepth(L.depth + 0.01));
        const hooks = this.list.filter(b => !b.caught).map(b => ({ b, img: s.add.image(b.x, b.top + b.len, KEYS.hook).setDisplaySize(...L.hook).setOrigin(0.5, 0.06).setDepth(L.depth + 0.02) }));
        return { rope, floats: fl, hooks };
    }

    /** The line's points at time t: float, down, along (each branch down to its hook and back up), up to the next float. */
    path(t) {
        const S = this.span, L = LONGLINE_LOOK, out = [], fx = floats(S), p = this.p;
        let bi = 0;
        for (let k = 0; k < fx.length; k++) {
            const x = fx[k];
            out.push([x, this.surfaceAt(x)], [x, lineY(x, S)]);
            if (k === fx.length - 1) break;
            const next = fx[k + 1];
            for (let u = x + L.lineStep; u < next + 0.5; u = Math.min(next, u + L.lineStep)) {
                while (bi < this.list.length && this.list[bi].x <= u) {
                    const b = this.list[bi++];
                    hookAt(b, t, LONGLINE, p);
                    out.push([b.x, b.top], [p.x, p.y], [b.x + 2, b.top]);      // back up 2 px aside: a path that turns back on itself exactly gives the rope no width there (NaN)
                }
                out.push([u, lineY(u, S)]);
                if (u >= next) break;
            }
            out.push([next, this.surfaceAt(next)]);
        }
        return out;
    }

    drop() {
        if (!this.built) return;
        this.built.rope.destroy();
        for (const f of this.built.floats) f.destroy();
        for (const h of this.built.hooks) h.img.destroy();
        this.built = null;
    }

    /** Per frame: `fish` = { x, y }, `r` its radius, `t` s, `relaxed` = no stings. */
    update(fish, r, t, relaxed) {
        if (!this.span) return;
        const S = this.span, C = LONGLINE, d = Math.max(S.x0 - fish.x, fish.x - S.x1, 0);
        if (!this.cued && fish.x > S.x0 - C.cue && fish.x < S.x1) { this.cued = true; this.on.cue(S.x0, lineY(S.x0, S)); }
        if (d > C.far) { this.drop(); this.hits = 0; this.cued = false; return; }
        if (!this.built) { if (d > C.near || !this.scene.buildSlot()) return; this.built = this.build(); }
        const B = this.built, pts = this.path(t), rp = B.rope.points;
        for (let i = 0; i < rp.length; i++) rp[i].set(pts[i][0], pts[i][1]);
        B.rope.setDirty();
        B.floats.forEach((f, k) => { const x = f.x; f.y = this.surfaceAt(x); f.rotation = Math.sin(t * 1.3 + k) * 0.08; });
        for (const h of B.hooks) { hookAt(h.b, t, C, this.p); h.img.setPosition(this.p.x, this.p.y).setRotation(Math.atan2(h.b.x - this.p.x, this.p.y - h.b.top)); }
        const b = t - this.stungAt > C.stingWait && hookTouched(this.list, fish.x, fish.y, r, t);
        if (b) {
            this.stungAt = t; hookAt(b, t, C, this.p); const costs = stingCosts(this.hits, relaxed); this.on.sting(this.p.x, this.p.y, costs); if (costs) this.hits++;
        }
    }

    destroy() { this.drop(); }
}
