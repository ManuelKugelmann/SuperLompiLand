import { BIOMES } from '../level/biomes.js';
import { createSeabird, stepSeabird, shadowX } from './seabird.js';

// Seabirds near island coasts (spec gamedesign §5.0d), drawn from ai/seabird.js. A few birds per
// coast, alive only while the camera is near that coast. Painted art: gannet_glide (wings
// spread, seen from below), gannet_dive (wings folded, bill down), gannet_float (side view,
// bill right); without it a simple white bird is drawn once. Their shadow is a soft dark
// patch just under the water surface that follows a hunting bird.

export const SEABIRDS = {
    perCoast: 2,         // birds per island coast
    coastCooldownS: 6,   // s between dives at the player per coast (birds take turns)
    near: 2600,          // px: birds of a coast exist while the camera is this close to it
    depth: 3.55,         // draw depth (with the swarms)
    glideW: 175,         // px wide circling
    diveH: 160,          // px long diving
    floatW: 95,          // px wide resting on the water
    shadowW: 170,        // px wide shadow patch
    shadowAlpha: 0.28,   // at its darkest (the moment before the dive)
    shadowDepth: 40      // px under the surface
};

export const SEABIRD_ART = ['gannet_glide', 'gannet_dive', 'gannet_float'];

/** x of every island coast that faces open sea. */
export function coasts(biomes = BIOMES) {
    const out = [];
    for (let i = 1; i < biomes.length; i++) {
        const a = biomes[i - 1], b = biomes[i];
        if (a.zone !== b.zone) out.push(b.from);
    }
    return out;
}

const FALLBACK = 'gannet_fallback';
const SHADOW = 'gannet_shadow';

function ensureTextures(scene) {
    if (!scene.textures.exists(FALLBACK)) {
        const tex = scene.textures.createCanvas(FALLBACK, 128, 64), c = tex.getContext();
        c.fillStyle = '#f4f6f8';
        c.beginPath(); c.ellipse(64, 34, 30, 9, 0, 0, 7); c.fill();                                          // body
        c.beginPath(); c.moveTo(48, 32); c.quadraticCurveTo(20, 12, 2, 22); c.quadraticCurveTo(26, 30, 50, 38); c.fill();   // wings
        c.beginPath(); c.moveTo(80, 32); c.quadraticCurveTo(108, 12, 126, 22); c.quadraticCurveTo(102, 30, 78, 38); c.fill();
        c.fillStyle = '#2a2a2a';
        c.beginPath(); c.moveTo(2, 22); c.lineTo(10, 21); c.lineTo(8, 26); c.fill();                          // black wing tips
        c.beginPath(); c.moveTo(126, 22); c.lineTo(118, 21); c.lineTo(120, 26); c.fill();
        c.fillStyle = '#f2d16b'; c.beginPath(); c.arc(92, 32, 6, 0, 7); c.fill();                               // yellow head
        c.fillStyle = '#9fb3c4'; c.beginPath(); c.moveTo(97, 30); c.lineTo(110, 33); c.lineTo(97, 35); c.fill();   // bill
        tex.refresh();
    }
    if (!scene.textures.exists(SHADOW)) {
        const tex = scene.textures.createCanvas(SHADOW, 128, 32), c = tex.getContext();
        const g = c.createRadialGradient(64, 16, 2, 64, 16, 62);
        g.addColorStop(0, 'rgba(0,20,40,1)'); g.addColorStop(1, 'rgba(0,20,40,0)');
        c.setTransform(1, 0, 0, 0.25, 0, 12); c.fillStyle = g; c.beginPath(); c.arc(64, 16, 62, 0, 7); c.fill();
        tex.refresh();
    }
}

const art = (scene, key) => (scene.textures.exists(key) ? key : FALLBACK);

export default class SeabirdLayer {
    /** env: { surfaceY(x), covered(x, y) }; `on(event, x, y)` gets aim / splash / hit / bounce / strike. */
    constructor(scene, env, on) {
        this.scene = scene; this.env = env; this.on = on;
        this.coasts = coasts().map((x, i) => ({ x, i, birds: null, cool: 0 }));
        ensureTextures(scene);
    }

    spawn(coast) {
        const s = this.scene;
        coast.birds = Array.from({ length: SEABIRDS.perCoast }, (_, k) => {
            const mind = createSeabird(coast.x + (k - 0.5) * 500, this.env.surfaceY, {}, coast.i * 3.7 + k * 1.9);
            mind.homeX = coast.x;
            return { mind, sprite: s.add.image(mind.x, mind.y, art(s, 'gannet_glide')).setDepth(SEABIRDS.depth),
                shadow: s.add.image(mind.x, 0, SHADOW).setDepth(SEABIRDS.depth - 0.01).setAlpha(0) };
        });
    }

    drop(coast) {
        for (const b of coast.birds) { b.sprite.destroy(); b.shadow.destroy(); }
        coast.birds = null;
    }

    /** dt s; camera centre x; `player` local fish {x, y, puffed, big} or null; `players` everyone; `shoals` [{x, y}]. */
    update(dt, cx, player, players, shoals) {
        const env = { surfaceY: this.env.surfaceY, covered: this.env.covered, player, players, shoals };
        for (const coast of this.coasts) {
            const near = Math.abs(coast.x - cx) < SEABIRDS.near;
            if (near && !coast.birds) this.spawn(coast);
            else if (!near && coast.birds) this.drop(coast);
            if (!coast.birds) continue;
            coast.cool = Math.max(0, coast.cool - dt);
            for (const b of coast.birds) {
                // One bird at a time hunts the player: the others keep to the shoals.
                env.mayHunt = coast.cool <= 0;
                const m = b.mind, ev = stepSeabird(m, Math.min(dt, 0.05), env);
                if (ev === 'aim' && m.target?.kind === 'player') coast.cool = SEABIRDS.coastCooldownS;
                if (ev) this.on(ev, m.x, m.y);
                this.draw(b, dt);
            }
        }
    }

    draw(b, dt) {
        const m = b.mind, s = this.scene, sp = b.sprite, C = SEABIRDS;
        if (m.state === 'dive' || (m.state === 'rise' && m.vy > 0)) {
            const key = art(s, 'gannet_dive');
            sp.setTexture(key).setRotation(key === FALLBACK ? Math.atan2(m.vy, m.vx) : Math.atan2(m.vy, m.vx) - Math.PI / 2);
            sp.setScale(C.diveH / (key === FALLBACK ? sp.width : sp.height));
        } else if (m.state === 'rest' || m.state === 'rise') {
            const key = art(s, 'gannet_float');
            sp.setTexture(key).setRotation(0).setScale(C.floatW / sp.width).setFlipX(m.vx < 0);
        } else {
            const key = art(s, 'gannet_glide');
            // A slow wing rock while circling; wings held still in the hover before the dive.
            const rock = m.state === 'aim' ? 0 : Math.sin(m.timer * 2.2 + m.seed) * 0.12;
            sp.setTexture(key).setRotation(rock).setScale(C.glideW / sp.width).setFlipX(m.vx < 0);
        }
        sp.setPosition(m.x, m.state === 'rest' ? m.y - sp.displayHeight * 0.3 : m.y);
        // The shadow: faint while circling, darkest during the hover above the prey.
        const sx = shadowX(m), want = sx === null ? 0 : m.state === 'aim' ? C.shadowAlpha : C.shadowAlpha * 0.35;
        b.shadow.alpha += (want - b.shadow.alpha) * Math.min(1, dt * 5);
        if (sx !== null) b.shadow.setPosition(sx, this.env.surfaceY(sx) + C.shadowDepth).setScale(C.shadowW / 128, 1);
    }

    destroy() { for (const c of this.coasts) if (c.birds) this.drop(c); }
}
