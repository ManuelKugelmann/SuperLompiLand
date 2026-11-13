// Parent gate (pure, unit-tested): a sum a grown-up solves at a glance and a
// young child usually cannot. Spec: before the first online join.

/** { a, b, answer, choices[4] } — a two-digit times one-digit product, four distinct choices. */
export function gateQuestion(random = Math.random) {
    const a = 12 + Math.floor(random() * 8);   // 12..19
    const b = 3 + Math.floor(random() * 6);    // 3..8
    const answer = a * b;
    const choices = new Set([answer]);
    const near = [a, b, 10, -a, -b, -10, 2 * b, -2 * b];
    let i = Math.floor(random() * near.length);
    while (choices.size < 4) {
        const c = answer + near[i % near.length];
        if (c > 0) choices.add(c);
        i++;
    }
    const list = [...choices];
    // Shuffle so the answer is not always first.
    for (let k = list.length - 1; k > 0; k--) {
        const j = Math.floor(random() * (k + 1));
        [list[k], list[j]] = [list[j], list[k]];
    }
    return { a, b, answer, choices: list };
}

const KEY = 'sll_parent_ok';
export function gatePassed(storage) {
    try { return storage?.getItem(KEY) === '1'; } catch { return false; }
}
export function rememberGate(storage) {
    try { storage?.setItem(KEY, '1'); } catch { /* storage blocked: ask again next time */ }
}
