import { SEA_ARCH, archRock, passedThrough, archCoins } from './seaArch.js';

export const ARCH_LOOK = {
    depth: 2,            // behind the fish: a jump flies in front of the rock and through its opening
    underDepth: -1.5,    // the legs under the water: behind everything that lives, in front of the far water
    underAlpha: [0.92, 0.5],   // how solid the legs look at the waterline and at their feet (they sink into the water's haze)
    underCell: 25,       // world px per pixel of the legs' fallback picture
    coin: 72,            // px across of a coin in the arc
    coinReach: 40,       // px (plus the fish's radius) at which one is taken
    coinsBack: 25,       // s after the arc was emptied until its coins are back
    again: 4             // s before a second pass counts again
};

/** The painted arch (loaded by the title screen); drawn procedurally while missing. */
export const ARCH_ART = { sea_arch: 'img/coast/sea_arch.webp', sea_arch_under: 'img/coast/sea_arch_under.webp' };

const KEY = 'sea_arch', UNDER = 'sea_arch_under';

/** Fallback picture: a dark basalt arch with its opening, the bottom edge is the waterline. */
function ensureTexture(scene) {
    if (scene.textures.exists(KEY)) return;
    const [W, H] = SEA_ARCH.art.size, [ox, oy, ow] = SEA_ARCH.art.opening, k = 0.5;
    const tex = scene.textures.createCanvas(KEY, W * k, H * k), c = tex.getContext();
    c.scale(k, k);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6d7078'); g.addColorStop(1, '#2f333b');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, H);
    c.bezierCurveTo(W * 0.04, H * 0.35, W * 0.22, H * 0.06, W * 0.5, H * 0.08);
    c.bezierCurveTo(W * 0.8, H * 0.05, W * 0.97, H * 0.4, W, H);
    c.closePath(); c.fill();
    // The opening: a round-topped gate cut out of it.
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.moveTo(ox, H); c.lineTo(ox, oy + ow * 0.35);
    c.bezierCurveTo(ox, oy - 20, ox + ow, oy - 20, ox + ow, oy + ow * 0.35);
    c.lineTo(ox + ow, H); c.closePath(); c.fill();
    tex.refresh();
}

/** Fallback picture of the legs under the water: dark basalt from the waterline down, thinning into the haze, the opening left out. */
function ensureUnder(scene, arch) {
    if (scene.textures.exists(UNDER)) return;
    const c = ARCH_LOOK.underCell, W = Math.ceil((arch.x1 - arch.x0) / c), H = Math.ceil(SEA_ARCH.footDepth / c);
    const tex = scene.textures.createCanvas(UNDER, W, H), ctx = tex.getContext(), img = ctx.createImageData(W, H), [a0, a1] = ARCH_LOOK.underAlpha;
    for (let j = 0; j < H; j++) {
        for (let i = 0; i < W; i++) {
            const x = arch.x0 + (i + 0.5) * c, y = (j + 0.5) * c, k = j / H, o = (j * W + i) * 4;
            if (archRock(arch, x, y) <= 0) continue;
            // Softer toward the outer faces, so no straight edge stands in the water.
            const side = Math.min(1, Math.min(x - arch.x0, arch.x1 - x) / 260), shade = 1 - 0.35 * k;
            img.data[o] = 58 * shade; img.data[o + 1] = 64 * shade; img.data[o + 2] = 76 * shade;
            img.data[o + 3] = 255 * (a0 + (a1 - a0) * k) * side * side * (3 - 2 * side);
        }
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
}

/**
 * What the sea arch looks like (level/seaArch.js says where it is): the painted arch standing
 * on the waterline, its legs going on down under the water as a picture behind the fish, and
 * an arc of coins through its opening. `onPass(inAir)` is called when the fish goes through
 * the opening, `onCoin(x, y)` for every coin taken.
 */
export default class SeaArchLayer {
    constructor(scene, arch, onPass, onCoin) {
        this.scene = scene; this.arch = arch; this.onPass = onPass; this.onCoin = onCoin;
        ensureTexture(scene); ensureUnder(scene, arch);
        scene.add.image(arch.x0, 0, UNDER).setOrigin(0, 0).setDisplaySize(arch.x1 - arch.x0, SEA_ARCH.footDepth).setDepth(ARCH_LOOK.underDepth);
        const [W, H] = SEA_ARCH.art.size, k = arch.scale;
        scene.add.image(arch.x0, -H * k, KEY).setOrigin(0, 0).setDisplaySize(W * k, H * k).setDepth(ARCH_LOOK.depth);
        this.coins = archCoins(arch).map(p => {
            const img = scene.textures.exists('coin')
                ? scene.add.image(p.x, p.y, 'coin').setDisplaySize(ARCH_LOOK.coin, ARCH_LOOK.coin)
                : scene.add.circle(p.x, p.y, 32, 0xffd23f).setStrokeStyle(5, 0xfff3b0);
            return img.setDepth(ARCH_LOOK.depth + 0.5);
        });
        this.prev = null; this.passedAt = -Infinity; this.emptyAt = null;
    }

    /** Per frame. `fish` = { x, y }, `radius` its radius, `t` s, `inAir` = it is above the water. */
    update(fish, radius, t, inAir) {
        const a = this.arch;
        if (fish.x < a.x0 - 600 || fish.x > a.x1 + 600) { this.prev = null; return; }
        if (this.prev && t - this.passedAt > ARCH_LOOK.again && passedThrough(a, this.prev, fish)) { this.passedAt = t; this.onPass(inAir); }
        this.prev = { x: fish.x, y: fish.y };
        let left = 0;
        for (const c of this.coins) {
            if (!c.visible) continue;
            if (Math.hypot(c.x - fish.x, c.y - fish.y) < radius + ARCH_LOOK.coinReach) { c.setVisible(false); this.onCoin(c.x, c.y); } else left++;
        }
        if (left === 0 && this.emptyAt === null) this.emptyAt = t;
        if (this.emptyAt !== null && t - this.emptyAt > ARCH_LOOK.coinsBack) { this.emptyAt = null; for (const c of this.coins) c.setVisible(true); }
    }
}
