import { FAR, farCell, farBaseY, farLook, worldXFor } from './farDepths.js';

/**
 * Far scenery (farDepths.js): single painted objects, each at its own parallax depth,
 * small, soft and hazy with distance, their base fading into the water. Textures are
 * baked once per key (smaller, slightly blurred, bottom faded); objects are plain images
 * with a scroll factor, placed per cell as the view moves — nothing is redrawn per frame.
 *
 *   create():  this.farLayers = new FarLayers(this)
 *   update():  this.farLayers.update(camX)
 */
const BAKE_W = 220;          // baked texture width: the far view needs no fine detail
const BLUR = 1.8;            // bake blur (texture px)
const FADE = 0.38;           // bottom share of the object that fades into the water

/** Draw depth of an object at parallax s (far fish schools in Backdrop.js use the same scale). */
export const depthFor = s => -22.5 + 12 * s;

// Far things are under water too. A far layer's surface lies lower on screen than the real one
// once the camera rises above the water, so a tall far object would stand in the sky. Each one
// is therefore made no taller than what stays under the real waterline with the camera's top
// edge this share of the screen height above the surface (it goes that high in a jump).
const CAMERA_ABOVE = 0.5, HEADROOM = 24, MIN_HEIGHT = 70;

export default class FarLayers {
    constructor(scene) {
        this.scene = scene;
        this.live = new Map();     // "depth:cell" -> images
    }

    /** The soft, bottom-faded version of a texture, baked on first use. */
    baked(key) {
        const tex = this.scene.textures, far = `far_${key}`;
        if (tex.exists(far)) return far;
        const src = tex.get(key).getSourceImage();
        const w = Math.min(BAKE_W, src.width), h = Math.max(1, Math.round(src.height * w / src.width));
        const canvas = tex.createCanvas(far, w + 4, h + 4), ctx = canvas.getContext();
        ctx.filter = `blur(${BLUR}px)`;
        ctx.drawImage(src, 2, 2, w, h);
        ctx.filter = 'none';
        const g = ctx.createLinearGradient(0, 2 + h * (1 - FADE), 0, h + 2);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = g; ctx.fillRect(0, 0, w + 4, h + 4);
        canvas.refresh();
        return far;
    }

    update(camX) {
        const scene = this.scene, W = scene.scale.width, H = scene.scale.height;
        const has = key => scene.textures.exists(key);
        const keep = new Set();
        FAR.depths.forEach((s, di) => {
            const lx = camX * s, c0 = Math.floor((lx - FAR.cell) / FAR.cell), c1 = Math.floor((lx + W + FAR.cell) / FAR.cell);
            for (let ci = c0; ci <= c1; ci++) {
                const id = `${di}:${ci}`;
                keep.add(id);
                if (this.live.has(id)) continue;
                this.live.set(id, farCell(di, ci, W, 1337, has).map(o => {
                    const look = farLook(s, o.biome);
                    // Hanging things (mangrove roots) start at the surface: world y 0 is layer y 0.
                    const y = o.hang ? -20 * s : farBaseY(worldXFor(o.lx, s, W), s, H, o.rise);
                    const img = scene.add.image(o.lx, y, this.baked(o.key)).setOrigin(0.5, o.hang ? 0 : 1)
                        .setScrollFactor(s).setDepth(depthFor(s)).setAlpha(look.alpha).setTint(look.tint).setFlipX(o.flip);
                    img.setScale(o.w / img.width);
                    // Hanging things begin as far under the layer's surface as the real one can lie below it.
                    const rise = H * CAMERA_ABOVE * (1 - s);
                    if (o.hang) img.y = rise;
                    else {
                        const room = y - rise - HEADROOM;
                        if (room < MIN_HEIGHT) img.setVisible(false);
                        else if (img.displayHeight > room) img.setScale(room / img.height);      // smaller, keeping its shape
                    }
                    return img;
                }));
            }
        });
        for (const [id, imgs] of this.live) {
            if (keep.has(id)) continue;
            for (const img of imgs) img.destroy();
            this.live.delete(id);
        }
    }

    destroy() {
        for (const imgs of this.live.values()) for (const img of imgs) img.destroy();
        this.live.clear();
    }
}
