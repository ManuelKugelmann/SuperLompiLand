import Phaser from 'phaser';
import { CONTROL_SCHEMES } from '../controls/index.js';

/**
 * Top-center segmented control to switch schemes live, plus a physics-debug
 * toggle. All buttons are tagged data('hud', true) so control schemes ignore
 * pointer events that land on them.
 */
export default class ControlSwitcher {
    constructor(scene, activeId, onSelect, onToggleDebug) {
        this.scene = scene;
        const W = scene.scale.width;
        const bw = 300, bh = 86, gap = 16;
        const total = CONTROL_SCHEMES.length * bw + (CONTROL_SCHEMES.length - 1) * gap;
        let x = (W - total) / 2 + bw / 2;
        const y = 70;
        this.buttons = {};

        for (const s of CONTROL_SCHEMES) {
            const g = scene.add.container(x, y).setDepth(60);
            const bg = scene.add.rectangle(0, 0, bw, bh, 0x06525c, 0.9)
                .setStrokeStyle(4, 0xffffff, 0.5).setInteractive({ useHandCursor: true });
            bg.setData('hud', true);
            const txt = scene.add.text(0, 0, s.label, {
                fontFamily: 'Arial', fontSize: '34px', color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);
            g.add([bg, txt]);
            bg.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); onSelect(s.id); });
            this.buttons[s.id] = { bg, txt };
            x += bw + gap;
        }

        // Physics debug toggle (far right).
        const dg = scene.add.container(W - 110, y).setDepth(60);
        this.debugBg = scene.add.rectangle(0, 0, 180, bh, 0x33373f, 0.9)
            .setStrokeStyle(4, 0xffffff, 0.4).setInteractive({ useHandCursor: true });
        this.debugBg.setData('hud', true);
        this.debugTxt = scene.add.text(0, 0, 'Debug: aus', {
            fontFamily: 'Arial', fontSize: '26px', color: '#ffffff'
        }).setOrigin(0.5);
        dg.add([this.debugBg, this.debugTxt]);
        this.debugBg.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); onToggleDebug(); });

        this.setActive(activeId);
    }

    setActive(id) {
        for (const [sid, b] of Object.entries(this.buttons)) {
            const on = sid === id;
            b.bg.setFillStyle(on ? 0xffc266 : 0x06525c, on ? 1 : 0.9);
            b.txt.setColor(on ? '#06343a' : '#ffffff');
        }
    }

    setDebug(on) {
        this.debugTxt.setText(on ? 'Debug: an' : 'Debug: aus');
        this.debugBg.setFillStyle(on ? 0x5a8f3a : 0x33373f, 0.9);
    }
}
