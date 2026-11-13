import Phaser from 'phaser';
import BurgerMenu from '@gks/sdk/ui/BurgerMenu.js';
import ControlSwitcher from '../game/ui/ControlSwitcher.js';
import { heartRow, textStyle } from '../game/ui/kit.js';
import { pwaMenuItems, VERSION_TAG } from '../game/pwa.js';
import { BIOMES, WORLD_WEST, WORLD_END, ABYSS } from '../game/level/biomes.js';
import { feedbackMenuItems } from '../game/feedback.js';
import { soundMenuItem } from '../game/audio.js';
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

        const hudText = (x, y, size) => this.add.text(x, y, '', textStyle(parseInt(size, 10)));
        if (this.textures.exists('coin')) this.add.image(70, 190, 'coin').setDisplaySize(64, 64);
        this.coinText = hudText(116, 162, '50px');
        this.depthText = hudText(40, 232, '34px');
        this.depthLabel = de ? 'Tiefe' : 'Depth';

        // Health: a row of hearts (readable at a glance, half hearts for sturdy characters).
        this.hearts = heartRow(this, 36, 300, main.maxHealth);

        this.add.text(this.scale.width - 16, this.scale.height - 12, VERSION_TAG, {
            fontFamily: 'Arial', fontSize: '20px', color: '#ffffff'
        }).setOrigin(1, 1).setAlpha(0.4);

        // Journey strip: the whole trip west -> east at a glance. Biome colours,
        // nests as dots, the grand nest as a star, the abyss as a notch, you as the arrow.
        this.mapX = this.scale.width - 560; this.mapW = 520; this.mapY = 132;
        const toMap = x => this.mapX + Phaser.Math.Clamp((x - WORLD_WEST) / (WORLD_END - WORLD_WEST), 0, 1) * this.mapW;
        this.toMap = toMap;
        const mg = this.add.graphics();
        mg.fillStyle(0x06343a, 0.55).fillRoundedRect(this.mapX - 10, this.mapY - 16, this.mapW + 20, 32, 14);
        BIOMES.forEach(b => {
            const x0 = toMap(b.from), x1 = toMap(b.from + b.width);
            mg.fillStyle(b.rock[1], 1).fillRect(x0, this.mapY - 7, Math.max(2, x1 - x0 - 2), 14);
        });
        mg.fillStyle(0x0a1436, 1).fillTriangle(toMap(ABYSS.x) - 7, this.mapY + 7, toMap(ABYSS.x) + 7, this.mapY + 7, toMap(ABYSS.x), this.mapY + 20);
        this.nestDots = main.level.nests.map(n => n.grand
            ? this.add.star(toMap(n.x), this.mapY, 5, 6, 13, 0xfff3b0).setStrokeStyle(2, 0x6b4a2b)
            : this.add.circle(toMap(n.x), this.mapY, 6, 0xffffff, 0.5).setStrokeStyle(2, 0x06343a));
        this.mapYou = this.add.triangle(0, this.mapY - 20, -9, -10, 9, -10, 0, 6, 0xffffff).setStrokeStyle(2, 0x06343a);

        // ?debug=perf: frame time and where it goes, for checking on a real device.
        if (new URLSearchParams(window.location.search).get('debug') === 'perf') {
            this.perf = this.add.text(this.scale.width - 20, 200, '', {
                fontFamily: 'monospace', fontSize: '24px', color: '#b6ffb0', backgroundColor: '#00000099', padding: { x: 10, y: 8 }, align: 'right'
            }).setOrigin(1, 0);
            this.perfAt = 0;
        }

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
            main.relaxed
                ? { label: de ? 'MODUS: ENTSPANNT' : 'MODE: RELAXED', color: 0x00897b, callback: () => main.setRelaxed(false) }
                : { label: de ? 'MODUS: ABENTEUER' : 'MODE: ADVENTURE', color: 0xc62828, callback: () => main.setRelaxed(true) },
            ...feedbackMenuItems(main.lang, () => ({
                biome: BIOMES[main.biomeIndex]?.id, x: Math.round(main.fish.sprite.x), depth: main.depthMeters(),
                character: main.character.id, controls: main.activeScheme, mode: main.relaxed ? 'relaxed' : 'adventure'
            })),
            soundMenuItem(main.lang, () => main.scene.restart()),
            ...pwaMenuItems(this, main.lang),
            { label: de ? 'ZURÜCK' : 'EXIT', color: 0xd32f2f, callback: () => main.scene.start('MainMenuScene') }
        ]);
    }

    updatePerf(m) {
        const now = performance.now();
        if (now - this.perfAt < 500) return;
        this.perfAt = now;
        const loop = this.game.loop, p = m.perf;
        const avg = a => (a.n ? (a.sum / a.n).toFixed(1) : '-');
        this.perf.setText([
            `fps ${Math.round(loop.actualFps)}   frame ${loop.delta.toFixed(1)} ms`,
            `physics ${avg(p.physics)} ms  (max ${p.physics.max.toFixed(1)})`,
            `world+fx ${avg(p.world)} ms  (max ${p.world.max.toFixed(1)})`,
            `chunk build ${m.level.buildMs.last.toFixed(1)} ms  (max ${m.level.buildMs.max.toFixed(1)}, n ${m.level.buildMs.count})`,
            `chunks ${m.level.chunks.size}  bodies ${m.matter.world.localWorld.bodies.length}`,
            `objects ${m.children.list.length}  tweens ${m.tweens.getTweens().length}`,
            `dpr ${window.devicePixelRatio}  ${this.game.renderer.type === 2 ? 'webgl' : 'canvas'}`
        ].join('\n'));
        for (const k of ['physics', 'world']) { p[k].sum = 0; p[k].n = 0; p[k].max = 0; }
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
        // Playing together the counter is the team's: everything the room has collected.
        this.coinText.setText(String(m.mp ? m.teamCoins() : m.coins));
        this.depthText.setText(`${this.depthLabel} ${m.depthMeters()} m`);
        this.mapYou.x = this.toMap(m.fish.sprite.x);
        this.nestDots.forEach((d, i) => { if (!m.level.nests[i].grand) d.setFillStyle(i <= m.nestIndex && (i > 0 || m.banked > 0 || m.nestIndex > 0) ? 0xffd23f : 0xffffff, i <= m.nestIndex ? 1 : 0.5); });
        if (m.health !== this.shownHealth) { this.shownHealth = m.health; this.hearts.set(m.health); }
        if (this.perf) this.updatePerf(m);
    }
}
