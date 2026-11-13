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

        // Health bar.
        this.hpW = 300;
        this.add.rectangle(40, 300, this.hpW + 8, 34, 0x06343a, 0.7).setOrigin(0, 0.5).setStrokeStyle(3, 0xffffff, 0.6);
        this.hpFill = this.add.rectangle(44, 300, this.hpW, 26, 0x5fd35f).setOrigin(0, 0.5);
        this.add.text(44 + this.hpW + 18, 300, '♥', { fontFamily: 'Arial', fontSize: '34px', color: '#ff6b9a' }).setOrigin(0, 0.5);

        this.add.text(this.scale.width - 16, this.scale.height - 12, VERSION_TAG, {
            fontFamily: 'Arial', fontSize: '20px', color: '#ffffff'
        }).setOrigin(1, 1).setAlpha(0.4);

        // Banner line for announcements (biome names, nest reached, ...).
        const W = this.scale.width, H = this.scale.height;
        this.bannerTitle = this.add.text(W / 2, H * 0.26, '', {
            fontFamily: 'Arial', fontSize: '96px', color: '#ffffff', fontStyle: 'bold', stroke: '#0a3f6e', strokeThickness: 14
        }).setOrigin(0.5).setAlpha(0);
        this.bannerSub = this.add.text(W / 2, H * 0.26 + 86, '', {
            fontFamily: 'Arial', fontSize: '40px', color: '#fff3b0', fontStyle: 'bold', stroke: '#0a3f6e', strokeThickness: 8
        }).setOrigin(0.5).setAlpha(0);

        new BurgerMenu(this, 60, 60, [
            { label: de ? 'ENDE' : 'END', color: 0x2e7d32, callback: () => main.finish() },
            { label: de ? 'NEU ANFANGEN' : 'START OVER', color: 0x6d4c41, callback: () => main.startOver() },
            ...pwaMenuItems(this, main.lang),
            { label: de ? 'ZURÜCK' : 'EXIT', color: 0xd32f2f, callback: () => main.scene.start('MainMenuScene') }
        ]);
    }

    banner(title, subtitle = '') {
        const targets = [this.bannerTitle, this.bannerSub];
        this.tweens.killTweensOf(targets);
        this.bannerTitle.setText(title).setAlpha(0).setScale(0.8);
        this.bannerSub.setText(subtitle).setAlpha(0);
        this.tweens.add({ targets: this.bannerTitle, alpha: 1, scale: 1, duration: 320, ease: 'Back.easeOut' });
        this.tweens.add({ targets: this.bannerSub, alpha: 1, duration: 320, delay: 150 });
        this.tweens.add({ targets, alpha: 0, duration: 600, delay: 2400 });
    }

    update() {
        const m = this.main;
        if (!m?.fish) return;
        this.coinText.setText(String(m.coins));
        this.depthText.setText(`${this.depthLabel} ${m.depthMeters()} m`);
        const hp = Phaser.Math.Clamp(m.health / m.maxHealth, 0, 1);
        this.hpFill.width = Phaser.Math.Linear(this.hpFill.width, this.hpW * hp, 0.2);
        this.hpFill.setFillStyle(hp > 0.5 ? 0x5fd35f : hp > 0.25 ? 0xffc23d : 0xff5a4f);
    }
}
