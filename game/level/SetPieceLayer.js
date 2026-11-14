import Phaser from 'phaser';
import { SET_PIECES, ghostShip, pinnacleTop } from './setPieces.js';
import { boxHitsCircle, fadeStep } from './occluders.js';

/** The painted ghost ship (loaded by the title screen): its outside, its inside, and where things are in the picture. */
export const SHIP_FILES = {
    images: { ghost_ship: 'img/ship/ship_front.webp', ghost_ship_inside: 'img/ship/ship_inside.webp' },
    json: ['ghost_ship', 'img/ship/ship.json']
};

export const SET_LOOK = {
    shipKeys: ['wreck_2', 'wreck_1', 'wreck_3'],   // wrecks we have: the first stands in for the painted ghost ship when that is missing, another lies on the slope below
    sink: 90,               // px the ship is set down below its nominal keel line: the lane above the rock is carved a little wider than the keel line, and a wreck lies a little into its bed
    shipTint: 0xb9c7cc,     // seen through deep water
    deepTint: 0x6f8496,     // the wreck further down: darker still
    lanterns: [[-0.28, -0.45], [0.04, -0.6], [0.3, -0.4]],   // lights in the hull: place as shares of the ship's length from its middle, and of the hull's height above the keel
    lanternSize: 420,
    lanternAlpha: 0.32,
    portSize: 170,          // the painted ship's lit portholes: size and brightness of their flicker
    portAlpha: 0.5,
    beaconTint: 0xffd9a0,
    beaconAlpha: 0.42
};

// How each picture that can stand in for the ship is painted (measured on the file): where the
// hull's middle is in it (0..1), how far it is tilted bow-down (radians), and the hull's height
// as a share of the picture's.
const SHIP_ART = {
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
        const ship = ghostShip();
        this.lanterns = [];
        this.front = null;
        const art = scene.textures.exists('ghost_ship') && scene.textures.exists('ghost_ship_inside') ? scene.cache.json.get('ghost_ship') : null;
        if (art) this.paintedShip(ship, art); else this.standIn(ship);
        // A second, smaller wreck lies on the slope below, half in the dark: a hint of the deep.
        const low = SET_LOOK.shipKeys.filter(k => k !== 'ghost_ship' && scene.textures.exists(k))[1];
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

    /**
     * The painted ship: its inside lies behind the fish, its outside in front, and the fish is
     * seen through the hole in the bow. The picture is scaled and placed so that the hole's
     * middle is on the calm route and the keel on the pinnacle's bed (`art` = ship.json, in
     * the outside picture's pixels: hole [cx, cy, rx, ry], inside [x, y, w, h], keel
     * [x0, y0, x1, y1], lanterns [[x, y], ...]).
     */
    paintedShip(ship, art) {
        const s = this.scene, [hx, hy] = art.hole, keelY = (art.keel[1] + art.keel[3]) / 2, keelX = (art.keel[0] + art.keel[2]) / 2;
        const k = SET_PIECES.ship.keelUnder / (keelY - hy);              // so the hole is on the route when the keel is on its bed
        const x0 = ship.x - keelX * k, y0 = ship.keelY - keelY * k;      // the picture's top left corner in the world
        const at = (px, py) => [x0 + px * k, y0 + py * k];
        const [ix, iy, iw, ih] = art.inside;
        s.add.image(...at(ix, iy), 'ghost_ship_inside').setOrigin(0).setDisplaySize(iw * k, ih * k).setDepth(2.6);
        this.front = s.add.image(x0, y0, 'ghost_ship').setOrigin(0).setScale(k).setDepth(7.5);
        this.box = { x0, y0, x1: x0 + art.front[0] * k, y1: y0 + art.front[1] * k };
        for (const [px, py] of art.lanterns) {
            this.lanterns.push(s.add.image(...at(px, py), 'bd_glow').setDisplaySize(SET_LOOK.portSize, SET_LOOK.portSize).setTint(0xffc97a)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(7.6));
        }
        this.lanternAlpha = SET_LOOK.portAlpha;
    }

    /** Without the painted ship: a wreck we have, turned level, its hull across the lane, behind the fish. */
    standIn(ship) {
        const s = this.scene, key = SET_LOOK.shipKeys.find(k => SHIP_ART[k] && s.textures.exists(k));
        if (!key) return;
        const art = SHIP_ART[key];
        const img = s.add.image(ship.x, ship.keelY - SET_PIECES.ship.hull / 2 + SET_LOOK.sink, key).setOrigin(art.middle[0], art.middle[1])
            .setRotation(-art.tilt).setDepth(2.6).setTint(SET_LOOK.shipTint);
        img.setScale(SET_PIECES.ship.hull / (art.hull * img.height));
        const h = SET_PIECES.ship.hull, len = img.displayWidth;
        for (const [dx, dy] of SET_LOOK.lanterns) {
            this.lanterns.push(s.add.image(ship.x + dx * len * 0.8, ship.keelY + dy * h, 'bd_glow')
                .setDisplaySize(SET_LOOK.lanternSize, SET_LOOK.lanternSize).setTint(0xffc97a).setBlendMode(Phaser.BlendModes.ADD).setDepth(2.7));
        }
        this.lanternAlpha = SET_LOOK.lanternAlpha;
    }

    /** Per frame: the lights breathe, and the ship's outside thins while the fish is behind it. `t` s, `fish` = { x, y }, `radius` px, `dt` s. */
    update(t, fish, radius, dt) {
        this.lanterns.forEach((l, i) => l.setAlpha(this.lanternAlpha * (0.72 + 0.28 * Math.sin(t * 1.3 + i * 2.1) * Math.sin(t * 3.7 + i))));
        this.beacon.setAlpha(SET_LOOK.beaconAlpha * (0.8 + 0.2 * Math.sin(t * 0.7)));
        if (this.front) this.front.setAlpha(fadeStep(this.front.alpha, 1, boxHitsCircle(this.box, fish.x, fish.y, radius), dt));
    }
}
