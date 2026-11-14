// The places in a shared picture atlas (pure, no Phaser): a grid of equal cells, handed out and
// taken back. All chunk pictures of one kind live in one big texture, so they are drawn in one go
// (each texture of its own is a draw call of its own under the caustics shader).

/**
 * @param cols, rows  cells across and down
 * @param cell        px a cell is wide and tall
 * Returns { size: { w, h }, free (count), take() -> index or null, give(index), at(index) -> { x, y } (its top left, px), reset() }.
 */
export function createSlots(cols, rows, cell) {
    let spare = [];
    const reset = () => { spare = Array.from({ length: cols * rows }, (_, i) => cols * rows - 1 - i); };
    reset();
    return {
        size: { w: cols * cell, h: rows * cell },
        get free() { return spare.length; },
        take: () => (spare.length ? spare.pop() : null),
        give(i) { if (i !== null && i >= 0 && i < cols * rows && !spare.includes(i)) spare.push(i); },
        at: i => ({ x: (i % cols) * cell, y: Math.floor(i / cols) * cell }),
        reset
    };
}

/** How many cells a side an atlas for `count` pictures needs (square, the smallest that holds them). */
export function gridFor(count) {
    return Math.ceil(Math.sqrt(count));
}
