import Phaser from 'phaser';
import { BIOMES } from '../level/biomes.js';
import { createStation, stepStation } from './cleaner.js';

/**
 * The cleaner station on the reef (spec 5.0f; ai/cleaner.js decides): a big grouper hovering
 * with its mouth open while cleaner wrasse pick it over; a fish that floats in calmly is
 * cleaned too and gets half a heart back. Painted art when present (friend_grouper,
 * school_wrasse), otherwise drawn once here.
 *
 *   create():  this.cleaner = new CleanerLayer(scene, routeY, isOpen, (ev, x, y) => ...)
 *   update():  this.cleaner.update(dt, t, fish {x, y, speed})
 */
export const CLEANER_LOOK = {
    at: 0.3,             // where in the reef (share of its width) the station is
    below: 140,          // px under the calm route
    grouperW: 300,       // px long
    wrasse: 3,
    wrasseW: 46,         // px long each
    depth: 3.4
};

function ensureArt(scene) {
    const tex = scene.textures;
    if (!tex.exists('cleaner_grouper')) {
        const t = tex.createCanvas('cleaner_grouper', 300, 150), c = t.getContext();
        const body = c.createLinearGradient(0, 30, 0, 130);
        body.addColorStop(0, '#6b4a36'); body.addColorStop(0.6, '#8a6a4c'); body.addColorStop(1, '#d6bf98');
        c.fillStyle = body;
        c.beginPath(); c.moveTo(18, 75); c.bezierCurveTo(60, 20, 200, 18, 262, 52); c.lineTo(292, 64); c.lineTo(268, 80);
        c.lineTo(292, 98); c.lineTo(262, 104); c.bezierCurveTo(200, 134, 60, 132, 18, 75); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(22, 75); c.lineTo(0, 50); c.lineTo(6, 75); c.lineTo(0, 102); c.closePath(); c.fill();   // tail
        c.fillStyle = 'rgba(60,40,28,0.45)';                                                                            // mottled spots
        for (let i = 0; i < 28; i++) { c.beginPath(); c.arc(50 + (i * 37) % 190, 50 + (i * 23) % 60, 5 + (i % 3) * 3, 0, 7); c.fill(); }
        c.fillStyle = '#3a1f1a'; c.beginPath(); c.ellipse(276, 81, 14, 13, 0, 0, 7); c.fill();                          // open mouth
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(238, 62, 10, 0, 7); c.fill();
        c.fillStyle = '#1b1410'; c.beginPath(); c.arc(240, 63, 6, 0, 7); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(242, 60, 2, 0, 7); c.fill();
        t.refresh();
    }
    if (!tex.exists('cleaner_wrasse')) {
        const t = tex.createCanvas('cleaner_wrasse', 48, 16), c = t.getContext();
        c.fillStyle = '#3fb6ff'; c.beginPath(); c.ellipse(26, 8, 20, 6, 0, 0, 7); c.fill();
        c.beginPath(); c.moveTo(8, 8); c.lineTo(0, 2); c.lineTo(0, 14); c.closePath(); c.fill();
        c.fillStyle = '#0b1a2a'; c.fillRect(8, 7, 38, 3);                                                               // the black stripe
        t.refresh();
    }
}

export default class CleanerLayer {
    constructor(scene, routeY, isOpen, on) {
        this.scene = scene; this.on = on;
        const reef = BIOMES.find(b => b.id === 'reef'), x = reef.from + reef.width * CLEANER_LOOK.at;
        let y = routeY(x) + CLEANER_LOOK.below;
        for (let k = 0; k < 12 && !isOpen(x, y); k++) y -= 40;   // into open water near the route
        this.station = createStation(x, y);
        ensureArt(scene);
        const L = CLEANER_LOOK, gKey = scene.textures.exists('friend_grouper') ? 'friend_grouper' : 'cleaner_grouper';
        this.grouper = scene.add.image(x, y, gKey).setDepth(L.depth);
        this.grouper.setScale(L.grouperW / this.grouper.width);
        const wKey = scene.textures.exists('school_wrasse') ? 'school_wrasse' : 'cleaner_wrasse';
        this.wrasse = Array.from({ length: L.wrasse }, (_, i) => {
            const w = scene.add.image(x, y, wKey).setDepth(L.depth + 0.01);
            w.setScale(L.wrasseW / w.width); w.phase = i * 2.1;
            w.at = { x, y };
            return w;
        });
    }

    /** dt s, t s, fish = { x, y, speed px/s }. */
    update(dt, t, fish) {
        const st = this.station, ev = stepStation(st, dt, fish);
        if (ev) this.on(ev, st.x, st.y);
        // The grouper hovers, gills and mouth "breathing" a little.
        this.grouper.setPosition(st.x + Math.sin(t * 0.4) * 10, st.y + Math.sin(t * 0.7) * 6)
            .setScale(CLEANER_LOOK.grouperW / this.grouper.width * (1 + Math.sin(t * 1.6) * 0.012));
        // The wrasse pick over whoever is being cleaned, darting; scattered ones hide behind the station.
        const target = st.state === 'fish' && fish ? fish
            : st.state === 'scattered' ? { x: st.x - 260, y: st.y + 120 } : { x: this.grouper.x, y: this.grouper.y };
        const span = st.state === 'fish' ? 60 : 110;
        for (const w of this.wrasse) {
            const tx = target.x + Math.sin(t * 2.3 + w.phase) * span, ty = target.y + Math.sin(t * 3.1 + w.phase * 1.7) * span * 0.35;
            const k = 1 - Math.exp(-dt * (st.state === 'scattered' ? 6 : 3.5));
            const nx = w.at.x + (tx - w.at.x) * k, ny = w.at.y + (ty - w.at.y) * k;
            w.setFlipX(nx < w.at.x).setPosition(nx, ny);
            w.at.x = nx; w.at.y = ny;
        }
    }

    destroy() {
        this.grouper.destroy();
        for (const w of this.wrasse) w.destroy();
    }
}
