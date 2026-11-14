// The bot player's brain (pure, no Phaser): for play tests and screenshots (?bot=1) it swims the
// route like a child would, weaving a little, going round rock, and backing off when it is stuck.
// It decides a swim direction; BotController hands that to the fish through the Player API.

export const BOT = {
    look: 520,         // px ahead on the route it aims for
    weave: 170,        // px it weaves above and below the route ...
    weaveS: 7,         // ... once in this many seconds
    feel: 190,         // px ahead it feels for rock
    stuckS: 2.5,       // s with less progress than ...
    stuckPx: 60,       // ... this many px after which it backs off ...
    backS: 1.1,        // ... for this long (longer each time it fails again), up or down and a little back ...
    levelS: 3,         // ... then swims level at that height for this long before it goes back to the route
    freePx: 700        // px of progress after which a stuck place counts as passed
};

const TRIES = [0, -0.45, 0.45, -0.9, 0.9, -1.4, 1.4, -2, 2];

/** A bot's memory: where it was when it last made progress, and whether it is backing off. */
export const createBot = () => ({ t: 0, markX: null, markT: 0, back: 0, level: 0, side: 1, fails: 0, stuckX: 0 });

/**
 * One step: the direction to swim, { x, y } of length 1. `fish` = { x, y }, `world` =
 * { route(x) the lane's y, solid(x, y) rock there }, `dt` s. Mutates `bot`.
 */
export function botAim(bot, fish, world, dt, cfg = BOT) {
    bot.t += dt;
    if (bot.markX === null) { bot.markX = fish.x; bot.markT = bot.t; }
    if (fish.x - bot.markX > cfg.stuckPx) { bot.markX = fish.x; bot.markT = bot.t; }
    else if (bot.back <= 0 && bot.t - bot.markT > cfg.stuckS) { bot.fails++; bot.back = cfg.backS * bot.fails; bot.side = -bot.side; bot.markT = bot.t; bot.stuckX = fish.x; }
    if (bot.fails && fish.x - bot.stuckX > cfg.freePx) bot.fails = 0;
    let want;
    if (bot.back > 0) {
        // Stuck: away up one time and down the next, further each time, then east at that height.
        bot.back -= dt;
        if (bot.back <= 0) { bot.level = cfg.levelS * bot.fails; bot.markT = bot.t; }
        want = Math.atan2(-bot.side * 0.95, -0.3);
    } else if (bot.level > 0) {
        bot.level -= dt;
        want = 0;
    } else {
        const tx = fish.x + cfg.look, ty = world.route(tx) + Math.sin(bot.t * Math.PI * 2 / cfg.weaveS) * cfg.weave;
        want = Math.atan2(ty - fish.y, tx - fish.x);
    }
    for (const d of TRIES) {
        const a = want + d, cx = Math.cos(a), cy = Math.sin(a);
        if (!world.solid(fish.x + cx * cfg.feel, fish.y + cy * cfg.feel) && !world.solid(fish.x + cx * cfg.feel * 0.5, fish.y + cy * cfg.feel * 0.5)) return { x: cx, y: cy };
    }
    return { x: Math.cos(want), y: Math.sin(want) };
}
