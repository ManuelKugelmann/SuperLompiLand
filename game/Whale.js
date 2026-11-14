import Rig from './Rig.js';
import { WHALE, createWhale, stepWhale, bodySpot, whaleCarry } from './ai/whale.js';
import { NET_KEY, ensureNet } from './StoryBeats.js';

export const WHALE_SCENE = {
    id: 'whale',         // the journey's name for this event
    near: 3400,          // px: she appears when the player is this close to her place ...
    far: 5600,           // ... and is taken away again beyond this while still caught
    netSize: 300,        // px across of each net piece
    calf: 0.3            // her calf, in sizes of her
};

const KEY = 'whale';

/** The whale as a picture (fallback art, painted once): a humpback seen from the side, nose right. */
function ensureWhale(scene) {
    if (scene.textures.exists(KEY)) return;
    const W = 1024, H = 420, tex = scene.textures.createCanvas(KEY, W, H), c = tex.getContext();
    c.filter = 'blur(1.2px)';
    const skin = c.createLinearGradient(0, 80, 0, 340);
    skin.addColorStop(0, '#2c4763'); skin.addColorStop(0.55, '#44688c'); skin.addColorStop(0.8, '#9fb6c8'); skin.addColorStop(1, '#e6eef2');
    c.fillStyle = skin;
    c.beginPath();                                   // fluke
    c.moveTo(160, 200); c.quadraticCurveTo(70, 150, 14, 96); c.quadraticCurveTo(60, 190, 70, 204);
    c.quadraticCurveTo(60, 230, 18, 318); c.quadraticCurveTo(80, 262, 160, 214); c.fill();
    c.beginPath();                                   // body
    c.moveTo(140, 190); c.bezierCurveTo(330, 150, 470, 84, 700, 92); c.bezierCurveTo(880, 98, 990, 150, 1008, 206);
    c.bezierCurveTo(990, 262, 900, 318, 700, 332); c.bezierCurveTo(480, 344, 300, 262, 140, 218); c.closePath(); c.fill();
    c.fillStyle = '#2c4763'; c.beginPath(); c.moveTo(350, 138); c.quadraticCurveTo(388, 92, 420, 116); c.lineTo(350, 138); c.fill();   // dorsal hump
    c.strokeStyle = 'rgba(70,100,128,0.55)'; c.lineWidth = 3;                                                                       // throat grooves
    for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(640, 268 + i * 9); c.quadraticCurveTo(820, 262 + i * 9, 968 - i * 14, 236 + i * 7); c.stroke(); }
    const fin = c.createLinearGradient(520, 290, 640, 410);
    fin.addColorStop(0, '#dfe9ef'); fin.addColorStop(1, '#6f8ea8');
    c.fillStyle = fin; c.beginPath(); c.moveTo(690, 292); c.quadraticCurveTo(610, 330, 470, 412); c.quadraticCurveTo(600, 400, 740, 318); c.fill();   // long pectoral fin
    c.filter = 'none';
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(878, 208, 15, 0, 7); c.fill();
    c.fillStyle = '#16263a'; c.beginPath(); c.arc(882, 209, 9, 0, 7); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(885, 205, 3, 0, 7); c.fill();
    c.strokeStyle = '#22384f'; c.lineWidth = 4; c.beginPath(); c.moveTo(900, 250); c.quadraticCurveTo(960, 250, 1000, 214); c.stroke();   // a calm smile
    c.fillStyle = 'rgba(240,244,246,0.8)';
    for (const [x, y, r] of [[955, 180, 6], [935, 168, 4], [970, 196, 5], [610, 300, 5], [300, 190, 5]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }   // barnacles
    tex.refresh();
}

const profile = width => ({ states: { normal: { key: KEY, width, wiggle: 40 } }, anim: 'swim', soft: 0.25 });
const SPOT = { x: 0, y: 0 }, PULL = { x: 0, y: 0 };

/**
 * The great whale in the world (ai/whale.js is her mind): her body and her calf are Rigs, the
 * net pieces hang on her until Lompi tears them off. `on(event, x, y)` reports 'cut', 'freed',
 * 'ride' and 'gone'.
 */
export default class Whale {
    constructor(scene, journey, startX, endX, routeY, on) {
        this.scene = scene; this.journey = journey; this.startX = startX; this.endX = endX; this.routeY = routeY; this.on = on;
        this.mind = null;
        ensureWhale(scene);
        ensureNet(scene);
    }

    build() {
        const s = this.scene;
        this.mind = createWhale(this.startX, this.endX);
        this.mind.y = this.routeY(this.startX);
        this.body = new Rig(s, profile(WHALE.length), this.startX, this.mind.y, 3.4);
        this.calf = new Rig(s, profile(WHALE.length * WHALE_SCENE.calf), this.startX, this.mind.y, 3.3);
        this.calfAt = { x: this.startX, y: this.mind.y };
        this.nets = WHALE.nets.map(() => s.add.image(0, 0, NET_KEY).setDepth(3.6).setDisplaySize(WHALE_SCENE.netSize, WHALE_SCENE.netSize));
    }

    remove() {
        this.body.destroy(); this.calf.destroy();
        for (const n of this.nets) n?.destroy();
        this.mind = null;
    }

    /** During her ride: the velocity the fish takes on at her back (px per step), or null. */
    carry(fish, vx, vy) {
        return this.mind ? whaleCarry(this.mind, fish, vx, vy, PULL) : null;
    }

    /** Per frame. `fish` = { x, y }, `t` s, `delta` ms. */
    update(fish, t, delta) {
        if (!this.mind) {
            if (!this.journey.has(WHALE_SCENE.id) && Math.abs(fish.x - this.startX) < WHALE_SCENE.near) this.build();
            else return;
        }
        const w = this.mind, s = this.scene, frames = delta / (1000 / 60);
        if (w.state === 'caught' && Math.abs(fish.x - w.x) > WHALE_SCENE.far) { this.remove(); return; }
        const event = stepWhale(w, delta / 1000, fish, this.routeY, t);
        if (event === 'cut' || event === 'freed') {
            const i = this.nets.findIndex((n, k) => n && w.cut[k]), net = this.nets[i];
            this.nets[i] = null;
            s.tweens.add({ targets: net, y: net.y + 320, angle: 80, alpha: 0, duration: 1000, ease: 'Sine.easeIn', onComplete: () => net.destroy() });
        }
        if (event) this.on(event, w.x, w.y);
        if (event === 'gone') { this.remove(); return; }

        const alpha = 1 - w.dive, riding = w.state === 'ride' || w.state === 'dive';
        this.body.setAlpha(alpha).draw({ x: w.x, y: w.y, vx: w.v / 60, vy: w.dive * 3, frames, effort: riding ? 0.7 : 0.12, facing: 1, turn: 0.02 });
        // The calf circles below her, worried while she is caught, close at her side on the ride.
        const r = riding ? 0.35 : 1, cx = w.x - 260 + Math.sin(t * 0.45) * 300 * r, cy = w.y + 400 + Math.cos(t * 0.6) * 90 * r;
        const cvx = (cx - this.calfAt.x) / Math.max(0.5, frames), cvy = (cy - this.calfAt.y) / Math.max(0.5, frames);
        this.calfAt.x = cx; this.calfAt.y = cy;
        this.calf.setAlpha(alpha).draw({ x: cx, y: cy, vx: cvx, vy: cvy, frames, effort: 0.4, turn: 0.05 });
        this.nets.forEach((n, i) => {
            if (!n) return;
            const p = bodySpot(w, WHALE.nets[i], WHALE.netDrop[i], SPOT);
            n.setPosition(p.x, p.y).setRotation(Math.sin(t * 1.2 + i) * 0.1);
        });
    }
}
