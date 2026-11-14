import { NUDI_GARDEN, nudiSpot, nudiAt, nudiPos, dragonPos } from './nudiGarden.js';

/**
 * What the sea slug garden looks like (level/nudiGarden.js says where they creep): painted slugs on
 * the reef rock and a blue dragon drifting above. Built only while Lompi is near; images moved per frame.
 *
 *   create():  this.nudis = new NudiGardenLayer(scene, groundY, onSeen)
 *   update():  this.nudis.update(fish, t)
 */
export const NUDI_LOOK = { near: 2600, far: 4000, depth: 3.3, swimDepth: 4.3 };

/** The painted slugs (user reference, painted by the techartist). Without them the garden stays empty. */
export const NUDI_ART = Object.fromEntries([...NUDI_GARDEN.kinds, NUDI_GARDEN.swimmer].map(k => [k, `img/${k}.png`]));

export default class NudiGardenLayer {
    constructor(scene, groundY, onSeen) {
        this.scene = scene; this.groundY = groundY; this.onSeen = onSeen;
        this.spot = nudiSpot();
        this.slugs = Array.from({ length: NUDI_GARDEN.crawlers }, (_, i) => nudiAt(i));
        this.live = null; this.seen = false;
    }

    build() {
        const s = this.scene, items = [];
        for (const n of this.slugs) {
            n.img = null;
            if (!s.textures.exists(n.key)) continue;
            const img = s.add.image(n.home, 0, n.key).setOrigin(0.5, 1).setDepth(NUDI_LOOK.depth);
            img.setScale(n.size / img.width);
            n.base = img.scaleX; n.ground = this.groundY(n.home); n.img = img; items.push(img);      // the rock's height looked up once: a slug creeps only a little
        }
        let dragon = null;
        if (s.textures.exists(NUDI_GARDEN.swimmer)) {
            dragon = s.add.image(0, 0, NUDI_GARDEN.swimmer).setDepth(NUDI_LOOK.swimDepth);
            dragon.setScale(NUDI_GARDEN.swimSize / dragon.width);
            items.push(dragon);
        }
        return { items, dragon };
    }

    /** Per frame. `fish` = { x, y }, `t` s. */
    update(fish, t) {
        const L = NUDI_LOOK, sp = this.spot;
        if (this.live && (fish.x < sp.x0 - L.far || fish.x > sp.x1 + L.far)) this.clear();
        if (!this.live) {
            if (fish.x < sp.x0 - L.near || fish.x > sp.x1 + L.near || !this.scene.buildSlot()) return;
            this.live = this.build();
        }
        for (const n of this.slugs) {
            if (!n.img) continue;
            const p = nudiPos(n, t), g = n.ground;
            if (g === null) { n.img.setVisible(false); continue; }
            // A slug ripples a little as it creeps (its frills breathe).
            n.img.setVisible(true).setPosition(p.x, g + 4).setFlipX(p.facing < 0).setScale(n.base, n.base * (1 + Math.sin(t * 2.2 + n.phase) * 0.04));
        }
        const d = this.live.dragon;
        if (d) {
            const p = dragonPos(t), g = this.groundY(p.x) ?? 0;
            d.setPosition(p.x, g - NUDI_GARDEN.swimOver + p.dy).setFlipX(p.facing < 0).setRotation(Math.sin(t * 1.1) * 0.08);
        }
        if (!this.seen && Math.abs(fish.x - (sp.x0 + sp.x1) / 2) < NUDI_GARDEN.seen) { this.seen = true; this.onSeen('nudibranchs'); }
    }

    clear() {
        for (const o of this.live.items) o.destroy();
        for (const n of this.slugs) n.img = null;
        this.live = null;
    }
}
