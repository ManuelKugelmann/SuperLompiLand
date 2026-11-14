import Phaser from 'phaser';
import BurgerMenu from '@gks/sdk/ui/BurgerMenu.js';
import ControlSwitcher from '../game/ui/ControlSwitcher.js';
import { heartRow, textStyle } from '../game/ui/kit.js';
import { pwaMenuItems, VERSION_TAG } from '../game/pwa.js';
import { BIOMES, WORLD_WEST, WORLD_END, ABYSS } from '../game/level/biomes.js';
import { feedbackMenuItems } from '../game/feedback.js';
import { soundMenuItem } from '../game/audio.js';
import { keepInSafeArea } from '../game/orientation.js';
import { SCENE_KEYS } from './keys.js';

export const HUD_KEY = `${SCENE_KEYS.MAIN}_Hud`;

export const HUD = {
    switcherFirstMs: 14000,   // the control-scheme row stays this long on the very first run
    switcherMenuMs: 12000,    // ... and this long when called from the menu
    bannerAlpha: 0.85,        // announcements never cover the picture fully (spec 5.0j: faint and minimal)
    mapRest: 0.3,             // the journey strip is the map (no minimap): faint at rest ...
    mapShown: 0.9,            // ... clear for a while when something on it changes
    mapShowMs: 3500
};

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
        keepInSafeArea(this);     // the picture fills the whole screen; the HUD stays clear of notch and corners
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
        // The row is clutter over the best part of the picture: it shows on the very first run for
        // a while, and whenever it is called from the menu; picking a scheme puts it away again.
        const showSwitcher = ms => {
            this.switcher.setVisible(true);
            this.switcherTimer?.remove();
            this.switcherTimer = this.time.delayedCall(ms, () => this.switcher.setVisible(false));
        };
        if (main.progression.get?.('controls_shown', false)) this.switcher.setVisible(false);
        else { main.progression.set?.('controls_shown', true); showSwitcher(HUD.switcherFirstMs); }

        const hudText = (x, y, size) => this.add.text(x, y, '', textStyle(parseInt(size, 10)));
        if (this.textures.exists('coin')) this.add.image(70, 190, 'coin').setDisplaySize(64, 64);
        this.coinText = hudText(116, 162, '50px');
        this.depthText = hudText(40, 232, '34px');
        this.depthLabel = de ? 'Tiefe' : 'Depth';

        // Chain: a soft counter that names the last move; no timer, it simply fades when the chain ends.
        this.chainText = hudText(40, 356, '38px').setAlpha(0);
        const moves = de
            ? { leap: 'Sprung', landing: 'Landung', skim: 'Wellenhüpfer', flip: 'Salto', special: 'Spezial', stream: 'Strömung', trail: 'Melodie', cannon: 'Blubberkanone', pad: 'Hüpfkissen', arch: 'Felsentor' }
            : { leap: 'Jump', landing: 'Landing', skim: 'Wave skip', flip: 'Flip', special: 'Special', stream: 'Current', trail: 'Melody', cannon: 'Bubble cannon', pad: 'Bounce pad', arch: 'Sea arch' };
        const onMove = ({ count, verb, flow }) => {
            this.tweens.killTweensOf(this.chainText);
            this.chainText.setText(count > 1 ? `${count} · ${moves[verb]}` : moves[verb]).setColor(flow ? '#ffd54a' : '#ffffff').setAlpha(1).setScale(1.25);
            this.tweens.add({ targets: this.chainText, scale: 1, duration: 220, ease: 'Back.easeOut' });
        };
        const onEnd = () => this.tweens.add({ targets: this.chainText, alpha: 0, duration: 600 });
        main.events.on('chain-move', onMove);
        main.events.on('chain-end', onEnd);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { main.events.off('chain-move', onMove); main.events.off('chain-end', onEnd); });

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
        // The friends waiting along the way: a ring where each one is, filled once it is freed.
        this.friendDots = main.journey.list.filter(c => c.friend).map(c => {
            const dot = this.add.circle(toMap(c.x), this.mapY + 24, 8, 0xff6b9a, 0).setStrokeStyle(3, 0xffffff);
            dot.friendId = c.friend.id;
            return dot;
        });
        this.mapYou = this.add.triangle(0, this.mapY - 20, -9, -10, 9, -10, 0, 6, 0xffffff).setStrokeStyle(2, 0x06343a);
        this.map = this.add.container(0, 0, [mg, ...this.nestDots, ...this.friendDots, this.mapYou]).setAlpha(HUD.mapRest);
        this.mapState = '';

        // ?debug=perf: frame time and where it goes, for checking on a real device.
        if (new URLSearchParams(window.location.search).get('debug') === 'perf') {
            this.perf = this.add.text(this.scale.width - 20, 200, '', {
                fontFamily: 'monospace', fontSize: '24px', color: '#b6ffb0', backgroundColor: '#00000099', padding: { x: 10, y: 8 }, align: 'right'
            }).setOrigin(1, 0);
            this.perfAt = 0;
        }

        // Banner line for announcements (biome names, nest reached, ...): faint and minimal (spec 5.0j),
        // light text with a soft shadow, no outline, never fully opaque.
        const W = this.scale.width, H = this.scale.height;
        this.bannerTitle = this.add.text(W / 2, H * 0.2, '', {
            fontFamily: 'Arial', fontSize: '60px', color: '#ffffff', shadow: { offsetY: 2, color: '#06243d', blur: 12, fill: true }
        }).setOrigin(0.5).setAlpha(0);
        this.bannerSub = this.add.text(W / 2, H * 0.2 + 56, '', {
            fontFamily: 'Arial', fontSize: '28px', color: '#fff3b0', shadow: { offsetY: 2, color: '#06243d', blur: 10, fill: true }
        }).setOrigin(0.5).setAlpha(0);

        new BurgerMenu(this, 60, 60, [
            { label: de ? 'ENDE' : 'END', color: 0x2e7d32, callback: () => main.finish() },
            { label: de ? 'RIFFBUCH' : 'REEF BOOK', color: 0x1d6f9a, callback: () => main.openBook() },
            { label: de ? 'STEUERUNG' : 'CONTROLS', color: 0x1d6f9a, callback: () => showSwitcher(HUD.switcherMenuMs) },
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

    showMap() {
        this.tweens.killTweensOf(this.map);
        this.tweens.add({ targets: this.map, alpha: HUD.mapShown, duration: 400 });
        this.tweens.add({ targets: this.map, alpha: HUD.mapRest, duration: 1200, delay: HUD.mapShowMs });
    }

    banner(title, subtitle = '') {
        const targets = [this.bannerTitle, this.bannerSub];
        this.tweens.killTweensOf(targets);
        this.bannerTitle.setText(title).setAlpha(0);
        this.bannerSub.setText(subtitle).setAlpha(0);
        this.tweens.add({ targets: this.bannerTitle, alpha: HUD.bannerAlpha, duration: 500 });
        this.tweens.add({ targets: this.bannerSub, alpha: HUD.bannerAlpha, duration: 500, delay: 150 });
        this.tweens.add({ targets, alpha: 0, duration: 900, delay: 2200 });
    }

    update() {
        const m = this.main;
        if (!m?.fish) return;
        // Playing together the counter is the team's: everything the room has collected.
        this.coinText.setText(String(m.mp ? m.teamCoins() : m.coins));
        this.depthText.setText(`${this.depthLabel} ${m.depthMeters()} m`);
        this.mapYou.x = this.toMap(m.fish.sprite.x);
        // Playing together: every friend is a dot in their colour on the journey strip.
        for (const g of m.mp?.ghosts.values() ?? []) {
            if (!g.mapDot) {
                g.mapDot = this.add.circle(0, this.mapY + 20, 8, g.color ?? 0xffffff, 1).setStrokeStyle(3, 0xffffff);
                this.map.add(g.mapDot);
            }
            g.mapDot.setVisible(!!g.pos);
            if (g.pos) g.mapDot.x = this.toMap(g.pos.x);
        }
        this.nestDots.forEach((d, i) => { if (!m.level.nests[i].grand) d.setFillStyle(i <= m.nestIndex && (i > 0 || m.banked > 0 || m.nestIndex > 0) ? 0xffd23f : 0xffffff, i <= m.nestIndex ? 1 : 0.5); });
        for (const d of this.friendDots) d.setFillStyle(0xff6b9a, m.journey.has(d.friendId) ? 1 : 0);
        // The strip lights up when the biome, the nest or the freed friends change, then fades back.
        const state = `${m.biomeIndex}/${m.nestIndex}/${this.friendDots.filter(d => m.journey.has(d.friendId)).length}`;
        if (state !== this.mapState) { if (this.mapState) this.showMap(); this.mapState = state; }
        if (m.health !== this.shownHealth) { this.shownHealth = m.health; this.hearts.set(m.health); }
        if (this.perf) this.updatePerf(m);
    }
}
