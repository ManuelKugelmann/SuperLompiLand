// What has been collected or changed in the world — remembered for good.
//
// The world itself is rebuilt from its seed whenever a chunk comes into view, so
// only the differences are stored: one small bitfield per chunk per kind of
// thing (coin 17 of chunk "3,2" taken, friend 0 greeted, ...). Only chunks the
// player actually touched take any space. Phaser-free; tests/worldState.test.mjs.

export const KINDS = { coin: 64, friend: 16 };   // bits reserved per chunk

const toB64 = bytes => {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
};
const fromB64 = (str, length) => {
    const out = new Uint8Array(length);
    try {
        const s = atob(str);
        for (let i = 0; i < Math.min(length, s.length); i++) out[i] = s.charCodeAt(i);
    } catch { /* corrupt entry: treat as empty */ }
    return out;
};

export default class WorldState {
    /**
     * @param {{getItem: Function, setItem: Function}} storage  e.g. window.localStorage
     * @param {string} key      storage key
     * @param {string|number} version  generator version; a different one starts fresh,
     *                                 because indices would point at different things
     */
    constructor(storage, key, version) {
        this.storage = storage;
        this.key = key;
        this.version = String(version);
        this.chunks = new Map();   // chunkKey -> { kind: Uint8Array }
        this.dirty = false;
        this.load();
    }

    load() {
        this.chunks.clear();
        let data = null;
        try { data = JSON.parse(this.storage?.getItem(this.key) ?? 'null'); } catch { data = null; }
        if (!data || data.v !== this.version) return;
        for (const [chunkKey, kinds] of Object.entries(data.chunks || {})) {
            const entry = {};
            for (const [kind, b64] of Object.entries(kinds)) {
                if (KINDS[kind]) entry[kind] = fromB64(b64, KINDS[kind] / 8);
            }
            this.chunks.set(chunkKey, entry);
        }
    }

    has(chunkKey, kind, index) {
        const bits = this.chunks.get(chunkKey)?.[kind];
        return !!bits && index >= 0 && index < KINDS[kind] && (bits[index >> 3] & (1 << (index & 7))) !== 0;
    }

    /** Mark one thing as collected / changed. Returns false if the index is out of range. */
    set(chunkKey, kind, index) {
        if (!KINDS[kind] || index < 0 || index >= KINDS[kind]) return false;
        let entry = this.chunks.get(chunkKey);
        if (!entry) this.chunks.set(chunkKey, entry = {});
        const bits = entry[kind] || (entry[kind] = new Uint8Array(KINDS[kind] / 8));
        bits[index >> 3] |= 1 << (index & 7);
        this.dirty = true;
        return true;
    }

    /** How many things of a kind are marked in total. */
    count(kind) {
        let n = 0;
        for (const entry of this.chunks.values()) {
            for (const byte of entry[kind] || []) for (let b = byte; b; b &= b - 1) n++;
        }
        return n;
    }

    serialize() {
        const chunks = {};
        for (const [chunkKey, entry] of this.chunks) {
            chunks[chunkKey] = Object.fromEntries(Object.entries(entry).map(([kind, bits]) => [kind, toB64(bits)]));
        }
        return JSON.stringify({ v: this.version, chunks });
    }

    /** Write to storage if anything changed since the last save. */
    save() {
        if (!this.dirty) return;
        try { this.storage?.setItem(this.key, this.serialize()); this.dirty = false; } catch { /* storage full or blocked */ }
    }

    /** Forget everything (a fresh journey). */
    reset() {
        this.chunks.clear();
        this.dirty = true;
        this.save();
    }
}
