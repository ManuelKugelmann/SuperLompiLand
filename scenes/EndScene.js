import Phaser from 'phaser';
import { SCENE_KEYS } from './keys.js';
import { chapters } from '../game/journey.js';
import { createRig } from '../game/CardRig.js';

export default class EndScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENE_KEYS.END });
    }

    create(data) {
        const W = this.scale.width, H = this.scale.height;
        const de = (this.registry.get('currentLanguage') || 'de') === 'de';
        const score = data?.score ?? 0;
        const distance = data?.distance ?? 0;

        if (this.textures.exists('bg_far')) this.add.image(W / 2, H / 2, 'bg_far').setDisplaySize(W, H);
        else this.add.rectangle(W / 2, H / 2, W, H, 0x0a3f6e);

        const won = !!data?.won;
        this.add.text(W / 2, H * 0.2, won ? (de ? 'Geschafft! Das große Nest!' : 'You made it! The Grand Nest!') : (de ? 'Gut gemacht!' : 'Well done!'), {
            fontFamily: 'Arial', fontSize: '120px', color: '#ffffff', fontStyle: 'bold',
            stroke: '#0a5c7a', strokeThickness: 14
        }).setOrigin(0.5);
        this.add.text(W / 2, H * 0.6,
            `${de ? 'Münzen' : 'Coins'}: ${score}     ${de ? 'Tiefster Tauchgang' : 'Deepest dive'}: ${distance} m`, {
                fontFamily: 'Arial', fontSize: '60px', color: '#ffe08a', fontStyle: 'bold',
                stroke: '#0a3f6e', strokeThickness: 8
            }).setOrigin(0.5);

        // The friends of the journey in a row: the ones you freed swim there, the others are still shadows.
        const cast = chapters().filter(c => c.friend).map(c => c.friend), found = data?.friends ?? [];
        const gap = Math.min(250, W * 0.8 / cast.length), y = H * 0.41;
        this.friends = [];
        cast.forEach((ch, i) => {
            const x = W / 2 + (i - (cast.length - 1) / 2) * gap, st = ch.states.normal, size = Math.min(1, 150 / st.width);
            if (found.includes(ch.id)) {
                const rig = createRig(this, ch, x, y, 2);
                rig.zoom = size;
                this.friends.push({ rig, x, y, seed: i * 1.7 });
            } else if (this.textures.exists(st.key)) {
                this.add.image(x, y, st.key).setDisplaySize(st.width * size, st.width * size * this.textures.getFrame(st.key).height / this.textures.getFrame(st.key).width)
                    .setTintFill(0x06343a).setAlpha(0.35);
            }
        });
        this.add.text(W / 2, H * 0.51, de ? `${found.filter(id => cast.some(c => c.id === id)).length} von ${cast.length} Freunden befreit` : `${found.filter(id => cast.some(c => c.id === id)).length} of ${cast.length} friends freed`, {
            fontFamily: 'Arial', fontSize: '44px', color: '#ffffff', fontStyle: 'bold', stroke: '#0a3f6e', strokeThickness: 8
        }).setOrigin(0.5);

        const again = this.add.text(W / 2, H * 0.78, de ? 'Nochmal spielen' : 'Play again', {
            fontFamily: 'Arial', fontSize: '48px', color: '#06343a', fontStyle: 'bold',
            backgroundColor: '#ffc266', padding: { x: 40, y: 20 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        again.on('pointerdown', () => this.scene.start(SCENE_KEYS.MAIN));
    }

    update(time, delta) {
        const t = time / 1000, frames = delta / (1000 / 60);
        for (const f of this.friends) f.rig.draw({ x: f.x, y: f.y + Math.sin(t * 1.4 + f.seed) * 14, frames, effort: 0.3, facing: 1 });
    }
}
