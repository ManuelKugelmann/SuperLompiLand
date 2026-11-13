import Phaser from 'phaser';
import { SCENE_KEYS } from './keys.js';

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
            `${de ? 'Münzen' : 'Coins'}: ${score}     ${de ? 'Strecke' : 'Distance'}: ${distance} m`, {
                fontFamily: 'Arial', fontSize: '60px', color: '#ffe08a', fontStyle: 'bold',
                stroke: '#0a3f6e', strokeThickness: 8
            }).setOrigin(0.5);

        const again = this.add.text(W / 2, H * 0.78, de ? 'Nochmal spielen' : 'Play again', {
            fontFamily: 'Arial', fontSize: '48px', color: '#06343a', fontStyle: 'bold',
            backgroundColor: '#ffc266', padding: { x: 40, y: 20 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        again.on('pointerdown', () => this.scene.start(SCENE_KEYS.MAIN));
    }
}
