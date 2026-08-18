/**
 * fracture.js — breaking a plate, and putting it back.
 *
 * A dropped ceramic does not craze into a Voronoi diagram. It fails from the
 * point of impact: radial cracks run outward first, then circumferential ones
 * cross between them, and the shards you sweep up are wedges and blocks. So
 * the break is generated in those two phases — radial lines through one point,
 * then chords laid across the sectors they leave.
 *
 * Shards are kept as straight-edged convex polygons, which half-plane clipping
 * preserves, and the jaggedness is put back at drawing time by a crack
 * function seeded from the edge's own endpoints. Two shards that share an edge
 * therefore generate exactly the same ragged line for it, without having to
 * share any data — which is what lets the pieces still fit together.
 */
(function (global) {
  'use strict';

  function area(p) {
    let a = 0;
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length;
      a += p[i] * p[j + 1] - p[j] * p[i + 1];
    }
    return Math.abs(a) / 2;
  }

  function centroid(p) {
    let x = 0, y = 0;
    const n = p.length / 2;
    for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; }
    return [x / n, y / n];
  }

  /** Sutherland-Hodgman against one half-plane: keep n·(p − p0) ≤ 0. */
  function clipHalf(p, nx, ny, px, py) {
    const out = [];
    const n = p.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = p[i * 2], ay = p[i * 2 + 1];
      const bx = p[((i + 1) % n) * 2], by = p[((i + 1) % n) * 2 + 1];
      const da = (ax - px) * nx + (ay - py) * ny;
      const db = (bx - px) * nx + (by - py) * ny;
      if (da <= 0) out.push(ax, ay);
      if ((da <= 0) !== (db <= 0)) {
        const t = da / (da - db);
        out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
      }
    }
    return out;
  }

  /** Both sides of a line through (px, py) at `angle`. */
  function split(poly, px, py, angle) {
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    return [clipHalf(poly, nx, ny, px, py), clipHalf(poly, -nx, -ny, px, py)];
  }

  /**
   * @param {object} o
   * @param {number[]} o.outline  the whole, unbroken piece
   * @param {number[]} o.impact   where it was struck
   * @param {number} o.radial     radial cracks; they leave 2n sectors
   * @param {number} o.extra      chords laid across the sectors afterwards
   * @param {number} [o.jitter]   how far each radial crack misses the impact
   *   point by. Sending every one through exactly the same point turns the
   *   break into a wheel; real cracks start near each other, not on top of
   *   each other.
   * @param {number} o.minArea    below this a sliver is not a shard
   */
  function shatter(rng, o) {
    let shards = [o.outline];

    // Radial: each crack runs right across the piece, so it is applied to
    // every shard it happens to cross rather than to one chosen victim.
    const base = rng.float(Math.PI);
    for (let k = 0; k < o.radial; k++) {
      const angle = base + (k / o.radial) * Math.PI + rng.gauss(0, 0.22);
      const j = o.jitter ?? 0;
      const ox = o.impact[0] + rng.gauss(0, j);
      const oy = o.impact[1] + rng.gauss(0, j);
      const next = [];
      for (const s of shards) {
        const [a, b] = split(s, ox, oy, angle);
        for (const half of [a, b]) {
          if (half.length >= 6 && area(half) > o.minArea) next.push(half);
        }
      }
      shards = next;
    }

    // Circumferential: a chord across one sector, square to the direction the
    // crack came from, which is how the second family of cracks actually runs.
    for (let k = 0; k < o.extra; k++) {
      let bi = 0;
      let best = -1;
      for (let tries = 0; tries < 4; tries++) {
        const i = rng.int(shards.length - 1);
        const a = area(shards[i]);
        if (a > best) { best = a; bi = i; }
      }
      const poly = shards[bi];
      const [cx, cy] = centroid(poly);
      const radial = Math.atan2(cy - o.impact[1], cx - o.impact[0]);
      const angle = radial + Math.PI / 2 + rng.gauss(0, 0.35);
      const jitter = Math.sqrt(best) * 0.18;
      const [a, b] = split(poly, cx + rng.gauss(0, jitter), cy + rng.gauss(0, jitter), angle);
      if (a.length >= 6 && b.length >= 6 && area(a) > o.minArea && area(b) > o.minArea) {
        shards.splice(bi, 1, a, b);
      }
    }
    return shards;
  }

  /* ---------------------------------------------------------------------- */

  /** Canonical name for an undirected edge, so both shards agree on it. */
  function edgeKey(x0, y0, x1, y1) {
    const a = `${Math.round(x0 * 4)},${Math.round(y0 * 4)}`;
    const b = `${Math.round(x1 * 4)},${Math.round(y1 * 4)}`;
    return a < b ? a + '|' + b : b + '|' + a;
  }

  /**
   * The ragged line an actual break leaves, by midpoint displacement. Seeded
   * from the edge key, so the two shards either side of a crack produce the
   * identical line and still fit.
   */
  function crackEdge(x0, y0, x1, y1, amp) {
    const key = edgeKey(x0, y0, x1, y1);
    const flip = `${Math.round(x0 * 4)},${Math.round(y0 * 4)}` > `${Math.round(x1 * 4)},${Math.round(y1 * 4)}`;
    const [ax, ay, bx, by] = flip ? [x1, y1, x0, y0] : [x0, y0, x1, y1];
    const rng = new Rng('crack:' + key);

    let pts = [ax, ay, bx, by];
    const len = Math.hypot(bx - ax, by - ay);
    const levels = Math.max(1, Math.min(5, Math.round(Math.log2(len / 7))));
    let a = amp;
    for (let l = 0; l < levels; l++) {
      const next = [pts[0], pts[1]];
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const px = pts[i], py = pts[i + 1];
        const qx = pts[i + 2], qy = pts[i + 3];
        const dx = qx - px, dy = qy - py;
        const d = Math.hypot(dx, dy) || 1;
        const off = rng.gauss(0, a);
        next.push((px + qx) / 2 - (dy / d) * off, (py + qy) / 2 + (dx / d) * off);
        next.push(qx, qy);
      }
      pts = next;
      a *= 0.52;
    }
    if (flip) {
      const rev = [];
      for (let i = pts.length - 2; i >= 0; i -= 2) rev.push(pts[i], pts[i + 1]);
      return rev;
    }
    return pts;
  }

  /** A shard's outline, with every edge cracked (or left smooth on the rim). */
  function raggedOutline(poly, amp, isRim) {
    const out = [];
    const n = poly.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = poly[i * 2], ay = poly[i * 2 + 1];
      const bx = poly[((i + 1) % n) * 2], by = poly[((i + 1) % n) * 2 + 1];
      if (isRim(ax, ay, bx, by)) {
        out.push(ax, ay);
      } else {
        const e = crackEdge(ax, ay, bx, by, amp);
        for (let k = 0; k < e.length - 2; k += 2) out.push(e[k], e[k + 1]);
      }
    }
    return out;
  }

  global.Fracture = { area, centroid, split, shatter, edgeKey, crackEdge, raggedOutline };
})(window);
