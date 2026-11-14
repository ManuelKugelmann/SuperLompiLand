import Rig from './Rig.js';
import { WHALE, createWhale, stepWhale, bodySpot, whaleCarry } from './ai/whale.js';

export const WHALE_SCENE = {
    id: 'whale',         // the journey's name for this event
    near: 3400,          // px: she appears when the player is this close to her place ...
    far: 5600,           // ... and is taken away again beyond this while still caught
    below: 560,          // px she swims under the calm route (which runs just under the surface out here)
    drape: [230, 640],   // px: width and height of a piece of net as it hangs over her
    calf: 0.3,           // her calf, in sizes of her
    blowEvery: 0.35      // s between the bubbles from her blowhole on the ride
};

const KEY = 'whale', DRAPE_KEY = 'whale_net';
const BLOWHOLE = [0.8, -0.1];      // on her body: share of her length from the fluke, lengths above her middle

/** The whale as a picture (fallback art, painted once): a humpback seen from the side, nose right. */
function ensureWhale(scene) {
    if (scene.textures.exists(KEY)) return;
    const W = 1024, H = 420, tex = scene.textures.createCanvas(KEY, W, H), c = tex.getContext();
    const outline = () => {
        c.beginPath();                                   // fluke
        c.moveTo(160, 200); c.quadraticCurveTo(70, 150, 14, 96); c.quadraticCurveTo(60, 190, 70, 204);
        c.quadraticCurveTo(60, 230, 18, 318); c.quadraticCurveTo(80, 262, 160, 214); c.closePath();
        c.moveTo(140, 190); c.bezierCurveTo(330, 150, 470, 84, 700, 92); c.bezierCurveTo(880, 98, 990, 150, 1008, 206);   // body
        c.bezierCurveTo(990, 262, 900, 318, 700, 332); c.bezierCurveTo(480, 344, 300, 262, 140, 218); c.closePath();
    };
    c.filter = 'blur(1.2px)';
    // Slate grey above, a pale belly below: she stands out from the blue around her.
    const skin = c.createLinearGradient(0, 80, 0, 340);
    skin.addColorStop(0, '#59636d'); skin.addColorStop(0.45, '#7b8791'); skin.addColorStop(0.72, '#c3ccd2'); skin.addColorStop(1, '#f4f7f8');
    c.fillStyle = skin; outline(); c.fill();
    c.save(); outline(); c.clip();
    c.fillStyle = 'rgba(52,60,68,0.35)';             // a mottled back
    for (let i = 0; i < 46; i++) {
        const x = 150 + ((i * 197) % 830), y = 96 + ((i * 61) % 90), r = 10 + ((i * 13) % 22);
        c.beginPath(); c.ellipse(x, y, r * 1.6, r * 0.7, 0, 0, 7); c.fill();
    }
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 16;   // light from above along her back
    c.beginPath(); c.moveTo(140, 186); c.bezierCurveTo(330, 146, 470, 80, 700, 88); c.bezierCurveTo(880, 94, 990, 146, 1008, 202); c.stroke();
    c.strokeStyle = 'rgba(120,134,146,0.6)'; c.lineWidth = 3;    // throat grooves
    for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(640, 268 + i * 9); c.quadraticCurveTo(820, 262 + i * 9, 968 - i * 14, 236 + i * 7); c.stroke(); }
    c.restore();
    c.fillStyle = '#59636d'; c.beginPath(); c.moveTo(350, 138); c.quadraticCurveTo(388, 92, 420, 116); c.lineTo(350, 138); c.fill();   // dorsal hump
    const fin = c.createLinearGradient(520, 290, 640, 410);                                                                         // long pectoral fin, white underneath
    fin.addColorStop(0, '#ffffff'); fin.addColorStop(0.7, '#e8eef1'); fin.addColorStop(1, '#93a1ab');
    c.fillStyle = fin; c.beginPath(); c.moveTo(690, 292); c.quadraticCurveTo(610, 330, 470, 412); c.quadraticCurveTo(600, 400, 740, 318); c.fill();
    c.strokeStyle = 'rgba(70,80,90,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(690, 292); c.quadraticCurveTo(610, 330, 470, 412); c.stroke();
    c.filter = 'none';
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(878, 208, 15, 0, 7); c.fill();
    c.fillStyle = '#16263a'; c.beginPath(); c.arc(882, 209, 9, 0, 7); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(885, 205, 3, 0, 7); c.fill();
    c.strokeStyle = '#3a444e'; c.lineWidth = 4; c.beginPath(); c.moveTo(900, 250); c.quadraticCurveTo(960, 250, 1000, 214); c.stroke();   // a calm smile
    c.fillStyle = 'rgba(250,252,252,0.9)';
    for (const [x, y, r] of [[955, 180, 6], [935, 168, 4], [970, 196, 5], [610, 300, 5], [300, 190, 5]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }   // barnacles
    tex.refresh();
}

/** A piece of ghost net as it hangs on her: a band of mesh laid over the body, its torn end trailing below. */
function ensureDrape(scene) {
    if (scene.textures.exists(DRAPE_KEY)) return;
    const W = 200, H = 560, band = 410, tex = scene.textures.createCanvas(DRAPE_KEY, W, H), c = tex.getContext();
    c.save();
    c.beginPath(); c.rect(18, 0, W - 36, band); c.clip();
    c.strokeStyle = 'rgba(185,162,122,0.95)'; c.lineWidth = 5;
    for (let i = -8; i <= 18; i++) {                       // the mesh
        c.beginPath(); c.moveTo(18, i * 26); c.lineTo(W - 18, i * 26 + 150); c.stroke();
        c.beginPath(); c.moveTo(W - 18, i * 26); c.lineTo(18, i * 26 + 150); c.stroke();
    }
    c.restore();
    c.strokeStyle = '#8f7a55'; c.lineWidth = 9; c.lineCap = 'round';                               // the ropes along its edges
    for (const x of [20, W - 20]) { c.beginPath(); c.moveTo(x, 6); c.lineTo(x, band); c.stroke(); }
    c.strokeStyle = 'rgba(185,162,122,0.9)'; c.lineWidth = 5;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(30 + i * 28, band - 6); c.lineTo(22 + i * 30 + (i % 2) * 14, H - 14 - (i % 3) * 34); c.stroke(); }   // the torn end
    c.fillStyle = '#e8dcc0';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(20, 30 + i * 85, 9, 0, 7); c.fill(); c.beginPath(); c.arc(W - 20, 70 + i * 80, 9, 0, 7); c.fill(); }   // floats
    tex.refresh();
}

const profile = width => ({ states: { normal: { key: KEY, width, wiggle: 40 } }, anim: 'swim', soft: 0.25 });
const SPOT = { x: 0, y: 0 }, PULL = { x: 0, y: 0 };

/**
 * The great whale in the world (ai/whale.js is her mind): her body and her calf are Rigs, the
 * net pieces hang over her until Lompi tears them off. `on(event, x, y)` reports 'cut',
 * 'freed', 'ride' and 'gone'.
 */
export default class Whale {
    constructor(scene, journey, startX, endX, routeY, on) {
        this.scene = scene; this.journey = journey; this.startX = startX; this.endX = endX; this.on = on;
        this.routeY = x => routeY(x) + WHALE_SCENE.below;
        this.mind = null;
        ensureWhale(scene);
        ensureDrape(scene);
    }

    build() {
        const s = this.scene, [dw, dh] = WHALE_SCENE.drape;
        this.mind = createWhale(this.startX, this.endX);
        this.mind.y = this.routeY(this.startX);
        this.body = new Rig(s, profile(WHALE.length), this.startX, this.mind.y, 3.4);
        this.calf = new Rig(s, profile(WHALE.length * WHALE_SCENE.calf), this.startX, this.mind.y, 3.3);
        this.calfAt = { x: this.startX, y: this.mind.y };
        // Hung from the top: each piece lies over her back and trails below her belly.
        this.nets = WHALE.nets.map(() => s.add.image(0, 0, DRAPE_KEY).setOrigin(0.5, 0.32).setDepth(3.6).setDisplaySize(dw, dh));
        this.blow = 0;
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
            // The piece peels off her: it slips down her side, turns and sinks away.
            const i = this.nets.findIndex((n, k) => n && w.cut[k]), net = this.nets[i];
            this.nets[i] = null;
            s.tweens.add({ targets: net, y: net.y + 520, x: net.x - 160, angle: -75, alpha: 0, scaleX: net.scaleX * 0.5, duration: 1500, ease: 'Sine.easeIn', onComplete: () => net.destroy() });
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
            n.setPosition(p.x, p.y).setRotation(Math.sin(t * 1.1 + i * 1.7) * 0.07 - 0.05);      // the trailing end sways behind
        });
        // On the ride her breath streams back over the rider: it feels like being carried.
        if (w.state === 'ride' && (this.blow -= delta / 1000) <= 0) {
            this.blow = WHALE_SCENE.blowEvery;
            const p = bodySpot(w, BLOWHOLE[0], BLOWHOLE[1], SPOT);
            for (let i = 0; i < 3; i++) {
                const b = s.add.circle(p.x - i * 30, p.y, 8 + i * 5, 0xffffff, 0.5).setStrokeStyle(3, 0xffffff, 0.8).setDepth(3.7);
                s.tweens.add({ targets: b, x: b.x - 260 - i * 60, y: b.y - 120 - i * 40, alpha: 0, scale: 1.6, duration: 900 + i * 150, onComplete: () => b.destroy() });
            }
        }
    }
}
