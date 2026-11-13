import Phaser from 'phaser';
import BurgerMenu from '@gks/sdk/ui/BurgerMenu.js';
import cardImg from '../assets/card_preview.png';
import MainScene from './MainScene.js';
import EndScene from './EndScene.js';
import HudScene, { HUD_KEY } from './HudScene.js';
import StoryScene, { STORY_KEY, storySeen } from './StoryScene.js';
import { pwaMenuItems, VERSION_TAG } from '../game/pwa.js';
import { CHARACTERS, loadSelectedId, saveSelectedId } from '../game/characters.js';
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
    friend_starfish: 'friend_starfish.png', enemy_angler: 'enemy_angler.png', spikes: 'spikes.png',
    friend_snail: 'friend_snail.png', friend_nudibranch: 'friend_nudibranch.png', coral_3: 'coral_3.png',
    hazard_buoy: 'hazard_buoy.png', hazard_net: 'hazard_net.png', hazard_barrel: 'hazard_barrel.png', hazard_claw: 'hazard_claw.png',
    tex_rock: 'tex_rock.jpg', tex_sand: 'tex_sand.jpg',
    player_shark: 'player_shark.png', player_firefish: 'player_firefish.png', player_flyingfish: 'player_flyingfish.png',
    // Lompi split into body + side fin so the fin can flap (see fins.json for the pivots).
    puffer_normal_body: 'puffer_normal_body.png', puffer_normal_fin: 'puffer_normal_fin.png',
    puffer_inflated_body: 'puffer_inflated_body.png', puffer_inflated_fin: 'puffer_inflated_fin.png'
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
        if (!this.cache.json.exists('fins')) this.load.json('fins', 'img/fins.json');
    }

    create() {
        const W = this.scale.width, H = this.scale.height;
        const lang = this.registry.get('currentLanguage') || 'de';

        if (!this.scene.get(SCENE_KEYS.MAIN)) {
            this.scene.add(SCENE_KEYS.MAIN, MainScene, false);
            this.scene.add(SCENE_KEYS.END, EndScene, false);
            this.scene.add(HUD_KEY, HudScene, false);
            this.scene.add(STORY_KEY, StoryScene, false);
        }

        if (this.textures.exists('bg_far')) {
            this.add.image(W / 2, H / 2, 'bg_far').setDisplaySize(W, H);
        }

        this.add.text(W / 2, H * 0.13, 'Super Lompi Land', {
            fontFamily: 'Arial, sans-serif', fontSize: '128px', color: '#ffffff',
            fontStyle: 'bold', stroke: '#0a5c7a', strokeThickness: 14
        }).setOrigin(0.5);

        this.buildCarousel(lang);

        this.add.text(W - 24, H - 20, VERSION_TAG, {
            fontFamily: 'Arial', fontSize: '22px', color: '#ffffff'
        }).setOrigin(1, 1).setAlpha(0.45);

        new BurgerMenu(this, 60, 60, [
            { label: lang === 'de' ? 'GESCHICHTE ANSEHEN' : 'WATCH THE STORY', color: 0x6d4c41, callback: () => this.scene.start(STORY_KEY) },
            ...pwaMenuItems(this, lang),
            { label: lang === 'de' ? 'ZURÜCK' : 'EXIT', color: 0xd32f2f, callback: () => this.scene.start('MainMenuScene') }
        ]);

    }

    /** Character carousel: swipe, arrows or tap a neighbour to choose; tap the middle one or GO to start. */
    buildCarousel(lang) {
        const W = this.scale.width, H = this.scale.height;
        const cy = H * 0.52, SPACING = 430;
        this.index = Math.max(0, CHARACTERS.findIndex(c => c.id === loadSelectedId()));
        this.slot = this.index; // animated, fractional position

        this.cards = CHARACTERS.map((c, i) => {
            const key = this.textures.exists(c.states.normal.key) ? c.states.normal.key : 'puffer_normal';
            const img = this.add.image(W / 2, cy, key).setInteractive({ useHandCursor: true });
            img.fit = Math.min(360 / img.width, 300 / img.height);
            img.on('pointerup', () => { if (!this.swiped) (i === this.index ? this.start() : this.select(i)); });
            return img;
        });

        this.nameText = this.add.text(W / 2, H * 0.74, '', {
            fontFamily: 'Arial', fontSize: '64px', color: '#ffffff', fontStyle: 'bold', stroke: '#0a5c7a', strokeThickness: 10
        }).setOrigin(0.5);
        this.blurbText = this.add.text(W / 2, H * 0.805, '', {
            fontFamily: 'Arial', fontSize: '34px', color: '#eafcff', stroke: '#0a3f6e', strokeThickness: 6
        }).setOrigin(0.5);
        this.lang = lang;

        const arrow = (x, label, step) => {
            const t = this.add.text(x, cy, label, {
                fontFamily: 'Arial', fontSize: '110px', color: '#ffffff', fontStyle: 'bold', stroke: '#0a5c7a', strokeThickness: 10
            }).setOrigin(0.5).setAlpha(0.85).setInteractive({ useHandCursor: true });
            t.on('pointerdown', () => this.select(this.index + step));
        };
        arrow(110, '‹', -1);
        arrow(W - 110, '›', 1);

        const go = this.add.text(W / 2, H * 0.905, lang === 'de' ? 'Los geht\u2019s!' : 'Let\u2019s go!', {
            fontFamily: 'Arial', fontSize: '52px', color: '#06343a', fontStyle: 'bold',
            backgroundColor: '#ffc266', padding: { x: 54, y: 18 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        go.on('pointerdown', () => this.start());
        this.tweens.add({ targets: go, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Swipe anywhere to turn the carousel.
        this.swiped = false;
        this.input.on('pointerdown', p => { this.swipeX = p.x; this.swiped = false; });
        this.input.on('pointerup', p => {
            const dx = p.x - (this.swipeX ?? p.x);
            if (Math.abs(dx) > 90) { this.swiped = true; this.select(this.index + (dx < 0 ? 1 : -1)); }
        });
        this.input.keyboard?.on('keydown-LEFT', () => this.select(this.index - 1));
        this.input.keyboard?.on('keydown-RIGHT', () => this.select(this.index + 1));
        this.input.keyboard?.on('keydown-ENTER', () => this.start());
        this.input.keyboard?.on('keydown-SPACE', () => this.start());
        this.carousel = { cy, SPACING };
        this.select(this.index);
    }

    select(i) {
        const n = CHARACTERS.length;
        this.index = ((i % n) + n) % n;
        const c = CHARACTERS[this.index];
        saveSelectedId(c.id);
        this.registry.set('character', c.id);
        this.nameText.setText(c.name);
        this.blurbText.setText(c.blurb[this.lang] || c.blurb.en);
    }

    start() {
        // First time: tell the story of the eruption before the journey begins.
        this.scene.start(storySeen() ? SCENE_KEYS.MAIN : STORY_KEY);
    }

    update(time, delta) {
        if (!this.cards) return;
        const W = this.scale.width, n = CHARACTERS.length;
        // Ease the (wrapping) carousel position toward the selected index.
        let d = this.index - this.slot;
        if (d > n / 2) d -= n;
        if (d < -n / 2) d += n;
        this.slot += d * Math.min(1, delta / 110);
        const bob = Math.sin(time / 600) * 12;
        this.cards.forEach((img, i) => {
            let off = i - this.slot;
            off = ((off % n) + n) % n;
            if (off > n / 2) off -= n;
            const near = Math.max(0, 1 - Math.abs(off));
            // Never a frozen sprite: every card breathes, bobs and rocks a little,
            // each with its own rhythm; the chosen one moves the most.
            const ph = i * 1.7, live = 0.45 + near * 0.55;
            const breathe = 1 + Math.sin(time / 520 + ph) * 0.035 * live;
            img.setPosition(W / 2 + off * this.carousel.SPACING + Math.sin(time / 1300 + ph) * 10 * live,
                this.carousel.cy + Math.sin(time / 600 + ph) * 14 * live + (near > 0.5 ? bob * 0.5 : 0));
            img.setScale(img.fit * (0.5 + near * 0.6) * breathe, img.fit * (0.5 + near * 0.6) / breathe);
            img.setRotation(Math.sin(time / 900 + ph) * 0.06 * live);
            img.setAlpha(Math.abs(off) > 2.2 ? 0 : 0.45 + near * 0.55);
            img.setDepth(near > 0.5 ? 2 : 1);
        });
    }
}
