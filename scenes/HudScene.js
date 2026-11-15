import Phaser from 'phaser';
import GameMenu, { MENU } from '../game/ui/GameMenu.js';
import ControlSwitcher from '../game/ui/ControlSwitcher.js';
import { heartRow, textStyle, softText, pillImage } from '../game/ui/kit.js';
import { CONTROL_SCHEMES } from '../game/controls/index.js';
import { pwaMenuItems, VERSION_TAG } from '../game/pwa.js';
import { BIOMES } from '../game/level/biomes.js';
import { bandAt } from '../game/level/depthMeters.js';
import { soundMenuItem, musicClock, nowSeconds } from '../game/audio.js';
import { keepInSafeArea, canFullscreen, isFullscreen, toggleFullscreen } from '../game/orientation.js';
import { SCENE_KEYS } from './keys.js';

export const HUD_KEY = `${SCENE_KEYS.MAIN}_Hud`;

export const HUD = {
    coinPop: 1.22,          // the coin count's pop when coins come in, on the next eighth note
    switcherFirstMs: 14000,   // the control-scheme row stays this long on the very first run
    switcherMenuMs: 12000,    // ... and this long when called from the menu
    depthHz: 4,               // how often the depth line may change per second
    rowGap: 28,               // px between the groups of the top line
    coinSlot: 74,             // px kept for the coin count, so the hearts never move as it grows
    bannerAlpha: 0.85,        // announcements never cover the picture fully (spec 5.0j: faint and minimal)
    bar: { alpha: 0.32, padX: 22, padY: 10 },   // one soft glass bar behind coins, hearts and depth
    depthRest: [2500, 0.6]    // the depth line fades to this alpha this many ms after it last changed
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

        const hudText = (x, y, size) => this.add.text(x, y, '', softText(parseInt(size, 10)));
        // One line along the top (user: 'HUD in top line'): menu, coins, hearts, depth and place. The
        // left side of a landscape phone stays free for the picture.
        const rowY = Math.round(this.scale.height * MENU.button * 0.6);
        let rowX = Math.round(this.scale.height * MENU.button * 1.2) + HUD.rowGap;
        const barX = rowX - HUD.bar.padX;
        if (this.textures.exists('coin')) this.add.image(rowX + 26, rowY, 'coin').setDisplaySize(52, 52);
        this.coinText = hudText(rowX + 58, rowY, '42px').setOrigin(0, 0.5);
        rowX += 58 + HUD.coinSlot;
        const heartSize = 40;
        this.hearts = heartRow(this, rowX, rowY, main.maxHealth, heartSize);
        rowX += main.maxHealth * heartSize * 1.08 + HUD.rowGap;
        this.depthText = hudText(rowX, rowY, '30px').setOrigin(0, 0.5);
        // The glass bar: wide enough for the longest depth line, baked once, behind the group.
        const barH = 52 + HUD.bar.padY * 2, barW = rowX - barX + 430;
        pillImage(this, barX + barW / 2, rowY, barW, barH, { fill: 0x02212b, alpha: HUD.bar.alpha, radius: barH / 2 }, null, 'hudbar').setDepth(-1);
        this.quickIcons(rowY);
        this.depthLabel = de ? 'Tiefe' : 'Depth';

        // Chain: a soft counter that names the last move; no timer, it simply fades when the chain ends.
        this.chainText = hudText(Math.round(this.scale.height * MENU.button * 1.2) + HUD.rowGap, rowY + 56, '34px').setAlpha(0);
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
            soundMenuItem(main.lang, () => main.scene.restart()),
            ...pwaMenuItems(this, main.lang),
            { label: de ? 'ZURÜCK' : 'EXIT', color: 0xd32f2f, callback: () => main.scene.start('MainMenuScene') }
        ]);
    }

    /**
     * Quick icons at the top right (user: 'quick menu icons at top of screen: reef book, cycle
     * through steering modes'), and a small fps readout left of them.
     */
    quickIcons(y) {
        const m = this.main, W = this.scale.width, s = Math.round(this.scale.height * MENU.button * 0.9), gap = 14;
        const button = (x, draw, onTap) => {
            const img = pillImage(this, x, y, s, s, { radius: s / 2, alpha: 0.75 }).setInteractive({ useHandCursor: true });
            const face = draw(x);
            img.on('pointerdown', () => { this.tweens.add({ targets: [img, face], scale: '*=0.92', yoyo: true, duration: 70 }); onTap(); });
            return face;
        };
        let x = W - 24 - s / 2;
        // Steering: shows the mode in use; a tap goes to the next one.
        const steerFace = x0 => {
            this.steerIcon = this.add.image(x0, y, '__DEFAULT').setVisible(false);
            this.steerSize = s * 0.6;
            return this.add.text(x0, y, '', textStyle(Math.round(s * 0.26))).setOrigin(0.5);
        };
        this.steerFace = button(x, steerFace, () => {
            const i = CONTROL_SCHEMES.findIndex(c => c.id === m.activeScheme), next = CONTROL_SCHEMES[(i + 1) % CONTROL_SCHEMES.length];
            m.switchScheme(next.id); this.switcher.setActive(next.id); this.showSteer();
        });
        this.showSteer();
        x -= s + gap;
        // The reef book.
        button(x, x0 => this.add.text(x0, y + 2, '📖', { fontSize: `${Math.round(s * 0.5)}px` }).setOrigin(0.5), () => m.openBook());
        // Fullscreen on or off (user: 'add exit fullscreen button to topbar'); only where the browser can do it.
        if (canFullscreen()) {
            x -= s + gap;
            const face = button(x, x0 => this.add.text(x0, y, isFullscreen() ? '⤡' : '⤢', textStyle(Math.round(s * 0.5))).setOrigin(0.5), () => { face.setText(toggleFullscreen() ? '⤡' : '⤢'); });
            const sync = () => face.setText(isFullscreen() ? '⤡' : '⤢');
            document.addEventListener('fullscreenchange', sync);
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('fullscreenchange', sync));
        }
        x -= s / 2 + gap;
        this.fpsText = this.add.text(x, y, '', softText(18)).setOrigin(1, 0.5).setAlpha(0.5);
        this.fpsAt = 0;
    }

    /** The steering icon's face: the name of the mode in use. */
    showSteer() {
        const de = this.main.lang === 'de', c = CONTROL_SCHEMES.find(q => q.id === this.main.activeScheme) || CONTROL_SCHEMES[0];
        const key = `ctrl_${c.id}`, icon = this.textures.exists(key);
        this.steerIcon.setVisible(icon);
        if (icon) this.steerIcon.setTexture(key).setDisplaySize(this.steerSize, this.steerSize);
        this.steerFace.setText(icon ? '' : c.label[de ? 'de' : 'en']);
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
        // A text that changes is painted and sent to the graphics card again: the coin count only when it
        // changes, the depth line at most HUD.depthHz times a second (it cost 17 ms in one jump on a slow phone).
        const coins = m.mp ? m.teamCoins() : m.coins, tick = performance.now();
        if (coins !== this.shownCoins) {
            const more = coins > (this.shownCoins ?? coins);
            this.shownCoins = coins; this.coinText.setText(String(coins));
            // A gain pops the count on the next eighth note (spec 5.0z): the number lands with the music.
            if (more && !this.popping) {
                this.popping = this.time.delayedCall(musicClock.untilGrid(nowSeconds(), 2) * 1000, () => {
                    this.tweens.add({ targets: this.coinText, scale: HUD.coinPop, duration: 90, yoyo: true, ease: 'Quad.easeOut', onComplete: () => { this.popping = null; } });
                });
            }
        }
        if (tick - (this.depthAt || 0) > 1000 / HUD.depthHz) {
            this.depthAt = tick;
            // Where am I (tester: 'it used to say where I am'): the place stays next to the depth.
            // Below the sunlit water the line names the ocean's light zone instead (spec 5.0w).
            const metres = m.depthMeters(), band = bandAt(metres);
            const place = band.from > 0 ? (band.name[m.lang] || band.name.en) : (BIOMES[m.biomeIndex]?.name?.[m.lang] || BIOMES[m.biomeIndex]?.name?.en || '');
            const line = place ? `${this.depthLabel} ${metres} m · ${place}` : `${this.depthLabel} ${metres} m`;
            if (line !== this.shownDepth) { this.shownDepth = line; this.depthText.setText(line); this.depthChanged = tick; }
            this.depthText.setAlpha(tick - (this.depthChanged || 0) > HUD.depthRest[0] ? HUD.depthRest[1] : 1);
        }
        if (m.depthMarkAt && m.depthMarkAt !== this.shownMark) {      // a depth mark was passed: the depth line glows (spec 5.0w)
            this.shownMark = m.depthMarkAt;
            this.tweens.killTweensOf(this.depthText);
            this.depthText.setScale(1).setTint(0xfff3b0);
            this.tweens.add({ targets: this.depthText, scale: 1.12, duration: 260, yoyo: true, ease: 'Sine.easeOut', onComplete: () => this.depthText.clearTint() });
        }
        if (m.health !== this.shownHealth) { this.shownHealth = m.health; this.hearts.set(m.health); }
        if (this.perf) this.updatePerf(m);
        const now = performance.now();
        if (this.fpsText && now - this.fpsAt > 500) { this.fpsAt = now; const q = m.quality, tier = q ? ` · ${q.tier[0].toUpperCase()}${q.auto ? '' : '!'}` : '';
            this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} fps${tier}`); }
    }
}
