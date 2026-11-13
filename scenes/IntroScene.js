import Phaser from 'phaser';
import BurgerMenu from '@gks/sdk/ui/BurgerMenu.js';
import cardImg from '../assets/card_preview.png';
import MainScene from './MainScene.js';
import EndScene from './EndScene.js';
import { pwaMenuItems, BUILD } from '../game/pwa.js';
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

// Generated art in public/img — loaded by relative URL so any deploy base works.
const IMAGES = {
    puffer_normal: 'puffer_normal.png', puffer_inflated: 'puffer_inflated.png',
    coin: 'coin.png', bubble: 'bubble.png', mine: 'mine.png', urchin: 'urchin.png',
    coral_1: 'coral_1.png', coral_2: 'coral_2.png', rock_1: 'rock_1.png', bg_far: 'bg_far.jpg',
    friend_turtle: 'friend_turtle.png', friend_clownfish: 'friend_clownfish.png',
    friend_jellyfish: 'friend_jellyfish.png', friend_seahorse: 'friend_seahorse.png',
    friend_starfish: 'friend_starfish.png', enemy_angler: 'enemy_angler.png', spikes: 'spikes.png'
};

export default class IntroScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENE_KEYS.INTRO });
    }

    preload() {
        const W = this.scale.width, H = this.scale.height;
        this.cameras.main.setBackgroundColor(0x0a3f6e);
        const bar = this.add.rectangle(W / 2 - 300, H / 2, 4, 18, 0xffc266).setOrigin(0, 0.5);
        this.load.on('progress', p => { bar.width = 600 * p; });
        this.load.on('complete', () => bar.destroy());
        // A missing file is fine: every texture has a procedural fallback.
        for (const [key, file] of Object.entries(IMAGES)) {
            if (!this.textures.exists(key)) this.load.image(key, `img/${file}`);
        }
    }

    create() {
        const W = this.scale.width, H = this.scale.height;
        const lang = this.registry.get('currentLanguage') || 'de';

        if (!this.scene.get(SCENE_KEYS.MAIN)) {
            this.scene.add(SCENE_KEYS.MAIN, MainScene, false);
            this.scene.add(SCENE_KEYS.END, EndScene, false);
        }

        if (this.textures.exists('bg_far')) {
            this.add.image(W / 2, H / 2, 'bg_far').setDisplaySize(W, H);
        }

        this.add.text(W / 2, H * 0.2, 'Super Lompi Land', {
            fontFamily: 'Arial, sans-serif', fontSize: '128px', color: '#ffffff',
            fontStyle: 'bold', stroke: '#0a5c7a', strokeThickness: 14
        }).setOrigin(0.5);

        if (this.textures.exists('puffer_inflated')) {
            const fish = this.add.image(W / 2, H * 0.62, 'puffer_inflated').setScale(0.85);
            this.tweens.add({ targets: fish, y: fish.y - 28, angle: 4, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }

        const startText = this.add.text(W / 2, H * 0.9,
            lang === 'de' ? 'Tippen zum Starten' : 'Tap to Start',
            { fontFamily: 'Arial, sans-serif', fontSize: '52px', color: '#ffffff', fontStyle: 'bold' }
        ).setOrigin(0.5).setAlpha(0.35);
        this.tweens.add({ targets: startText, alpha: 1, duration: 800, yoyo: true, repeat: -1 });

        this.add.text(W - 24, H - 20, `build ${BUILD}`, {
            fontFamily: 'Arial', fontSize: '22px', color: '#ffffff'
        }).setOrigin(1, 1).setAlpha(0.45);

        new BurgerMenu(this, 60, 60, [
            ...pwaMenuItems(this, lang),
            { label: lang === 'de' ? 'ZURÜCK' : 'EXIT', color: 0xd32f2f, callback: () => this.scene.start('MainMenuScene') }
        ]);

        this.input.on('pointerdown', (pointer, currentlyOver) => {
            if (currentlyOver.length > 0) return;
            this.scene.start(SCENE_KEYS.MAIN);
        });
    }
}
