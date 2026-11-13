import Phaser from 'phaser';
import { SCENE_KEYS } from './keys.js';

export default class EndScene extends Phaser.Scene {
    constructor() {
        super({ key: SCENE_KEYS.END });
    }

    create(data) {
        const W = this.scale.width;
        const H = this.scale.height;
        const lang = this.registry.get('currentLanguage') || 'de';
        const score = data?.score ?? 0;

        this.add.rectangle(W / 2, H / 2, W, H, 0x053b42).setDepth(-1);
        this.add.text(W / 2, H * 0.38, lang === 'de' ? 'Gut gemacht!' : 'Well done!', {
            fontFamily: 'Arial', fontSize: '110px', color: '#fff7e6', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.add.text(W / 2, H * 0.52, (lang === 'de' ? 'Blasen gesammelt: ' : 'Bubbles collected: ') + score, {
            fontFamily: 'Arial', fontSize: '56px', color: '#ffc266'
        }).setOrigin(0.5);

        const again = this.add.text(W / 2, H * 0.7, lang === 'de' ? 'Nochmal spielen' : 'Play again', {
            fontFamily: 'Arial', fontSize: '44px', color: '#ffffff',
            backgroundColor: '#06525c', padding: { x: 30, y: 16 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        again.on('pointerdown', () => this.scene.start(SCENE_KEYS.MAIN));
    }
}
