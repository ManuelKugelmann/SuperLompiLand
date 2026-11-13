import Net from '../net/Net.js';
import RemoteFish from './RemoteFish.js';

const SEND_MS = 1000 / 20;   // state broadcast rate
const WAKE_REJOIN_MS = 5000; // hidden at least this long -> rejoin on return

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
        this.net = new Net(secret);
        this.label = this.net.secret.toUpperCase();
        this.ghosts = new Map(); // userId -> RemoteFish
        this.sendAt = 0;
        this.seq = 0;
        this.lang = scene.registry.get('currentLanguage') || 'de';
        // Session name + player count, pinned to the screen.
        this.badge = scene.add.text(scene.scale.width - 24, 20, '', {
            fontFamily: 'Arial', fontSize: '34px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#0a3f6e', strokeThickness: 7
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(60).setAlpha(0.9);
        this.shown = '';

        this.net.onState((id, snap) => {
            let g = this.ghosts.get(id);
            if (!g) this.ghosts.set(id, g = new RemoteFish(scene));
            g.push(snap, performance.now());
        });
        this.net.onLeave(id => {
            this.ghosts.get(id)?.destroy();
            this.ghosts.delete(id);
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
        const now = performance.now();
        if (now >= this.sendAt) {
            this.sendAt = now + SEND_MS;
            const v = fish.body.velocity;
            this.net.send({
                n: this.seq++, t: Math.round(now),
                x: Math.round(fish.sprite.x), y: Math.round(fish.sprite.y),
                vx: +v.x.toFixed(2), vy: +v.y.toFixed(2),
                s: fish.state, f: fish.facing, c: fish.char.id
            });
        }
        for (const g of this.ghosts.values()) g.render(now);
        this.updateBadge();
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
        this.badge.destroy();
        this.net.leave();
    }
}
