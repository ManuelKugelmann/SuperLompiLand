import { CONTROL_SCHEMES } from '../controls/index.js';

/**
 * Top-center segmented control to switch schemes live, plus a physics-debug
 * toggle. Screen-fixed. Buttons are interactive, so control schemes ignore
 * pointer events that land on them.
 */
export default class ControlSwitcher {
    constructor(scene, activeId, onSelect, onToggleDebug) {
        const W = scene.scale.width;
        const bw = 250, bh = 78, gap = 14, y = 62;
        const total = CONTROL_SCHEMES.length * bw + (CONTROL_SCHEMES.length - 1) * gap;
        let x = (W - total) / 2 + bw / 2;
        this.buttons = {};

        const button = (bx, w, label, onTap) => {
            const bg = scene.add.rectangle(bx, y, w, bh, 0x06525c, 0.85)
                .setStrokeStyle(4, 0xffffff, 0.5).setScrollFactor(0).setDepth(60)
                .setInteractive({ useHandCursor: true });
            const txt = scene.add.text(bx, y, label, {
                fontFamily: 'Arial', fontSize: '30px', color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(61);
            bg.on('pointerdown', onTap);
            return { bg, txt };
        };

        for (const s of CONTROL_SCHEMES) {
            this.buttons[s.id] = button(x, bw, s.label, () => onSelect(s.id));
            x += bw + gap;
        }
        this.debug = button(W - 110, 170, 'Debug', onToggleDebug);
        this.debug.txt.setFontSize(24);
        this.setActive(activeId);
        this.setDebug(false);
    }

    setActive(id) {
        for (const [sid, b] of Object.entries(this.buttons)) {
            const on = sid === id;
            b.bg.setFillStyle(on ? 0xffc266 : 0x06525c, on ? 1 : 0.85);
            b.txt.setColor(on ? '#06343a' : '#ffffff');
        }
    }

    setDebug(on) {
        this.debug.bg.setFillStyle(on ? 0x5a8f3a : 0x33373f, 0.85);
    }
}
