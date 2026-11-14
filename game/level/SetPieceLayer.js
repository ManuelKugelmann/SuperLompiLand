import Phaser from 'phaser';
import { SET_PIECES, ghostShip } from './setPieces.js';

export const SET_LOOK = {
    shipKeys: ['ghost_ship', 'wreck_2', 'wreck_1', 'wreck_3'],   // the painted ghost ship when it is there, else a wreck we have
    shipTint: 0xb9c7cc,     // seen through deep water
    lanterns: [[-0.28, -0.3], [0.04, -0.42], [0.3, -0.26]],   // lights in the hull: place as shares of the ship's length from its middle, and of its height above the keel
    lanternSize: 420,
    lanternAlpha: 0.32,
    beaconTint: 0xffd9a0,
    beaconAlpha: 0.42
};

/**
 * What the set pieces look like (level/setPieces.js says where they are): the ghost ship
 * standing on its pinnacle with warm light in its hull, and the beacon of light that rises
 * from the grand nest so the goal is seen from far above. A handful of objects, made once.
 */
export default class SetPieceLayer {
    /** `nest` = the grand nest ({ x, y }). */
    constructor(scene, nest) {
        this.scene = scene;
        const ship = ghostShip(), key = SET_LOOK.shipKeys.find(k => scene.textures.exists(k));
        this.lanterns = [];
        if (key) {
            // Standing on the pinnacle, a little sunk into it; the calm route passes through its hull.
            const img = scene.add.image(ship.x, ship.keelY + 60, key).setOrigin(0.5, 1).setDepth(2.6).setTint(SET_LOOK.shipTint);
            img.setScale(SET_PIECES.ship.length / img.width);
            const h = img.displayHeight;
            for (const [dx, dy] of SET_LOOK.lanterns) {
                this.lanterns.push(scene.add.image(ship.x + dx * SET_PIECES.ship.length, ship.keelY + dy * h, 'bd_glow')
                    .setDisplaySize(SET_LOOK.lanternSize, SET_LOOK.lanternSize).setTint(0xffc97a).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.7));
            }
        }
        // The beacon: a column of warm light standing on the grand nest, fading out far above it.
        const [bw, bh] = SET_PIECES.descent.beacon;
        this.beacon = scene.add.image(nest.x, nest.y, 'bd_ray').setOrigin(0.5, 1).setFlipY(true).setDisplaySize(bw, bh)
            .setTint(SET_LOOK.beaconTint).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    }

    /** Per frame: the lights breathe. `t` in seconds. */
    update(t) {
        this.lanterns.forEach((l, i) => l.setAlpha(SET_LOOK.lanternAlpha * (0.75 + 0.25 * Math.sin(t * 1.3 + i * 2.1))));
        this.beacon.setAlpha(SET_LOOK.beaconAlpha * (0.8 + 0.2 * Math.sin(t * 0.7)));
    }
}
