import { openNet } from '../net/config.js';
import RemoteFish from './RemoteFish.js';
import { EMOTES, EMOTE_ICON, isEmote, colorsFor, RateLimit } from '../net/social.js';
import { HUD_KEY } from '../scenes/HudScene.js';
import { pillButton } from './ui/kit.js';

const SEND_MS = 1000 / 20;   // state broadcast rate
const WAKE_REJOIN_MS = 5000; // hidden at least this long -> rejoin on return
const EMOTE_GAP_MS = 700;    // one emote per this long, per player

/**
 * Glue between a MainScene and the network: broadcasts the local fish and
 * draws everyone else as RemoteFish ghosts. MainScene needs three call sites:
 *   create():   this.mp = Multiplayer.create(this)       (null when no session)
 *   update():   this.mp?.tick(this.fish)
 *   SHUTDOWN:   this.mp?.destroy()
 * The session secret comes from the scene registry key 'room' (set by IntroScene).
 */
export default class Multiplayer {
    static create(scene) {
        const secret = scene.registry.get('room');
        return secret ? new Multiplayer(scene, secret) : null;
    }

    constructor(scene, secret) {
        this.scene = scene;
        this.net = openNet(secret);
        this.label = this.net.secret.toUpperCase();
        this.ghosts = new Map(); // userId -> RemoteFish
        this.sendAt = 0;
        this.seq = 0;
        this.lang = scene.registry.get('currentLanguage') || 'de';
        // Session name + player count, pinned to the screen.
        // Below the HUD's journey strip (top right), clear of its buttons.
        this.badge = scene.add.text(scene.scale.width - 40, 158, '', {
            fontFamily: 'Arial', fontSize: '34px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#0a3f6e', strokeThickness: 7
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(60).setAlpha(0.9);
        this.shown = '';
        // Our own colour ring, shown once someone else is here.
        this.myRing = scene.add.circle(0, 0, 70).setDepth(4.7).setVisible(false);
        this.myColor = null;
        this.colorKey = '';
        this.limit = new RateLimit(EMOTE_GAP_MS);
        this.emoteBar = null;

        this.net.onState((id, snap) => {
            let g = this.ghosts.get(id);
            if (!g) this.ghosts.set(id, g = new RemoteFish(scene));
            g.push(snap, performance.now());
        });
        this.net.onLeave(id => {
            this.ghosts.get(id)?.destroy();
            this.ghosts.delete(id);
        });
        this.net.onEmote((id, e) => {
            const g = this.ghosts.get(id);
            if (!g || !isEmote(e) || !this.limit.allow(id, performance.now())) return;
            this.showEmote(e, g);
        });

        // Come back cleanly after the network drops or the device sleeps.
        this.hiddenAt = 0;
        this.onOnline = () => this.net.rejoin();
        this.onVisible = () => {
            if (document.hidden) { this.hiddenAt = performance.now(); return; }
            if (this.hiddenAt && performance.now() - this.hiddenAt > WAKE_REJOIN_MS) this.net.rejoin();
            this.hiddenAt = 0;
        };
        window.addEventListener('online', this.onOnline);
        document.addEventListener('visibilitychange', this.onVisible);
    }

    get players() { return this.ghosts.size + 1; }

    tick(fish) {
        this.fish = fish;
        const now = performance.now();
        if (now >= this.sendAt) {
            this.sendAt = now + SEND_MS;
            const x = fish.sprite.x, y = fish.sprite.y;
            // Velocity as actually moved (px per 60 Hz step), not the physics value: on a slow
            // device that drops simulation steps the two differ, and receivers coast on this.
            let vx = fish.body.velocity.x, vy = fish.body.velocity.y;
            const last = this.last;
            if (last && now - last.t > 5 && now - last.t < 500) {
                const k = (1000 / 60) / (now - last.t);
                vx = (x - last.x) * k; vy = (y - last.y) * k;
            }
            this.last = { x, y, t: now };
            this.net.send({
                n: this.seq++, t: Math.round(now),
                x: Math.round(x), y: Math.round(y),
                vx: +vx.toFixed(2), vy: +vy.toFixed(2),
                s: fish.state, f: fish.facing, c: fish.char.id
            });
        }
        for (const g of this.ghosts.values()) g.render(now);
        this.updateColors();
        const together = this.ghosts.size > 0 && this.myColor !== null;
        this.myRing.setVisible(together);
        if (together) this.myRing.setPosition(fish.view.x, fish.view.y).setRadius(fish.radius * 1.25);
        this.ensureEmoteBar();
        this.updateBadge();
    }

    /** Same colours on every screen: sorted player ids -> palette. */
    updateColors() {
        const self = this.net.selfId;
        if (!self) return;
        const ids = [self, ...this.ghosts.keys()];
        const key = ids.slice().sort().join('|');
        if (key === this.colorKey) return;
        this.colorKey = key;
        const colors = colorsFor(ids);
        this.myColor = colors.get(self);
        this.myRing.setStrokeStyle(7, this.myColor, 0.85);
        for (const [id, g] of this.ghosts) g.setColor(colors.get(id));
    }

    /** Emote buttons live in the HUD scene, so a tap on them never steers the fish. */
    ensureEmoteBar() {
        const hudOn = this.scene.scene.isActive(HUD_KEY);
        if (this.emoteBar && !hudOn) this.emoteBar = null; // HUD restarted: its objects are gone
        if (this.emoteBar || !hudOn) return;
        const hud = this.scene.scene.get(HUD_KEY);
        const W = hud.scale.width, H = hud.scale.height;
        this.emoteBar = EMOTES.map((e, i) =>
            pillButton(hud, W - 66, H * 0.4 + i * 100, 96, 86, EMOTE_ICON[e], () => this.emote(e), { size: 44 }));
    }

    emote(e) {
        if (!this.fish || !this.limit.allow('me', performance.now())) return;
        this.net.sendEmote(e);
        this.showEmote(e, null);
    }

    /** Pop the emote over the fish — or over its edge marker when that friend is off screen. */
    showEmote(e, ghost) {
        const s = this.scene;
        let x, y, fixed = false;
        if (!ghost) { x = this.fish.view.x; y = this.fish.view.y - this.fish.radius * 1.3 - 30; }
        else if (ghost.icon.visible) { x = ghost.icon.x; y = ghost.icon.y - 70; fixed = true; }
        else { const h = ghost.head; if (!h) return; x = h.x; y = h.y; }
        const t = s.add.text(x, y, EMOTE_ICON[e], { fontFamily: 'Arial', fontSize: '76px' })
            .setOrigin(0.5).setDepth(61).setScale(0.4);
        if (fixed) t.setScrollFactor(0);
        s.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
        s.tweens.add({ targets: t, y: y - 110, alpha: 0, delay: 650, duration: 900, onComplete: () => t.destroy() });
    }

    updateBadge() {
        const de = this.lang === 'de', st = this.net.status;
        let tail;
        if (st === 'connecting') tail = '…';
        else if (st === 'full') tail = de ? 'voll' : 'full';
        else if (st === 'error') tail = de ? 'offline' : 'offline';
        else tail = this.players > 1 ? `×${this.players}` : (de ? 'allein' : 'alone');
        const text = `${this.label}  ${tail}`;
        if (text !== this.shown) { this.shown = text; this.badge.setText(text); }
    }

    destroy() {
        window.removeEventListener('online', this.onOnline);
        document.removeEventListener('visibilitychange', this.onVisible);
        for (const g of this.ghosts.values()) g.destroy();
        this.ghosts.clear();
        this.emoteBar?.forEach(b => b.destroy());
        this.emoteBar = null;
        this.badge.destroy();
        this.myRing.destroy();
        this.net.leave();
    }
}
