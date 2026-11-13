/** Water surface height (world y) at world x and time t (seconds). Calm sea level is y = 0. */
export function waveY(x, t) {
    return Math.sin(x / 190 + t * 1.5) * 15 + Math.sin(x / 73 - t * 2.2) * 6 + Math.sin(x / 510 + t * 0.6) * 10;
}
