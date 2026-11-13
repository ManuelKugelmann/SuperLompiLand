// Emotes and player colours (pure, unit-tested). Spec: no names, no chat —
// each fish shows a colour ring, and players talk with a few emotes only.

export const EMOTES = ['wave', 'heart', 'follow', 'puff'];
export const EMOTE_ICON = { wave: '👋', heart: '❤️', follow: '👉', puff: '🐡' };

// Bright, distinct ring colours, readable on blue water.
export const PLAYER_COLORS = [0xffd54f, 0xff6b9a, 0x7ee08a, 0xc792ff];

export const isEmote = e => typeof e === 'string' && EMOTES.includes(e);

/**
 * Colour for every player in the room. Every client sees the same set of ids,
 * so sorting them gives everyone the same answer without any extra messages.
 */
export function colorsFor(ids) {
    const sorted = [...new Set(ids)].filter(Boolean).sort();
    const out = new Map();
    sorted.forEach((id, i) => out.set(id, PLAYER_COLORS[i % PLAYER_COLORS.length]));
    return out;
}

/** At most one emote per `gapMs` — from us, and accepted from each other player. */
export class RateLimit {
    constructor(gapMs = 700) { this.gap = gapMs; this.last = new Map(); }
    allow(key, now) {
        const t = this.last.get(key);
        if (t !== undefined && now - t < this.gap) return false;
        this.last.set(key, now);
        return true;
    }
}
