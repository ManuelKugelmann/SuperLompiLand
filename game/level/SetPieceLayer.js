import Phaser from 'phaser';
import { SET_PIECES, ghostShip, pinnacleTop } from './setPieces.js';

export const SET_LOOK = {
    shipKeys: ['ghost_ship', 'wreck_2', 'wreck_1', 'wreck_3'],   // the painted ghost ship when it is there, else a wreck we have
    sink: 90,               // px the ship is set down below its nominal keel line: the lane above the rock is carved a little wider than the keel line, and a wreck lies a little into its bed
    shipTint: 0xb9c7cc,     // seen through deep water
    deepTint: 0x6f8496,     // the wreck further down: darker still
    lanterns: [[-0.28, -0.45], [0.04, -0.6], [0.3, -0.4]],   // lights in the hull: place as shares of the ship's length from its middle, and of the hull's height above the keel
    lanternSize: 420,
    lanternAlpha: 0.32,
    beaconTint: 0xffd9a0,
    beaconAlpha: 0.42
};

// How each picture that can stand in for the ship is painted (measured on the file): where the
// hull's middle is in it (0..1), how far it is tilted bow-down (radians), and the hull's height
// as a share of the picture's.
const SHIP_ART = {
    ghost_ship: { middle: [0.5, 0.6], tilt: 0, hull: 0.5 },
    wreck_2: { middle: [0.5, 0.59], tilt: 0.31, hull: 0.435 },
    wreck_1: { middle: [0.5, 0.71], tilt: 0.17, hull: 0.44 },
    wreck_3: { middle: [0.5, 0.71], tilt: -0.2, hull: 0.44 }
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
            // Standing level in the pinnacle's hollow: the picture is turned so its hull lies level,
            // scaled so the hull spans the lane, and set so the hull's middle is on the calm route
            // and its keel on the rock.
            const art = SHIP_ART[key] || SHIP_ART.ghost_ship;
            const img = scene.add.image(ship.x, ship.keelY - SET_PIECES.ship.hull / 2 + SET_LOOK.sink, key).setOrigin(art.middle[0], art.middle[1])
                .setRotation(-art.tilt).setDepth(2.6).setTint(SET_LOOK.shipTint);
            img.setScale(SET_PIECES.ship.hull / (art.hull * img.height));
            const h = SET_PIECES.ship.hull, len = img.displayWidth;
            for (const [dx, dy] of SET_LOOK.lanterns) {
                this.lanterns.push(scene.add.image(ship.x + dx * len * 0.8, ship.keelY + dy * h, 'bd_glow')
                    .setDisplaySize(SET_LOOK.lanternSize, SET_LOOK.lanternSize).setTint(0xffc97a).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.7));
            }
        }
        // A second, smaller wreck lies on the slope below, half in the dark: a hint of the deep.
        const low = SET_LOOK.shipKeys.filter(k => k !== key && scene.textures.exists(k))[0];
        if (low) {
            const [dx, len] = SET_PIECES.ship.second, x = ship.x + dx;
            const lying = scene.add.image(x, pinnacleTop(x) + 50, low).setOrigin(0.5, 1).setDepth(2.5).setTint(SET_LOOK.deepTint)
                .setRotation(Math.atan(SET_PIECES.ship.pinnacleSlope) * 0.55);      // it leans down the slope
            lying.setScale(len / lying.width);
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
