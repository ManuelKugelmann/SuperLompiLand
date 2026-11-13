import Net from '../net/Net.js';
import RemoteFish from './RemoteFish.js';

const SEND_MS = 1000 / 15; // state broadcast rate

/**
 * Glue between a MainScene and the network: broadcasts the local fish and
 * draws everyone else as RemoteFish ghosts. MainScene needs three call sites:
 *   create():   this.mp = Multiplayer.create(this)       (null when no room code)
 *   update():   this.mp?.tick(this.fish)
 *   SHUTDOWN:   this.mp?.destroy()
 * The room code comes from the scene registry key 'room' (set by IntroScene).
 */
export default class Multiplayer {
    static create(scene) {
        const code = scene.registry.get('room');
        return code ? new Multiplayer(scene, code) : null;
    }

    constructor(scene, code) {
        this.scene = scene;
        this.code = code;
        this.net = new Net(code);
        this.ghosts = new Map(); // userId -> RemoteFish
        this.sendAt = 0;
        // Room code + player count, pinned to the screen.
        this.badge = scene.add.text(scene.scale.width - 24, 20, '', {
            fontFamily: 'Arial', fontSize: '34px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#0a3f6e', strokeThickness: 7
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(60).setAlpha(0.9);
        this.shown = -1;
        this.net.onState((id, snap) => {
            let g = this.ghosts.get(id);
            if (!g) this.ghosts.set(id, g = new RemoteFish(scene));
            g.push(snap, performance.now());
        });
        this.net.onLeave(id => {
            this.ghosts.get(id)?.destroy();
            this.ghosts.delete(id);
        });
    }

    get players() { return this.ghosts.size + 1; }

    tick(fish) {
        const now = performance.now();
        if (now >= this.sendAt) {
            this.sendAt = now + SEND_MS;
            const v = fish.body.velocity;
            this.net.send({
                x: Math.round(fish.sprite.x), y: Math.round(fish.sprite.y),
                vx: +v.x.toFixed(2), vy: +v.y.toFixed(2),
                s: fish.state, f: fish.facing, c: fish.char.id
            });
        }
        for (const g of this.ghosts.values()) g.render(now);
        if (this.shown !== this.players) {
            this.shown = this.players;
            this.badge.setText(`${this.code}  ×${this.players}`);
        }
    }

    destroy() {
        for (const g of this.ghosts.values()) g.destroy();
        this.ghosts.clear();
        this.badge.destroy();
        this.net.leave();
    }
}
