import Phaser from 'phaser';
import BurgerMenu from '@gks/sdk/ui/BurgerMenu.js';
import cardImg from '../assets/card_preview.png';
import MainScene from './MainScene.js';
import EndScene from './EndScene.js';
import { SCENE_KEYS } from './keys.js';

export const gameMeta = {
    sceneKey: SCENE_KEYS.INTRO,
    previewImage: cardImg,
    title: {
        de: 'Super Lompi Land',
        en: 'Super Lompi Land'
    },
    description: {
        de: 'Steuere den Kugelfisch durchs Wasser — probiere verschiedene Steuerungen aus!',
        en: 'Guide the pufferfish through the water — try different control schemes!'
    },
    context: ['knowledge'], // 'math' | 'language' | 'knowledge'
    difficulty: 1
};

export default class IntroScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENE_KEYS.INTRO });
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        const lang = this.registry.get('currentLanguage') || 'de';

        // Register internal scenes once.
        if (!this.scene.get(SCENE_KEYS.MAIN)) {
            this.scene.add(SCENE_KEYS.MAIN, MainScene, false);
            this.scene.add(SCENE_KEYS.END, EndScene, false);
        }

        // Underwater gradient backdrop.
        for (let i = 0; i < 12; i++) {
            const t = i / 11;
            const col = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(0x1aa3b5), new Phaser.Display.Color(0x04343a), 11, i
            );
            this.add.rectangle(W / 2, (H / 12) * (i + 0.5), W, H / 12 + 2,
                Phaser.Display.Color.GetColor(col.r, col.g, col.b));
        }

        this.add.text(W / 2, H * 0.38, 'Super Lompi Land', {
            fontFamily: 'Arial, sans-serif', fontSize: '120px', color: '#fff7e6',
            fontStyle: 'bold', stroke: '#06525c', strokeThickness: 12
        }).setOrigin(0.5);

        this.add.text(W / 2, H * 0.5, '🐡', { fontSize: '140px' }).setOrigin(0.5);

        const startText = this.add.text(W / 2, H * 0.72,
            lang === 'de' ? 'Tippen zum Starten' : 'Tap to Start',
            { fontFamily: 'Arial, sans-serif', fontSize: '48px', color: '#ffffff' }
        ).setOrigin(0.5).setAlpha(0.3);
        this.tweens.add({ targets: startText, alpha: 1, duration: 800, yoyo: true, repeat: -1 });

        const isSmall = W < 1000;
        new BurgerMenu(this, isSmall ? 40 : 60, isSmall ? 40 : 60, [
            { label: lang === 'de' ? 'ZURÜCK' : 'EXIT', color: 0xd32f2f, callback: () => this.scene.start('MainMenuScene') }
        ]);

        this.input.on('pointerdown', (pointer, currentlyOver) => {
            if (currentlyOver.length > 0) return;
            this.scene.start(SCENE_KEYS.MAIN);
        });
    }
}
