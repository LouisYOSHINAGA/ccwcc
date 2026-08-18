/**
 * sekka.js — growing a snow crystal.
 *
 * Clifford Reiter's model (2005) on a hexagonal lattice. Each cell holds an
 * amount of water. A cell is *receptive* if it is frozen, or touches something
 * frozen; its water is taken out of circulation and can only be added to. All
 * the other water diffuses. Every step:
 *
 *     u = the water in non-receptive cells        (free to move)
 *     v = the water in receptive cells            (locked into the crystal)
 *     u ← u + (α/2)(mean of the six neighbours − u)
 *     v ← v + γ   for receptive cells
 *
 * Three constants — α how fast vapour diffuses, β how much there is to begin
 * with, γ how fast it deposits — and out of that comes the whole morphology
 * diagram: plates, sectored plates, stellar dendrites, needles. Nothing about
 * six-fold symmetry is written down anywhere. It is a consequence of starting
 * from one frozen cell on a lattice that has it.
 *
 * Axial coordinates (q, r) on a flat-topped hex grid, stored in a square array
 * with a margin of fixed cells around the hexagon that act as the reservoir.
 */
(function (global) {
  'use strict';

  /** Hex distance from the origin in axial coordinates. */
  function hexDist(q, r) {
    return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
  }

  /**
   * @param {object} o
   * @param {number} o.radius  crystal radius in cells
   * @param {number} o.alpha   diffusion rate
   * @param {number} o.beta    background vapour
   * @param {number} o.gamma   deposition per step
   * @param {number} o.maxSteps
   * @param {number} [o.stopExtent] stop once the crystal reaches this radius
   *   in cells. Branching is a diffusive instability: it needs a vapour
   *   gradient to develop, and if the reservoir at the rim is close enough to
   *   keep feeding the tips and the notches equally, the crystal fills in as
   *   a featureless plate. Leaving most of the grid empty is not waste — it
   *   is the difference between a snowflake and a hexagon.
   * @returns {{cells: Array, extent: number, steps: number}} frozen cells in
   *   the order they froze, and how far the crystal reached
   */
  function grow(o) {
    const R = o.radius;
    const N = 2 * R + 3;
    const c = R + 1;                       // index of the origin
    const size = N * N;
    const s = new Float32Array(size);
    const u = new Float32Array(size);
    const rec = new Uint8Array(size);
    const froze = new Int32Array(size).fill(-1);
    // the six axial neighbours, as flat offsets
    const nb = [1, -1, N, -N, 1 - N, -1 + N];

    // Interior cells evolve; everything beyond the rim is held at beta and
    // feeds the crystal, so growth never notices the edge of the array.
    const interior = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        s[j * N + i] = o.beta;
        if (hexDist(i - c, j - c) <= R - 1) interior.push(j * N + i);
      }
    }
    const seed = c * N + c;
    s[seed] = 1;
    froze[seed] = 0;

    const half = o.alpha / 2;
    let overrunning = false;
    const stopAt = o.stopExtent ?? R * 0.94;
    let steps = 0;
    let extent = 0;
    let endStep = o.maxSteps;

    for (let step = 1; step <= endStep; step++) {
      steps = step;
      // pass 1: who is receptive, and split the water accordingly
      for (let k = 0; k < interior.length; k++) {
        const idx = interior[k];
        let r = s[idx] >= 1 ? 1 : 0;
        if (!r) {
          for (let n = 0; n < 6; n++) {
            if (s[idx + nb[n]] >= 1) { r = 1; break; }
          }
        }
        rec[idx] = r;
        u[idx] = r ? 0 : s[idx];
      }
      // pass 2: diffuse the free water, deposit onto the crystal
      let reached = false;
      for (let k = 0; k < interior.length; k++) {
        const idx = interior[k];
        const mean = (u[idx + nb[0]] + u[idx + nb[1]] + u[idx + nb[2]] +
                      u[idx + nb[3]] + u[idx + nb[4]] + u[idx + nb[5]]) / 6;
        const un = u[idx] + half * (mean - u[idx]);
        const vn = rec[idx] ? s[idx] + o.gamma : 0;
        const next = un + vn;
        s[idx] = next;
        if (next >= 1 && froze[idx] < 0) {
          froze[idx] = step;
          const d = hexDist((idx % N) - c, ((idx / N) | 0) - c);
          if (d > extent) extent = d;
          if (d >= stopAt) reached = true;
        }
      }
      // The tips have arrived. Fix the finish line once, here — recomputing
      // it on every later step would push it away as fast as we approach it.
      if (reached && !overrunning) {
        overrunning = true;
        endStep = Math.min(o.maxSteps, Math.round(step * (1 + (o.overrun ?? 0))));
      }
      if (overrunning && step >= endStep) break;
    }

    const cells = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const idx = j * N + i;
        if (froze[idx] < 0) continue;
        cells.push({ q: i - c, r: j - c, t: froze[idx], s: s[idx] });
      }
    }
    cells.sort((a, b) => a.t - b.t);
    return { cells, extent: Math.max(1, extent), steps };
  }

  /**
   * Where a cell sits, for a flat-topped hex of the given size. The lattice is
   * hexagonal, not round, so the scale that makes a crystal fit a circle is
   * set by its longest axis — sqrt(3) times the radius in cells.
   */
  function position(q, r, size) {
    return [size * 1.5 * q, size * Math.sqrt(3) * (r + q / 2)];
  }

  function scaleToFit(extent, pixelRadius) {
    return pixelRadius / (extent * Math.sqrt(3));
  }

  global.Sekka = { grow, position, scaleToFit, hexDist };
})(window);
