import Phaser from 'phaser';

/**
 * Coins stay readable in the dark: the scene light (MainScene.ambient, a multiply layer at depth
 * 40) dims everything under it, coins included, so at night and deep down a coin turns dull
 * olive. A soft gold glint is drawn over each coin on screen above that layer, as strong as the
 * light is dark. One Blitter for all of them; nothing at all in bright water.
 */
export const COIN_GLOW = {
    depth: 40.5,         // just above the scene light
    size: 122,           // px across (about 1.7 coins; a Blitter does not scale, so it is baked at this size)
    strength: 0.75,      // alpha of the glint in full darkness
    from: 0.25           // how dark the light must be (0 bright .. 1 black) before the glint starts
};

const KEY = 'coin_glow';

function texture(scene) {
    if (scene.textures.exists(KEY)) return;
    const S = COIN_GLOW.size, t = scene.textures.createCanvas(KEY, S, S), c = t.getContext(), h = S / 2;
    const g = c.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, 'rgba(255,236,150,0.95)'); g.addColorStop(0.35, 'rgba(255,214,90,0.55)'); g.addColorStop(1, 'rgba(255,200,60,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S); t.refresh();
}

export default class CoinGlow {
    constructor(scene) {
        this.scene = scene;
        texture(scene);
        this.blitter = scene.add.blitter(0, 0, KEY).setDepth(COIN_GLOW.depth).setBlendMode(Phaser.BlendModes.ADD);
        this.bobs = [];
    }

    /** Per frame. `light` = the scene light's colour (0xRRGGBB) this frame. */
    update(light) {
        const G = COIN_GLOW, luma = (0.299 * ((light >> 16) & 255) + 0.587 * ((light >> 8) & 255) + 0.114 * (light & 255)) / 255;
        const k = Phaser.Math.Clamp((1 - luma - G.from) / (1 - G.from), 0, 1) * G.strength;
        let n = 0;
        if (k > 0.01) {
            const view = this.scene.cameras.main.worldView;
            for (const o of this.scene.children.list) {
                if (o.texture?.key !== 'coin' || !o.visible || !o.active) continue;
                if (o.x < view.x - 80 || o.x > view.right + 80 || o.y < view.y - 80 || o.y > view.bottom + 80) continue;
                const b = this.bobs[n] || (this.bobs[n] = this.blitter.create(0, 0));
                b.setVisible(true); b.alpha = k * o.alpha;
                b.x = o.x - G.size / 2; b.y = o.y - G.size / 2;
                n++;
            }
        }
        for (let i = n; i < this.bobs.length; i++) this.bobs[i].setVisible(false);
    }
}
