import Phaser from 'phaser';
import { KINDS } from '../game/reefbook.js';
import { BIOMES } from '../game/level/biomes.js';
import { SCENE_KEYS } from './keys.js';
import { play } from '../game/audio.js';

export const BOOK_KEY = `${SCENE_KEYS.MAIN}_Book`;

/** Places have no picture: a round badge in the biome's own rock colours (book cards and toasts). */
export function placeBadge(scene, x, y, r, id, found = true) {
    const b = BIOMES.find(q => q.id === id);
    return scene.add.circle(x, y, r, found ? (b ? b.rock[1] : 0x2b5573) : 0x0a1f30, 1)
        .setStrokeStyle(Math.max(2, r / 12), found ? (b?.rock[0] ?? 0xffffff) : 0x2b5573);
}

const TITLES = {
    creature: { de: 'Tiere', en: 'Creatures' },
    place: { de: 'Orte', en: 'Places' },
    leftover: { de: 'Was Menschen hinterlassen', en: 'What people left behind' }
};
const CARD = { w: 190, h: 190, gap: 18 };

/**
 * The reef book (spec 5.2d): every creature, place and leftover Lompi has seen up
 * close, with one true fact each. Opened from the in-game menu over the paused
 * game; tap a card to read its fact, tap outside or press Esc to close.
 */
export default class ReefBookScene extends Phaser.Scene {
    constructor() { super({ key: BOOK_KEY }); }

    /** @param data { main } the MainScene (owns the book and is paused meanwhile) */
    create({ main }) {
        const W = this.scale.width, H = this.scale.height, lang = main.lang, de = lang === 'de';
        const book = main.reefBook;
        const closeBook = () => { play('tap'); this.scene.stop(); main.scene.resume(); };

        this.add.rectangle(0, 0, W, H, 0x03182c, 0.86).setOrigin(0).setInteractive().on('pointerup', closeBook);
        const panel = this.add.rectangle(W / 2, H / 2, W - 140, H - 110, 0x0d3b5c, 0.96).setStrokeStyle(4, 0x7fd3ff, 0.7)
            .setInteractive();   // taps on the panel do not close the book
        panel.on('pointerup', (p, x, y, e) => e.stopPropagation());

        const { found, total } = book.progress();
        this.add.text(W / 2, 95, de ? 'Riffbuch' : 'Reef Book', {
            fontFamily: 'Arial', fontSize: '58px', color: '#ffffff', fontStyle: 'bold', stroke: '#0a3f6e', strokeThickness: 10
        }).setOrigin(0.5);
        this.add.text(W / 2, 145, `${found} / ${total}`, { fontFamily: 'Arial', fontSize: '30px', color: '#fff3b0', fontStyle: 'bold' }).setOrigin(0.5);

        const fact = this.add.text(W / 2, H - 100, de ? 'Tippe auf eine Karte.' : 'Tap a card.', {
            fontFamily: 'Arial', fontSize: '30px', color: '#eafcff', align: 'center', wordWrap: { width: W - 260 }
        }).setOrigin(0.5);

        let y = 190;
        for (const kind of KINDS) {
            const items = book.entries(kind);
            this.add.text(110, y, TITLES[kind][lang] || TITLES[kind].en, { fontFamily: 'Arial', fontSize: '30px', color: '#7fd3ff', fontStyle: 'bold' });
            y += 44;
            const perRow = Math.floor((W - 220) / (CARD.w + CARD.gap));
            items.forEach((e, i) => {
                const cx = 110 + (i % perRow) * (CARD.w + CARD.gap) + CARD.w / 2;
                const cy = y + Math.floor(i / perRow) * (CARD.h + CARD.gap) + CARD.h / 2;
                this.card(e, cx, cy, lang, fact);
            });
            y += Math.ceil(items.length / perRow) * (CARD.h + CARD.gap) + 14;
        }

        const close = this.add.text(W - 110, 95, '✕', { fontFamily: 'Arial', fontSize: '56px', color: '#ffffff', fontStyle: 'bold' })
            .setOrigin(0.5).setInteractive({ useHandCursor: true });
        close.on('pointerup', closeBook);
        this.input.keyboard?.once('keydown-ESC', closeBook);
    }

    card(e, cx, cy, lang, fact) {
        const bg = this.add.rectangle(cx, cy, CARD.w, CARD.h, e.found ? 0x1d6f9a : 0x163248, 1)
            .setStrokeStyle(3, e.found ? 0xfff3b0 : 0x2b5573, e.found ? 0.9 : 0.6)
            .setInteractive({ useHandCursor: e.found });
        const name = e.found ? (e.name[lang] || e.name.en) : '?';
        if (e.image && this.textures.exists(e.image)) {
            const img = this.add.image(cx, cy - 18, e.image);
            img.setScale(Math.min(140 / img.width, 110 / img.height));
            if (!e.found) {                                           // a silhouette until found
                // Phaser 4 has no setTintFill: there the fill is a tint mode.
                if (Phaser.TintModes) img.setTint(0x0a1f30).setTintMode(Phaser.TintModes.FILL); else img.setTintFill(0x0a1f30);
                img.setAlpha(0.8);
            }
        } else {
            placeBadge(this, cx, cy - 18, 46, e.id, e.found);
        }
        this.add.text(cx, cy + 66, name, { fontFamily: 'Arial', fontSize: '19px', color: e.found ? '#ffffff' : '#7a93a8', fontStyle: 'bold', align: 'center', wordWrap: { width: CARD.w - 14 } }).setOrigin(0.5);
        if (e.found) {
            bg.on('pointerup', (p, x, y, ev) => {
                ev.stopPropagation();
                play('tap');
                fact.setText(`${e.name[lang] || e.name.en}: ${e.fact[lang] || e.fact.en}`);
            });
        } else {
            bg.on('pointerup', (p, x, y, ev) => ev.stopPropagation());
        }
    }
}
