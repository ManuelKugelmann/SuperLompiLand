import { openNet } from '../net/config.js';
import RemoteFish from './RemoteFish.js';
import { EMOTES, EMOTE_ICON, isEmote, colorsFor, RateLimit } from '../net/social.js';
import { cleanState, cleanEvent, Strikes } from '../net/validate.js';
import { HUD_KEY } from '../scenes/HudScene.js';
import { pillButton, textStyle } from './ui/kit.js';

const SEND_MS = 1000 / 20;   // state broadcast rate
const WAKE_REJOIN_MS = 5000; // hidden at least this long -> rejoin on return
const EMOTE_GAP_MS = 700;    // one emote per this long, per player
const BUBBLE_MS = 5000;      // a downed friend's revive bubble lasts this long (then they respawn solo)
const BUBBLE_R = 110;        // revive bubble radius (px)

/**
 * Glue between a MainScene and the network: broadcasts the local fish and
 * draws everyone else as RemoteFish ghosts. MainScene needs three call sites:
 *   create():   this.mp = Multiplayer.create(this)       (null when no session)
 *   update():   this.mp?.tick(this.fish)
 *   SHUTDOWN:   this.mp?.destroy()
 * and may use: mp.nearFriends(x, y, r) (school boost), mp.downed(x, y) (0 hearts),
 * and implement scene.revive() (a friend touched our revive bubble).
 * The room name comes from the scene registry key 'room' (set by IntroScene).
 */
export default class Multiplayer {
    static create(scene) {
        const secret = scene.registry.get('room');
        return secret ? new Multiplayer(scene, secret) : null;
    }

    constructor(scene, secret) {
        this.scene = scene;
        this.net = openNet(secret);
        this.word = this.net.secret;
        this.ghosts = new Map(); // userId -> RemoteFish
        this.sendAt = 0;
        this.seq = 0;
        this.lang = scene.registry.get('currentLanguage') || 'de';
        this.de = this.lang === 'de';
        // Our own colour ring, shown once someone else is here.
        this.myRing = scene.add.circle(0, 0, 70).setDepth(4.7).setVisible(false);
        this.myColor = null;
        this.colorKey = '';
        this.limit = new RateLimit(EMOTE_GAP_MS);
        this.strikes = new Strikes(20);
        this.hud = null;          // { badge, dots, emotes[] } inside the HUD scene
        this.menu = null;         // room menu (word + invite), behind a tap on the badge
        this.bubbles = new Map(); // userId -> { x, y, until, ring, label }
        this.downAt = -Infinity;

        this.net.onState((id, raw) => {
            if (this.strikes.blocked(id)) return;
            const snap = cleanState(raw);
            if (!snap) { this.strikes.bad(id); return; }
            let g = this.ghosts.get(id);
            if (!g) this.ghosts.set(id, g = new RemoteFish(scene));
            g.push(snap, performance.now());
        });
        this.net.onLeave(id => {
            this.ghosts.get(id)?.destroy();
            this.ghosts.delete(id);
            this.dropBubble(id);
        });
        this.net.onEmote((id, e) => {
            if (this.strikes.blocked(id)) return;
            const g = this.ghosts.get(id);
            if (!isEmote(e)) { this.strikes.bad(id); return; }
            if (!g || !this.limit.allow(id, performance.now())) return;
            this.showEmote(e, g);
        });
        this.net.onEvent?.((id, raw) => {
            if (this.strikes.blocked(id)) return;
            const ev = cleanEvent(raw);
            if (!ev) { this.strikes.bad(id); return; }
            if (ev.t === 'down' && this.ghosts.has(id)) this.addBubble(id, ev.x, ev.y);
            if (ev.t === 'revive') {
                this.dropBubble(ev.id);
                // Someone touched our bubble: back in the game (only if we are actually down).
                if (ev.id === this.net.selfId && performance.now() - this.downAt < BUBBLE_MS + 1000) {
                    this.downAt = -Infinity;
                    this.scene.revive?.();
                    const g = this.ghosts.get(id);
                    if (g) this.showEmote('heart', g);
                }
            }
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

    /** How many friends are within `r` of (x, y) right now — for the school boost. */
    nearFriends(x, y, r) {
        let n = 0;
        for (const g of this.ghosts.values()) if (g.pos && Math.hypot(g.pos.x - x, g.pos.y - y) <= r) n++;
        return n;
    }

    /** Our fish has 0 hearts at (x, y): friends get a revive bubble there for a few seconds. */
    downed(x, y) {
        this.downAt = performance.now();
        this.net.sendEvent?.({ t: 'down', x: Math.round(x), y: Math.round(y) });
    }

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
                s: fish.state, f: fish.facing < 0 ? -1 : 1, c: fish.char.id
            });
        }
        for (const g of this.ghosts.values()) g.render(now);
        this.updateColors();
        const together = this.ghosts.size > 0 && this.myColor !== null;
        this.myRing.setVisible(together);
        if (together) this.myRing.setPosition(fish.view.x, fish.view.y).setRadius(fish.radius * 1.25);
        this.updateBubbles(now);
        this.ensureHud();
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
        this.shown = ''; // repaint the badge dots
    }

    // --- revive bubbles --------------------------------------------------------

    addBubble(id, x, y) {
        this.dropBubble(id);
        const s = this.scene;
        const ring = s.add.circle(x, y, BUBBLE_R, 0xbfefff, 0.22).setStrokeStyle(6, 0xffffff, 0.85).setDepth(5.2);
        const label = s.add.text(x, y - BUBBLE_R - 34, '💗', { fontFamily: 'Arial', fontSize: '56px' }).setOrigin(0.5).setDepth(5.3);
        s.tweens.add({ targets: ring, scale: 1.08, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.bubbles.set(id, { x, y, until: performance.now() + BUBBLE_MS, ring, label });
    }

    dropBubble(id) {
        const b = this.bubbles.get(id);
        if (!b) return;
        this.scene.tweens.killTweensOf(b.ring);
        b.ring.destroy(); b.label.destroy();
        this.bubbles.delete(id);
    }

    updateBubbles(now) {
        for (const [id, b] of this.bubbles) {
            if (now > b.until) { this.dropBubble(id); continue; }
            const f = this.fish;
            if (f && Math.hypot(f.sprite.x - b.x, f.sprite.y - b.y) < BUBBLE_R + f.radius) {
                this.net.sendEvent?.({ t: 'revive', id });
                this.dropBubble(id);
                this.showEmote('heart', null);
            }
        }
    }

    // --- HUD: badge (no room word on screen), emote buttons, room menu --------

    /** Lives in the HUD scene, so taps on it never steer the fish. Rebuilt if the HUD restarts. */
    ensureHud() {
        const hudOn = this.scene.scene.isActive(HUD_KEY);
        if (this.hud && !hudOn) { this.hud = null; this.menu = null; }
        if (this.hud || !hudOn) return;
        const hud = this.scene.scene.get(HUD_KEY);
        const W = hud.scale.width, H = hud.scale.height;
        // Badge: player count and colour dots only — the room word is never shown large
        // (screenshots, streams); it is in the room menu behind a tap.
        const badge = pillButton(hud, W - 130, 186, 200, 70, '', () => this.toggleMenu(), { size: 34 });
        const dots = hud.add.graphics();
        const emotes = EMOTES.map((e, i) =>
            pillButton(hud, W - 66, H * 0.4 + i * 100, 96, 86, EMOTE_ICON[e], () => this.emote(e), { size: 44 }));
        this.hud = { scene: hud, badge, dots, emotes, W };
        this.shown = '';
    }

    updateBadge() {
        if (!this.hud) return;
        const st = this.net.status;
        let text;
        if (st === 'connecting') text = '👥 …';
        else if (st === 'full') text = this.de ? '👥 voll' : '👥 full';
        else if (st === 'error') text = '👥 offline';
        else text = `👥 ${this.players}`;
        const key = text + this.colorKey;
        if (key === this.shown) return;
        this.shown = key;
        this.hud.badge.setLabel(text);
        // Colour dots under the badge: ours first, then the friends'.
        const g = this.hud.dots.clear();
        const colors = [this.myColor, ...[...this.ghosts.values()].map(x => x.color)].filter(c => c != null);
        if (colors.length < 2) return;
        const x0 = this.hud.W - 130 - (colors.length - 1) * 15;
        colors.forEach((c, i) => g.fillStyle(0x0a3f6e, 0.9).fillCircle(x0 + i * 30, 236, 12).fillStyle(c, 1).fillCircle(x0 + i * 30, 236, 9));
    }

    toggleMenu() {
        if (this.menu) { this.menu.forEach(o => o.destroy?.()); this.menu = null; return; }
        const hud = this.hud.scene, W = hud.scale.width, H = hud.scale.height, de = this.de;
        const parts = [];
        const add = o => { parts.push(o); return o; };
        // A panel that swallows taps (it is in the HUD scene, so the fish does not move).
        add(hud.add.rectangle(W / 2, H / 2, 900, 520, 0x063a47, 0.96).setStrokeStyle(4, 0xffffff, 0.5).setInteractive());
        add(hud.add.text(W / 2, H / 2 - 200, de ? 'Euer Raum' : 'Your room', textStyle(52)).setOrigin(0.5));
        const word = add(hud.add.text(W / 2, H / 2 - 90, de ? '• • • • • •' : '• • • • • •', textStyle(64, '#ffc266')).setOrigin(0.5));
        const status = add(hud.add.text(W / 2, H / 2 + 200, '', textStyle(28, '#eafcff', false)).setOrigin(0.5));
        const reveal = pillButton(hud, W / 2 - 200, H / 2 + 60, 340, 90, de ? '👁 Wort zeigen' : '👁 Show word', () => {
            word.setText(word.text.startsWith('•') ? this.word.toUpperCase() : '• • • • • •');
        });
        const invite = pillButton(hud, W / 2 + 200, H / 2 + 60, 340, 90, de ? '🔗 Einladen' : '🔗 Invite', () => this.invite(status));
        const close = pillButton(hud, W / 2 + 400, H / 2 - 210, 70, 70, '✕', () => this.toggleMenu());
        this.menu = [...parts, reveal, invite, close];
    }

    /** Invite link with the room in the fragment (never sent to a server): share sheet, else copy. */
    async invite(status) {
        const url = `${location.origin}${location.pathname}#room=${encodeURIComponent(this.word)}`;
        const de = this.de;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Super Lompi Land', text: de ? 'Schwimm mit mir!' : 'Swim with me!', url });
                status.setText(de ? 'Einladung geteilt.' : 'Invite shared.');
                return;
            }
        } catch (e) {
            if (e?.name === 'AbortError') return; // share sheet closed
        }
        try {
            await navigator.clipboard.writeText(url);
            status.setText(de ? 'Link kopiert – schick ihn an deine Freunde.' : 'Link copied – send it to your friends.');
        } catch {
            status.setText(de ? 'Kopieren ging nicht.' : 'Could not copy.');
        }
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

    destroy() {
        window.removeEventListener('online', this.onOnline);
        document.removeEventListener('visibilitychange', this.onVisible);
        for (const g of this.ghosts.values()) g.destroy();
        this.ghosts.clear();
        for (const id of [...this.bubbles.keys()]) this.dropBubble(id);
        if (this.hud) {
            this.hud.badge.destroy(); this.hud.dots.destroy();
            this.hud.emotes.forEach(b => b.destroy());
        }
        this.menu?.forEach(o => o.destroy?.());
        this.hud = null; this.menu = null;
        this.myRing.destroy();
        this.net.leave();
    }
}
