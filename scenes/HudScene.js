import Phaser from 'phaser';
import GameMenu, { MENU } from '../game/ui/GameMenu.js';
import ControlSwitcher from '../game/ui/ControlSwitcher.js';
import { heartRow, textStyle } from '../game/ui/kit.js';
import { pwaMenuItems, VERSION_TAG } from '../game/pwa.js';
import { BIOMES } from '../game/level/biomes.js';
import { feedbackMenuItems } from '../game/feedback.js';
import { soundMenuItem } from '../game/audio.js';
import { keepInSafeArea } from '../game/orientation.js';
import { SCENE_KEYS } from './keys.js';

export const HUD_KEY = `${SCENE_KEYS.MAIN}_Hud`;

export const HUD = {
    switcherFirstMs: 14000,   // the control-scheme row stays this long on the very first run
    switcherMenuMs: 12000,    // ... and this long when called from the menu
    bannerAlpha: 0.85         // announcements never cover the picture fully (spec 5.0j: faint and minimal)
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
            ? { leap: 'Sprung', landing: 'Landung', skim: 'Wellenhüpfer', flip: 'Salto', special: 'Spezial', stream: 'Strömung', trail: 'Melodie', cannon: 'Blubberkanone', pad: 'Hüpfkissen', arch: 'Felsentor', ring: 'Blasenring' }
            : { leap: 'Jump', landing: 'Landing', skim: 'Wave skip', flip: 'Flip', special: 'Special', stream: 'Current', trail: 'Melody', cannon: 'Bubble cannon', pad: 'Bounce pad', arch: 'Sea arch', ring: 'Bubble ring' };
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
            fontFamily: 'Arial', fontSize: '76px', color: '#ffffff', stroke: '#06243d', strokeThickness: 3, shadow: { offsetY: 3, color: '#031a2c', blur: 16, fill: true }
        }).setOrigin(0.5).setAlpha(0);
        this.bannerSub = this.add.text(W / 2, H * 0.2 + 70, '', {
            fontFamily: 'Arial', fontSize: '44px', color: '#fff3b0', stroke: '#06243d', strokeThickness: 3, shadow: { offsetY: 3, color: '#031a2c', blur: 14, fill: true }
        }).setOrigin(0.5).setAlpha(0);

        new GameMenu(this, this.scale.height * MENU.button * 0.6, this.scale.height * MENU.button * 0.6, [
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
        if (m.health !== this.shownHealth) { this.shownHealth = m.health; this.hearts.set(m.health); }
        if (this.perf) this.updatePerf(m);
    }
}
