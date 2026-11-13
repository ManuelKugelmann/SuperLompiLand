import Phaser from 'phaser';
import BurgerMenu from '@gks/sdk/ui/BurgerMenu.js';
import ControlSwitcher from '../game/ui/ControlSwitcher.js';
import { pwaMenuItems, VERSION_TAG } from '../game/pwa.js';
import { SCENE_KEYS } from './keys.js';

export const HUD_KEY = `${SCENE_KEYS.MAIN}_Hud`;

/**
 * Heads-up display, run as its own scene on top of the game.
 * Its camera never scrolls, so every button is reliably clickable while the
 * world camera moves, and a tap that lands on a HUD element is consumed here and
 * never reaches the control scheme underneath.
 */
export default class HudScene extends Phaser.Scene {
    constructor() {
        super({ key: HUD_KEY });
    }

    create({ main }) {
        this.main = main;
        // Remember presses that landed on HUD elements, so the game scene can
        // ignore them even if the element is gone by the time it looks (a tap
        // that closes the menu must not also steer the fish).
        this.consumedDown = -1;
        this.input.on('pointerdown', (pointer, over) => {
            if (over.length > 0) this.consumedDown = pointer.downTime;
        });
        const de = main.lang === 'de';

        this.switcher = new ControlSwitcher(this, main.activeScheme,
            id => { main.switchScheme(id); this.switcher.setActive(id); },
            () => this.switcher.setDebug(main.toggleDebug()));

        const hudText = (x, y, size) => this.add.text(x, y, '', {
            fontFamily: 'Arial', fontSize: size, color: '#ffffff', fontStyle: 'bold',
            stroke: '#0a3f6e', strokeThickness: 8
        });
        if (this.textures.exists('coin')) this.add.image(70, 190, 'coin').setDisplaySize(64, 64);
        this.coinText = hudText(116, 162, '50px');
        this.depthText = hudText(40, 232, '34px');
        this.depthLabel = de ? 'Tiefe' : 'Depth';

        this.add.text(this.scale.width - 16, this.scale.height - 12, VERSION_TAG, {
            fontFamily: 'Arial', fontSize: '20px', color: '#ffffff'
        }).setOrigin(1, 1).setAlpha(0.4);

        new BurgerMenu(this, 60, 60, [
            { label: de ? 'ENDE' : 'END', color: 0x2e7d32, callback: () => main.finish() },
            ...pwaMenuItems(this, main.lang),
            { label: de ? 'ZURÜCK' : 'EXIT', color: 0xd32f2f, callback: () => main.scene.start('MainMenuScene') }
        ]);
    }

    update() {
        const m = this.main;
        if (!m?.fish) return;
        this.coinText.setText(String(m.coins));
        this.depthText.setText(`${this.depthLabel} ${m.depthMeters()} m`);
    }
}
