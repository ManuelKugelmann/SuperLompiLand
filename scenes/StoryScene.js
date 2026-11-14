import { getCharacter, loadSelectedId } from '../game/characters.js';
import { createTimeline } from '../game/timeline.js';
import Phaser from 'phaser';
import { play } from '../game/audio.js';
import { SCENE_KEYS } from './keys.js';
import { fitToWindow } from '../game/orientation.js';

export const STORY_KEY = `${SCENE_KEYS.MAIN}_Story`;
const SEEN_KEY = 'sll_seen_intro';

/** Painted stage (img/story, loaded by the title screen): the backdrop and where things are in it (shares of its size). */
export const STORY_ART = {
    back: { key: 'story_back', file: 'img/story/back.jpg', size: [1920, 1084], sea: 0.449, craters: [[0.75, 0.126], [0.706, 0.81]], sand: 0.82 },
    ash: { key: 'story_ash', file: 'img/story/ash.webp' },
    cover: [['micro_shells_0', 0.1, 0.75], ['micro_tufts_1', 0.24, 0.8], ['micro_pebbles_2', 0.43, 0.7], ['micro_rubble_0', 0.55, 0.75]]
};

export function storySeen() {
    try { return window.localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
}

/** What each beat says, in a few big words (spec, "Story captions"); {name} = the chosen character's name. */
const CAPTIONS = [
    { de: 'Ein ruhiger Morgen im Riff', en: 'A calm morning on the reef' },
    { de: 'Was grollt da?', en: "What's that rumble?" },
    { de: 'Der Vulkan bricht aus!', en: 'The volcano erupts!' },
    { de: 'Alle Freunde schwimmen weg!', en: 'All the friends swim away!' },
    { de: '{name} hat keine Angst.', en: "{name} isn't scared." },
    { de: 'Finde deine Freunde!', en: 'Find your friends!' }
];

/**
 * Opening story, about ten seconds, with a caption of a few big words per beat:
 *   1 calm reef  2 the ground rumbles  3 the volcano erupts, above and under
 *   water  4 dark things sink out of the ash, the friends scatter  5 Lompi
 *   looks east and puffs up  6 the water clears; a red glow stays in the east.
 * A tap goes on to the next beat; the button in the corner (or Escape) skips to the end.
 * Shown once on a fresh save; replayable from the title menu.
 */
export default class StoryScene extends Phaser.Scene {
    constructor() {
        super({ key: STORY_KEY });
    }

    create() {
        fitToWindow(this.game);     // the picture fills the screen, whatever its shape
        const W = this.scale.width, H = this.scale.height;
        const has = k => this.textures.exists(k);
        this.done = false;
        this.painted = has(STORY_ART.back.key);
        if (this.painted) this.paintedStage(W, H, has); else this.drawnStage(W, H, has);

        // Cast.
        this.lompi = this.add.image(W * 0.33, H * 0.6, has('puffer_normal') ? 'puffer_normal' : 'coin').setScale(0.55);
        this.friends = [['friend_turtle', 0.18, 0.47, 0.42], ['friend_seahorse', 0.12, 0.72, 0.3],
            ['friend_starfish', 0.36, 0.86, 0.3]].filter(([k]) => has(k))
            .map(([k, fx, fy, sc]) => this.add.image(W * fx, H * fy, k).setScale(sc));
        [this.lompi, ...this.friends].forEach((o, i) => this.tweens.add({
            targets: o, y: o.y - 16, duration: 1200 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        }));

        this.glow = this.add.ellipse(W + 80, H * 0.5, 620, H * 1.5, 0xff3b1f, 0).setBlendMode(Phaser.BlendModes.ADD);
        this.flash = this.add.rectangle(0, 0, W, H, 0xff4a1a, 0).setOrigin(0).setDepth(50);

        // --- Beats ---------------------------------------------------------
        // They play by themselves; a tap goes on to the next beat at once (one tap, one beat). Only
        // the small button in the corner leaves the story.
        this.timeline = createTimeline([
            { at: 1500, run: () => { this.say(1); this.cameras.main.shake(1400, 0.006); play('rumble'); } },                    // 2 rumble
            { at: 1900, run: () => this.friends.forEach(f => this.tweens.add({ targets: f, angle: -10, duration: 300, yoyo: true })) },
            { at: 3000, run: () => { this.say(2); this.erupt(); } },                                             // 3 eruption
            { at: 4500, run: () => { this.say(3); this.fallout(); } },                                           // 4 dark things, friends scatter
            { at: 6000, run: () => { this.say(4); this.resolve(); } },                                           // 5 Lompi puffs up
            { at: 7600, run: () => { this.say(5); this.tweens.add({ targets: this.glow, alpha: 0.4, duration: 500 }); } },  // 6 the glow stays
            { at: 9600, run: () => this.finish() }
        ]);
        const de = (this.registry.get('currentLanguage') || 'de') === 'de';
        // A few big words per beat, for children who read and those who are read to.
        this.caption = this.add.text(W / 2, H * 0.1, '', {
            fontFamily: 'Arial, sans-serif', fontSize: '76px', fontStyle: 'bold', color: '#ffffff', stroke: '#0a3f6e', strokeThickness: 12, align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(60).setShadow(0, 5, 'rgba(4,30,52,0.6)', 12, true, true);
        const name = getCharacter(this.registry.get('character') || loadSelectedId())?.name || 'Lompi';
        this.lines = CAPTIONS.map(l => l[de ? 'de' : 'en'].replace('{name}', name));
        this.say(0);
        const skip = this.add.text(W - 32, H - 28, de ? 'Überspringen  ›' : 'Skip  ›', {
            fontFamily: 'Arial', fontSize: '42px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0a3f6ecc', padding: { x: 26, y: 14 }
        }).setOrigin(1, 1).setScrollFactor(0).setDepth(60).setInteractive({ useHandCursor: true });
        skip.on('pointerdown', (p, x, y, ev) => { ev?.stopPropagation(); this.skipped = true; this.finish(); });
        this.skipped = false;
        this.input.on('pointerdown', () => { if (!this.skipped && !this.done) this.timeline.next(); });
        this.input.keyboard?.on('keydown', e => { if (this.done) return; if (e.key === 'Escape') this.finish(); else this.timeline.next(); });
    }

    update(time, delta) {
        if (!this.done) this.timeline.step(delta);
    }

    /** Show the caption of a beat: the old one fades, the new one pops in. */
    say(i) {
        const c = this.caption;
        this.tweens.killTweensOf(c);
        c.setText(this.lines[i]).setAlpha(0).setScale(0.85);
        this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    }

    /** The painted stage: one picture of the volcano island above and below the water, cover on the sand, corals. */
    paintedStage(W, H, has) {
        const B = STORY_ART.back, k = Math.max(W / B.size[0], H / B.size[1]);
        const ox = (W - B.size[0] * k) / 2, at = (u, v) => ({ x: ox + u * B.size[0] * k, y: v * B.size[1] * k });
        this.add.image(ox, 0, B.key).setOrigin(0).setScale(k);
        const sea = at(0, B.sea).y;
        this.sunset = this.add.rectangle(0, 0, W, sea, 0xff5a2a, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
        this.craters = B.craters.map(([u, v]) => at(u, v));
        const sand = at(0, B.sand).y;
        for (const [key, u, sc] of STORY_ART.cover) if (has(key)) this.add.image(W * u, sand + 30, key).setOrigin(0.5, 0.85).setScale(sc);
        [['coral_1', 0.12, 0.5], ['coral_2', 0.3, 0.42], ['coral_3', 0.47, 0.36]].forEach(([key, u, sc]) => {
            if (has(key)) this.add.image(W * u, sand + 40, key).setOrigin(0.5, 1).setScale(sc);
        });
    }

    /** Drawn fallback stage (no art files). */
    drawnStage(W, H, has) {
        const SEA = 330;        // waterline
        this.add.rectangle(0, 0, W, SEA, 0xcdeffb).setOrigin(0);
        this.sunset = this.add.rectangle(0, 0, W, SEA, 0xff5a2a, 0).setOrigin(0);
        this.add.rectangle(0, SEA, W, H - SEA, 0x2aa7c9).setOrigin(0);
        this.add.rectangle(0, SEA + (H - SEA) * 0.5, W, (H - SEA) * 0.5, 0x146f9c, 0.6).setOrigin(0);
        this.add.rectangle(0, SEA - 4, W, 10, 0xffffff, 0.8).setOrigin(0);

        // Island volcano in the east + its underwater flank and a second, submarine cone.
        const vx = W * 0.8;
        const rock = this.add.graphics();
        rock.fillStyle(0x4a3f45, 1).fillTriangle(vx - 330, SEA, vx + 330, SEA, vx, SEA - 250);
        rock.fillStyle(0x3a3138, 1).fillTriangle(vx - 520, H, vx + 520, H, vx, SEA - 20);
        rock.fillStyle(0x2f2830, 1).fillTriangle(vx - 620, H, vx - 180, H, vx - 400, H - 300);
        rock.fillStyle(0xcdeffb, 1).fillTriangle(vx - 46, SEA - 216, vx + 46, SEA - 216, vx, SEA - 262); // crater notch
        this.craters = [{ x: vx, y: SEA - 214 }, { x: vx - 400, y: H - 296 }];

        // Reef floor on the left.
        const floor = this.add.graphics();
        floor.fillStyle(0xf3dba0, 1).fillEllipse(W * 0.26, H + 60, W * 0.9, 460);
        floor.fillStyle(0xd2ae6c, 1).fillEllipse(W * 0.26, H + 120, W * 0.86, 420);
        [['coral_1', 220, 0.5], ['coral_2', 560, 0.42], ['coral_3', 860, 0.36]].forEach(([k, x, sc]) => {
            if (has(k)) this.add.image(x, H - 150, k).setOrigin(0.5, 1).setScale(sc);
        });
    }

    erupt() {
        const W = this.scale.width;
        this.cameras.main.shake(900, 0.014);
        play('boom');
        this.tweens.add({ targets: this.flash, alpha: 0.5, duration: 140, yoyo: true });
        this.tweens.add({ targets: this.sunset, alpha: 0.55, duration: 900 });
        this.tweens.add({ targets: this.glow, alpha: 0.3, duration: 700 });
        for (const c of this.craters) {
            for (let i = 0; i < 46; i++) {
                const lava = this.add.circle(c.x, c.y, Phaser.Math.Between(6, 16), Phaser.Math.RND.pick([0xffd23f, 0xff8a1f, 0xff3b1f]));
                if (this.painted) lava.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.85);   // glowing embers on the painted stage
                const dx = Phaser.Math.Between(-330, 330), up = Phaser.Math.Between(180, 520);
                this.tweens.add({ targets: lava, x: c.x + dx, duration: 1500, delay: i * 22 });
                this.tweens.add({ targets: lava, y: c.y - up, duration: 620, delay: i * 22, ease: 'Quad.easeOut', yoyo: true, hold: 60,
                    onComplete: () => lava.destroy() });
            }
            for (let i = 0; i < 26; i++) {
                const r = Phaser.Math.Between(40, 90), ax = c.x + Phaser.Math.Between(-40, 40);
                const ash = this.textures.exists(STORY_ART.ash.key)
                    ? this.add.image(ax, c.y, STORY_ART.ash.key).setScale(r / 120).setAngle(Phaser.Math.Between(-30, 30)).setAlpha(0.85)
                    : this.add.circle(ax, c.y, r, 0x2b2630, 0.55);
                this.tweens.add({
                    targets: ash, x: ash.x - Phaser.Math.Between(60, W * 0.5), y: ash.y - Phaser.Math.Between(-120, 260),
                    scale: 2.2, alpha: 0, duration: Phaser.Math.Between(2600, 4200), delay: i * 60, onComplete: () => ash.destroy()
                });
            }
        }
    }

    fallout() {
        const W = this.scale.width, H = this.scale.height;
        // What the eruption shook loose (anchors, nets, drums, scrap) drifts west into the reef:
        // the painted hazards, a little darkened by the murk; drawn silhouettes without the stage art.
        ['mine', 'hazard_net', 'hazard_buoy', 'spikes', 'mine', 'hazard_net'].filter(k => this.textures.exists(k)).forEach((k, i) => {
            const img = this.add.image(W * 0.78 - i * 30, 420 + i * 40, k).setScale(0.3).setAlpha(0);
            if (this.painted) img.setTint(0x8a8088); else img.setTintFill(0x1c1820);
            this.tweens.add({
                targets: img, alpha: 0.95, x: W * (0.74 - i * 0.09), y: Phaser.Math.Between(H * 0.5, H * 0.86),
                angle: Phaser.Math.Between(-40, 40), duration: 1500, delay: i * 130, ease: 'Sine.easeOut'
            });
        });
        // Friends flee west.
        this.friends.forEach((f, i) => {
            f.setFlipX(true);
            this.tweens.add({ targets: f, x: -260, duration: 1100 + i * 120, ease: 'Quad.easeIn' });
        });
    }

    resolve() {
        const cam = this.cameras.main;
        cam.pan(this.lompi.x + 160, this.lompi.y, 700, 'Sine.easeInOut');
        cam.zoomTo(1.5, 700, 'Sine.easeInOut');
        this.time.delayedCall(650, () => {
            if (this.done) return;
            if (this.textures.exists('puffer_inflated')) this.lompi.setTexture('puffer_inflated').setScale(0.5);
            play('puff');
            this.tweens.add({ targets: this.lompi, scale: this.lompi.scale * 1.25, duration: 220, yoyo: true, ease: 'Back.easeOut' });
            const ring = this.add.circle(this.lompi.x, this.lompi.y, 120, 0xfff3b0, 0.45);
            this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
        });
    }

    finish() {
        if (this.done) return;
        this.done = true;
        try { window.localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked */ }
        this.cameras.main.fadeOut(300, 10, 40, 70);
        this.time.delayedCall(320, () => this.scene.start(SCENE_KEYS.MAIN));
    }
}
