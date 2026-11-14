import Phaser from 'phaser';
import { SCENE_KEYS } from './keys.js';
import { play } from '../game/audio.js';

export const STYLE_KEY = `${SCENE_KEYS.MAIN}_Style`;

const TEXT = {
    title: { de: 'Wie möchtest du spielen?', en: 'How do you want to play?' },
    hint: { de: 'Du kannst das jederzeit im Menü ändern.', en: 'You can change this any time in the menu.' },
    relaxed: {
        name: { de: 'Gemütlich', en: 'Relaxed' },
        line: { de: 'Keine Herzen verlieren.\nIn Ruhe entdecken.', en: 'No hearts to lose.\nExplore at your own pace.' }
    },
    adventure: {
        name: { de: 'Abenteuer', en: 'Adventure' },
        line: { de: 'Mit Herzen, Ketten-Bonus\nund kniffligen Stellen.', en: 'Hearts, chain bonuses\nand tricky spots.' }
    }
};

/**
 * The play-style choice (spec 1.4, optional stress): asked once, at the first nest,
 * over the paused game. Relaxed = no damage and no chain counter; Adventure = the full
 * game. Both are the same world; the menu switch stays available.
 */
export default class PlayStyleScene extends Phaser.Scene {
    constructor() { super({ key: STYLE_KEY }); }

    /** @param data { main } the paused MainScene */
    create({ main }) {
        const W = this.scale.width, H = this.scale.height, lang = main.lang === 'de' ? 'de' : 'en';
        this.add.rectangle(0, 0, W, H, 0x03182c, 0.8).setOrigin(0).setInteractive();
        this.add.text(W / 2, H * 0.2, TEXT.title[lang], {
            fontFamily: 'Arial', fontSize: '56px', color: '#ffffff', fontStyle: 'bold', stroke: '#0a3f6e', strokeThickness: 10
        }).setOrigin(0.5);
        this.add.text(W / 2, H * 0.86, TEXT.hint[lang], { fontFamily: 'Arial', fontSize: '28px', color: '#bfe9ff' }).setOrigin(0.5);

        const choose = relaxed => {
            play('tap');
            this.scene.stop();
            if (relaxed !== main.relaxed) main.setRelaxed(relaxed);   // restarts at this nest
            else main.scene.resume();
        };
        this.option(W / 2 - 290, H * 0.53, TEXT.relaxed, lang, 0x2f8f6a, () => choose(true));
        this.option(W / 2 + 290, H * 0.53, TEXT.adventure, lang, 0xc2603a, () => choose(false));
    }

    option(x, y, t, lang, color, onPick) {
        const card = this.add.rectangle(x, y, 500, 300, color, 0.95).setStrokeStyle(5, 0xffffff, 0.85)
            .setInteractive({ useHandCursor: true });
        this.add.text(x, y - 70, t.name[lang], { fontFamily: 'Arial', fontSize: '50px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.add.text(x, y + 40, t.line[lang], { fontFamily: 'Arial', fontSize: '30px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
        card.on('pointerover', () => card.setScale(1.04)).on('pointerout', () => card.setScale(1));
        card.on('pointerup', onPick);
    }
}
