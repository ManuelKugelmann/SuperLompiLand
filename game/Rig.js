import Phaser from 'phaser';
import { CHARACTERS } from './characters.js';

/** Tunables of the body animation shared by every playable (local, remote, title screen). */
export const RIG = {
    alignFrom: 3,          // below this speed the body stays level
    alignFull: 8,          // from this speed it fully points along its movement
    finFlapMin: 7,         // side fin swing in degrees when idle ...
    finFlapMore: 14,       // ... plus this much at full effort (kept small: the retouch under the fin is rough)
    segments: 12           // strips the picture is cut into
};

/** Lompi's looks double as the fallback for any character whose art is missing. */
const DEFAULT_STATES = CHARACTERS[0].states;

/**
 * What you see of a playable character: one bendable strip mesh per state (plus
 * the side fin where the art has one), animated from nothing but a position, a
 * velocity and how hard the character is swimming. It has no physics and takes
 * no input — Player drives it from its body, RemoteFish from network snapshots,
 * the title screen from the carousel.
 */
export default class Rig {
    constructor(scene, character, x, y, depth = 5) {
        ensureFallbackTextures(scene);
        this.char = character;
        this.facing = 1;        // 1 = right, -1 = left
        this.phase = 0;         // swim cycle
        this.zoom = 1;          // extra scale on top of the character's size
        this.shown = true;
        this.views = {};
        const tall = character.anim === 'pulse' || character.anim === 'sway';
        for (const [name, st] of Object.entries(character.states)) {
            const key = scene.textures.exists(st.key) ? st.key : DEFAULT_STATES.normal.key;
            // With the layered art (body without side fin + the fin on its own)
            // the fin flaps separately; otherwise the single image is used as is.
            const pivot = scene.cache.json.get('fins')?.[key];
            const layered = !!pivot && scene.textures.exists(`${key}_body`) && scene.textures.exists(`${key}_fin`);
            // The strips run across the body's length: vertical strips for fish
            // (tail waves), horizontal ones for tall creatures (tentacles trail).
            const rope = scene.add.rope(x, y, layered ? `${key}_body` : key, null, RIG.segments, !tall)
                .setDepth(depth).setVisible(false);
            rope.baseScale = st.width / rope.frame.width;
            rope.wiggle = st.wiggle;
            if (layered) {
                const fin = scene.add.image(x, y, `${key}_fin`).setDepth(depth + 0.1).setVisible(false);
                fin.setOrigin((pivot.pivotX - pivot.finX) / fin.width, (pivot.pivotY - pivot.finY) / fin.height);
                // fin joint relative to the body centre, in texture pixels
                fin.jointX = pivot.pivotX - rope.frame.width / 2;
                fin.jointY = pivot.pivotY - rope.frame.height / 2;
                fin.tail = 1 - pivot.pivotX / rope.frame.width; // 1 = at the tail end
                rope.fin = fin;
            }
            this.views[name] = rope;
        }
        this.view = this.views.normal;
        this.setState('normal');
    }

    /** Switch the look (e.g. 'inflated'); unknown states fall back to 'normal'. */
    setState(name) {
        const old = this.view;
        this.state = this.views[name] ? name : 'normal';
        this.view = this.views[this.state];
        this.view.setPosition(old.x, old.y).setRotation(old.rotation).setAlpha(old.alpha).setVisible(this.shown);
        if (old !== this.view) { old.setVisible(false); old.fin?.setVisible(false); }
        this.view.fin?.setVisible(this.shown);
    }

    setVisible(on) {
        this.shown = on;
        this.view.setVisible(on);
        this.view.fin?.setVisible(on);
        return this;
    }

    setAlpha(a) { this.view.setAlpha(a); return this; }

    setDepth(d) {
        for (const v of Object.values(this.views)) { v.setDepth(d); v.fin?.setDepth(d + 0.1); }
        return this;
    }

    /**
     * Draw one frame.
     * @param p.x,p.y    where
     * @param p.vx,p.vy  velocity the body should follow (relative to the water; 0 = hold the pose)
     * @param p.frames   elapsed time in 60 Hz steps
     * @param p.effort   0..1 how hard it is swimming right now
     * @param p.squash   >0 stretched along the travel direction, <0 squashed
     * @param p.turn     radians per step the nose may turn
     * @param p.facing   force the facing (1 / -1) instead of deriving it from vx
     */
    draw({ x, y, vx = 0, vy = 0, frames = 1, effort = 0, squash = 0, turn = 0.2, facing }) {
        const view = this.view;
        view.setPosition(x, y);

        // Orientation depends on speed: slow = level, just hovering; faster = the
        // nose follows the movement. The art faces right; heading left it is
        // mirrored vertically so it never swims belly-up.
        const speed = Math.hypot(vx, vy);
        const want = facing ?? (Math.abs(vx) > 0.8 ? (vx < 0 ? -1 : 1) : this.facing);
        if (want !== this.facing) {
            // Turning round mirrors the body; mirror its angle too so it flips
            // in place instead of rolling over its back.
            this.facing = want;
            view.rotation = Phaser.Math.Angle.Wrap(Math.PI - view.rotation);
        }
        const flip = this.facing < 0 ? -1 : 1;
        const level = flip < 0 ? Math.PI : 0;
        const follow = this.char.upright ? 0 : Phaser.Math.Clamp((speed - RIG.alignFrom) / (RIG.alignFull - RIG.alignFrom), 0, 1);
        const target = Phaser.Math.Angle.Wrap(level + Phaser.Math.Angle.Wrap(Math.atan2(vy, vx) - level) * follow);
        const sq = Phaser.Math.Clamp(squash, -0.35, 0.35);
        const sc = view.baseScale * this.zoom;
        view.setScale(sc * (1 + sq), sc * (1 - sq) * flip);
        view.rotation = Phaser.Math.Angle.RotateTo(view.rotation, target, turn * frames);

        // Body motion, driven by how hard the character swims and how fast it
        // moves (being carried is not swimming). Idle = a slow, small flutter.
        const drive = Phaser.Math.Clamp(Math.max(effort, speed / 14), 0.12, 1);
        this.phase += (0.1 + drive * 0.42) * frames;
        const amp = view.wiggle * (0.25 + drive * 0.75);
        const pts = view.points, n = pts.length - 1, w = view.frame.width;
        const style = this.char.anim || 'swim';
        if (style === 'pulse') {
            // Jellyfish: the bell pumps (harder when swimming), the tentacles trail
            // behind the movement and ripple.
            const beat = Math.sin(this.phase * 0.9), pump = 0.05 + drive * 0.09;
            view.setScale(view.scaleX * (1 + beat * pump), view.scaleY * (1 - beat * pump * 1.3));
            const trail = Phaser.Math.Clamp(-vx * 0.012, -0.35, 0.35) * flip;
            for (let i = 0; i <= n; i++) {
                const f = i / n;                              // 0 = top of the bell, 1 = tentacle tips
                pts[i].x = (Math.sin(this.phase * 0.9 - f * 3.4) * 0.06 + trail * f) * w * f * f * 2.2;
            }
        } else if (style === 'sway') {
            // Seahorse: upright, the body curls gently from the head down; the tail swings behind.
            const trail = Phaser.Math.Clamp(-vx * 0.01, -0.3, 0.3) * flip;
            for (let i = 0; i <= n; i++) {
                const f = i / n;
                pts[i].x = (Math.sin(this.phase * 0.7 - f * 2.2) * 0.05 * (0.5 + drive) + trail * f) * w * f;
            }
        } else if (style === 'paddle') {
            // Turtle: a stiff shell that rocks with each flipper stroke and stretches forward a little.
            const stroke = Math.sin(this.phase * 0.55);
            view.rotation += stroke * 0.07 * (0.3 + drive) * flip;
            view.setScale(view.scaleX * (1 + stroke * 0.03 * drive), view.scaleY * (1 - stroke * 0.045 * (0.4 + drive)));
            for (let i = 0; i <= n; i++) {                    // only the rear flippers / tail end flex
                const tail = 1 - i / n;
                pts[i].y = Math.sin(this.phase * 0.55 - tail * 1.5) * amp * 0.5 * tail * tail * tail;
            }
        } else {
            for (let i = 0; i <= n; i++) {
                const tail = 1 - i / n;                       // 1 at the tail, 0 at the nose
                pts[i].y = Math.sin(this.phase - tail * 2.6) * amp * tail * tail;
            }
        }
        view.setDirty();

        // Side fin: paddles around its joint, faster and wider the harder the
        // character swims. It rides on the body (position, turn, mirroring, wiggle).
        const fin = view.fin;
        if (fin) {
            const wave = Math.sin(this.phase - fin.tail * 2.6) * amp * fin.tail * fin.tail;
            const lx = fin.jointX * sc, ly = (fin.jointY + wave) * sc * flip;
            const cos = Math.cos(view.rotation), sin = Math.sin(view.rotation);
            fin.setPosition(view.x + lx * cos - ly * sin, view.y + lx * sin + ly * cos);
            fin.setScale(sc * (1 + sq), sc * (1 - sq) * flip);
            const flap = Math.sin(this.phase * 1.15) * Phaser.Math.DegToRad(RIG.finFlapMin + drive * RIG.finFlapMore);
            fin.rotation = view.rotation + flap * flip;
            fin.setAlpha(view.alpha);
        }
    }

    destroy() {
        for (const v of Object.values(this.views)) { v.fin?.destroy(); v.destroy(); }
    }
}

/** Procedural stand-ins so the game runs even if the art files are missing. */
function ensureFallbackTextures(scene) {
    for (const [name, s] of Object.entries(DEFAULT_STATES)) {
        if (scene.textures.exists(s.key)) continue;
        const R = 100, pad = name === 'inflated' ? 30 : 6, c = R + pad;
        const g = scene.make.graphics({ add: false });
        if (name === 'inflated') {
            g.fillStyle(0xef8a4b, 1);
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const px = Math.cos(a + 1.57) * 12, py = Math.sin(a + 1.57) * 12;
                g.fillTriangle(c + Math.cos(a) * (R + pad), c + Math.sin(a) * (R + pad),
                    c + Math.cos(a) * R + px, c + Math.sin(a) * R + py,
                    c + Math.cos(a) * R - px, c + Math.sin(a) * R - py);
            }
        }
        for (let i = 0; i < 28; i++) {
            const t = i / 27;
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(217, 150, 31), new Phaser.Display.Color(255, 226, 120), 27, i);
            g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
            g.fillCircle(c - t * 18, c - t * 20, R * (1 - t));
        }
        g.fillStyle(0xffffff, 1).fillCircle(c + 45, c - 22, 24);
        g.fillStyle(0x1b2c5c, 1).fillCircle(c + 52, c - 20, 13);
        g.generateTexture(s.key, c * 2, c * 2);
        g.destroy();
    }
}
