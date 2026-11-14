import { UI, pillImage, textStyle } from './kit.js';

// The game's menu in the UI kit's look, laid out for the landscape phone (spec 5.0l): a round
// burger button, and a two-column grid of big pills whose height is a share of the screen, so
// every button stays a comfortable thumb target (>= 44 CSS px on a 390 px tall phone).
// Same items as before: { label, color, callback, closeOnClick }.
export const MENU = {
    button: 0.13,      // the burger button's size, share of the screen height
    rowH: 0.12,        // a menu button's height, share of the screen height
    gap: 0.025,        // space between buttons, share of the screen height
    colW: 0.3,         // a column's width, share of the screen width
    font: 0.042,       // label size, share of the screen height
    dim: 0.6           // how dark the game behind the open menu gets
};

export default class GameMenu {
    constructor(scene, x, y, items) {
        this.scene = scene;
        this.items = items;
        const H = scene.scale.height, s = Math.round(H * MENU.button);
        // The burger: a round kit pill with three bars, baked into one picture.
        const bars = (g, cx, cy) => {
            g.fillStyle(0xffffff, 1);
            for (const dy of [-0.18, 0, 0.18]) g.fillRoundedRect(cx - s * 0.24, cy + dy * s - s * 0.035, s * 0.48, s * 0.07, s * 0.035);
        };
        this.icon = pillImage(scene, x, y, s, s, { radius: s / 2, alpha: 0.75 }, bars, 'burger').setDepth(19000);
        this.icon.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleMenu());
        this.overlay = null;
    }

    build() {
        const sc = this.scene, W = sc.scale.width, H = sc.scale.height;
        const rowH = Math.round(H * MENU.rowH), gap = Math.round(H * MENU.gap), colW = Math.round(W * MENU.colW);
        const rows = Math.ceil(this.items.length / 2), totalH = rows * rowH + (rows - 1) * gap;
        const o = sc.add.container(0, 0).setDepth(20000);
        const blocker = sc.add.rectangle(W / 2, H / 2, W, H, 0x000000, MENU.dim).setInteractive().on('pointerdown', () => this.toggleMenu());
        o.add(blocker);
        this.items.forEach((item, i) => {
            const col = i % 2, row = Math.floor(i / 2);
            const lone = i === this.items.length - 1 && this.items.length % 2 === 1;      // an odd last item sits in the middle
            const x = lone ? W / 2 : W / 2 + (col === 0 ? -1 : 1) * (colW / 2 + gap / 2);
            const y = H / 2 - totalH / 2 + rowH / 2 + row * (rowH + gap);
            const g = pillImage(sc, x, y, colW, rowH, { fill: item.color ?? UI.surface, alpha: 0.95 });
            const txt = sc.add.text(x, y, item.label, textStyle(Math.round(H * MENU.font))).setOrigin(0.5);
            if (txt.width > colW - 24) txt.setScale((colW - 24) / txt.width);
            const hit = sc.add.rectangle(x, y, colW, rowH, 0xffffff, 0).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => {
                sc.tweens.add({ targets: [g, txt], scale: 0.95, yoyo: true, duration: 60, onComplete: () => {
                    item.callback?.();
                    if (item.closeOnClick !== false && this.overlay) this.toggleMenu();
                } });
            });
            o.add([g, txt, hit]);
        });
        return o;
    }

    toggleMenu() {
        // Built fresh on every open: labels such as the sound or the update state change between opens.
        if (this.overlay) { this.overlay.destroy(); this.overlay = null; return; }
        this.overlay = this.build();
    }

    destroy() {
        this.overlay?.destroy();
        this.icon.destroy();
    }
}
