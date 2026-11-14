import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';
import SteerAssist from './SteerAssist.js';
import { ASSIST } from './assist.js';
import { createBot, botAim } from './botAim.js';
import { LEVEL } from '../level/LevelGenerator.js';

/**
 * The bot player (?bot=1): swims the level by itself for play tests and screenshots. It steers
 * like any other scheme, through the shared steering help and the Player API, so what it meets
 * (hazards, events, friends, nests) is what a child meets. Not in the scheme switcher.
 */
export default class BotController extends ControllerBase {
    enter() {
        this.assist = new SteerAssist(this.scene, this.fish);
        this.bot = createBot();
        this.aim = new Phaser.Math.Vector2();
        this.env = { route: x => this.scene.level.field.routeY(x), solid: (x, y) => this.scene.density(x, y) > LEVEL.threshold };
        this.ui.add(this.scene.add.text(this.scene.scale.width / 2, this.scene.scale.height - 40, 'BOT', { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.4));
    }

    update(dt = 1000 / 60) {
        this.assist.ease(dt);
        const sp = this.fish.sprite, a = botAim(this.bot, sp, this.env, dt / 1000);
        this.aim.set(a.x, a.y);
        this.assist.pull(this.aim, 1, 1, a.y > ASSIST.hold.diveDir);
    }
}
