import Phaser from 'phaser';
import { OPENING, captionOf } from './story/opening.js';
import { createTimeline } from './timeline.js';
import { createRig } from './CardRig.js';
import { play } from './audio.js';
import { MENU } from './ui/GameMenu.js';

/**
 * The opening story in the real level (game/story/opening.js says when and what): Lompi and a few
 * friends in the lagoon at the start, the ground rumbles, the volcano in the east erupts (shake, a red
 * flash, ash drifting down), the friends scatter east, Lompi puffs up bravely, "Find your friends!",
 * and the same picture simply goes on as the game. Steering waits until it ends. A tap goes one beat
 * on; the small button skips it.
 *
 *   create():  this.opening = new OpeningLayer(scene)      (only on a fresh save, or asked for)
 *   update():  this.opening?.update(delta)                  steering is off while opening.active
 */
export const OPENING_LOOK = {
    ring: [260, 110],          // px: friends swim round Lompi this far ahead/behind and above/below
    scatterSpeed: 900,         // px per s they flee east
    ashEvery: 90, ashCount: 3, // ms between ash puffs over the view, and puffs each time
    flash: 0xff4a1a,
    glow: [0xff5a1f, 0.42],    // the volcano's red light from the east, from the eruption to the end
    murk: 0.24,                // the water darkens a little with ash
    depth: 4.6
};

/** A soft round light, white in the middle and gone at the rim (tinted where it is used); made once. */
function glowTexture(scene) {
    const key = 'opening_glow';
    if (scene.textures.exists(key)) return key;
    const N = 256, t = scene.textures.createCanvas(key, N, N), g = t.getContext().createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    const ctx = t.getContext(); ctx.fillStyle = g; ctx.fillRect(0, 0, N, N); t.refresh();
    return key;
}

export default class OpeningLayer {
    constructor(scene) {
        this.scene = scene; this.active = true; this.t = 0; this.ashAt = 0; this.fleeing = false; this.ashing = false;
        const fish = scene.fish.sprite, chapters = scene.journey?.list || [];
        this.friends = chapters.filter(ch => ch.friend).slice(0, OPENING.friends).map((ch, i) => ({
            rig: createRig(scene, ch.friend, fish.x - 200 + i * 160, fish.y - 80, OPENING_LOOK.depth),
            phase: i * 2.1, x: fish.x - 200 + i * 160, y: fish.y - 80
        }));
        const W = scene.scale.width, H = scene.scale.height, de = scene.lang === 'de';
        this.flashRect = scene.add.rectangle(0, 0, W, H, OPENING_LOOK.flash, 1).setAlpha(0).setOrigin(0).setScrollFactor(0).setDepth(80).setBlendMode('ADD');
        this.glow = scene.add.image(W, H * 0.45, glowTexture(scene)).setDisplaySize(W * 1.3, H * 1.8).setTint(OPENING_LOOK.glow[0])
            .setAlpha(0).setScrollFactor(0).setDepth(79).setBlendMode('ADD');
        this.murk = scene.add.rectangle(0, 0, W, H, 0x1a1414, 1).setAlpha(0).setOrigin(0).setScrollFactor(0).setDepth(78);
        scene.controller.ui.setVisible(false);      // the steering lesson waits for the end of the story
        this.skip = scene.add.text(W - 32 - MENU.corner, H - 28 - MENU.corner, de ?      // in from the phone's rounded corner
            'Überspringen  ›' : 'Skip  ›', {
            fontFamily: 'Arial', fontSize: '40px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0a3f6ecc', padding: { x: 24, y: 12 }
        }).setOrigin(1, 1).setScrollFactor(0).setDepth(81).setInteractive({ useHandCursor: true });
        this.skip.on('pointerdown', (p, x, y, ev) => { ev?.stopPropagation(); this.finish(); });
        this.onTap = () => { if (this.active) this.timeline.next(); };
        scene.input.on('pointerdown', this.onTap);
        const name = scene.character?.name || 'Lompi';
        this.timeline = createTimeline(OPENING.beats.map(b => ({ at: b.at, run: () => this.beat(b, captionOf(b, scene.lang, name)) })));
        this.timeline.step(0);
    }

    beat(b, caption) {
        const s = this.scene, cam = s.cameras.main;
        if (caption) { this.speaking = true; s.announce(caption); this.speaking = false; }
        if (b.id === 'rumble') { cam.shake(1400, 0.006); play('rumble'); }
        else if (b.id === 'erupt') {
            cam.shake(900, 0.014); play('boom');
            s.tweens.add({ targets: this.flashRect, alpha: 0.45, duration: 160, yoyo: true, hold: 260 });
            s.tweens.add({ targets: this.glow, alpha: OPENING_LOOK.glow[1], duration: 350 });
            s.tweens.add({ targets: this.murk, alpha: OPENING_LOOK.murk, duration: 700 });
            this.ashing = true;
        } else if (b.id === 'scatter') { this.fleeing = true; play('whistle'); }
        else if (b.id === 'brave') { if (s.fish.char.special === 'puff') s.fish.special(); else play('leap'); }
        else if (b.id === 'end') this.finish();
    }

    /** Per frame, `delta` ms. */
    update(delta) {
        if (!this.active) return;
        this.timeline.step(delta);
        const s = this.scene, fish = s.fish.sprite, dt = delta / 1000, L = OPENING_LOOK;
        this.t += dt;
        for (const f of this.friends) {
            const ox = f.x, oy = f.y;
            if (this.fleeing) { f.x += L.scatterSpeed * dt; f.y += Math.sin(this.t * 3 + f.phase) * 120 * dt; }
            else {
                const tx = fish.x + Math.cos(this.t * 0.7 + f.phase) * L.ring[0], ty = fish.y + Math.sin(this.t * 0.9 + f.phase) * L.ring[1];
                f.x += (tx - f.x) * Math.min(1, dt * 1.5); f.y += (ty - f.y) * Math.min(1, dt * 1.5);
            }
            const frames = Math.max(dt * 60, 0.01);
            f.rig.lookAt?.(this.fleeing ? null : { x: fish.x, y: fish.y });
            f.rig.draw({ x: f.x, y: f.y, vx: (f.x - ox) / frames, vy: (f.y - oy) / frames, frames, effort: this.fleeing ? 1 : 0.4, turn: 0.1 });
        }
        // Ash from the eruption drifts down through the water over the whole view.
        if (this.ashing && (this.ashAt -= delta) <= 0) {
            this.ashAt = L.ashEvery;
            const v = s.cameras.main.worldView;
            for (let i = 0; i < L.ashCount; i++) s.particles.spawn('silt', v.x + Math.random() * v.width, v.y + Math.random() * v.height * 0.5, 4, { radius: 60, spread: 40, vy: 50 });
        }
    }

    /** The story is over (or skipped): the game simply goes on. */
    finish() {
        if (!this.active) return;
        this.active = false;
        try { window.localStorage.setItem(OPENING.seenKey, '1'); } catch { /* storage blocked */ }
        const s = this.scene;
        s.input.off('pointerdown', this.onTap);
        this.skip.destroy(); this.flashRect.destroy();
        // The red light and the murk fade into the ordinary picture: the game simply goes on.
        s.tweens.add({ targets: [this.glow, this.murk], alpha: 0, duration: 1200, onComplete: () => { this.glow.destroy(); this.murk.destroy(); } });
        s.restartController();
        for (const f of this.friends) f.rig.destroy();
        this.friends = [];
    }
}
