/**
 * contours.js — level sets of a sampled scalar field, as joined polylines.
 *
 * Marching squares gives you a heap of disconnected two-point segments, which
 * is useless if you want to *draw* a contour: a stroke has to know where the
 * line starts and ends to taper it, offset it, or vary its weight along the
 * way. So the segments are stitched back into ordered polylines here.
 *
 * The stitching keys on grid edge indices rather than on coordinates. Two
 * neighbouring cells interpolate the same crossing point on their shared edge,
 * but comparing the resulting floats is asking for trouble; the edge each
 * point lies on is an exact integer, and every point is on exactly one.
 */
(function (global) {
  'use strict';

  // For each of the 16 corner sign patterns, the pairs of cell edges a contour
  // segment runs between. Edges: 0 top, 1 right, 2 bottom, 3 left.
  // Cases 5 and 10 are the saddles and are resolved separately.
  const CASES = [
    [], [[3, 0]], [[0, 1]], [[3, 1]],
    [[1, 2]], null, [[0, 2]], [[3, 2]],
    [[2, 3]], [[2, 0]], null, [[2, 1]],
    [[1, 3]], [[1, 0]], [[0, 3]], [],
  ];

  /**
   * @param {Float32Array|number[]} f  field sampled on a w x h grid, row-major
   * @param {number} w
   * @param {number} h
   * @param {number[]} levels  values to extract, any order
   * @returns {{level:number, lines:number[][]}[]} polylines in grid coordinates
   *   (multiply by your sample spacing), each a flat [x0,y0,x1,y1,...]
   */
  function trace(f, w, h, levels) {
    const hCount = (w - 1) * h;
    const sorted = levels.slice().sort((a, b) => a - b);
    // Per level: parallel arrays of segment endpoints and the edges they sit on
    const buckets = sorted.map(() => ({ ax: [], ay: [], bx: [], by: [], ae: [], be: [] }));

    // Levels are sorted, so the ones a cell spans are a contiguous run and can
    // be found by binary search on the cell's own min and max.
    const lo = (v) => {
      let a = 0, b = sorted.length;
      while (a < b) { const m = (a + b) >> 1; if (sorted[m] < v) a = m + 1; else b = m; }
      return a;
    };

    for (let j = 0; j < h - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const i0 = j * w + i;
        const v0 = f[i0];
        const v1 = f[i0 + 1];
        const v2 = f[i0 + w + 1];
        const v3 = f[i0 + w];
        let mn = v0, mx = v0;
        if (v1 < mn) mn = v1; else if (v1 > mx) mx = v1;
        if (v2 < mn) mn = v2; else if (v2 > mx) mx = v2;
        if (v3 < mn) mn = v3; else if (v3 > mx) mx = v3;

        for (let li = lo(mn); li < sorted.length && sorted[li] <= mx; li++) {
          const level = sorted[li];
          const c =
            (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) |
            (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
          let pairs = CASES[c];
          if (pairs === null) {
            // Saddle: the cell centre decides which way the two branches join.
            const centre = (v0 + v1 + v2 + v3) * 0.25;
            if (c === 5) pairs = centre > level ? [[3, 0], [1, 2]] : [[3, 2], [0, 1]];
            else pairs = centre > level ? [[2, 1], [0, 3]] : [[2, 3], [0, 1]];
          }
          if (pairs.length === 0) continue;

          const b = buckets[li];
          for (const [e0, e1] of pairs) {
            pushPoint(b, 'a', e0, i, j, v0, v1, v2, v3, level, w, hCount);
            pushPoint(b, 'b', e1, i, j, v0, v1, v2, v3, level, w, hCount);
          }
        }
      }
    }

    return sorted.map((level, li) => ({ level, lines: stitch(buckets[li]) }));
  }

  /** Interpolate the crossing on one edge of one cell and record it. */
  function pushPoint(b, which, edge, i, j, v0, v1, v2, v3, level, w, hCount) {
    let x, y, id;
    if (edge === 0) {
      x = i + frac(v0, v1, level); y = j;
      id = j * (w - 1) + i;
    } else if (edge === 2) {
      x = i + frac(v3, v2, level); y = j + 1;
      id = (j + 1) * (w - 1) + i;
    } else if (edge === 3) {
      x = i; y = j + frac(v0, v3, level);
      id = hCount + j * w + i;
    } else {
      x = i + 1; y = j + frac(v1, v2, level);
      id = hCount + j * w + i + 1;
    }
    b[which + 'x'].push(x);
    b[which + 'y'].push(y);
    b[which + 'e'].push(id);
  }

  function frac(a, c, level) {
    const d = c - a;
    // A flat edge cannot be crossed; splitting it down the middle keeps the
    // topology consistent with the neighbouring cell, which sees the same two
    // values and makes the same choice.
    return d === 0 ? 0.5 : (level - a) / d;
  }

  /** Walk the segment soup into ordered polylines. */
  function stitch(b) {
    const n = b.ae.length;
    /** edge id -> the (at most two) segments touching it */
    const byEdge = new Map();
    const add = (edge, seg) => {
      const cur = byEdge.get(edge);
      if (cur === undefined) byEdge.set(edge, seg);
      else if (typeof cur === 'number') byEdge.set(edge, [cur, seg]);
      else cur.push(seg);
    };
    for (let s = 0; s < n; s++) { add(b.ae[s], s); add(b.be[s], s); }

    const used = new Uint8Array(n);
    const lines = [];

    const other = (edge, seg) => {
      const cur = byEdge.get(edge);
      if (cur === undefined) return -1;
      if (typeof cur === 'number') return cur === seg ? -1 : cur;
      for (const s of cur) if (s !== seg && !used[s]) return s;
      return -1;
    };

    /** Follow the chain from one end of one segment, appending as we go. */
    const walk = (seed, forward) => {
      const pts = [];
      let seg = seed;
      // start at the tail we are walking away from
      let fromA = forward;
      pts.push(fromA ? b.ax[seg] : b.bx[seg], fromA ? b.ay[seg] : b.by[seg]);
      while (seg !== -1 && !used[seg]) {
        used[seg] = 1;
        const headEdge = fromA ? b.be[seg] : b.ae[seg];
        pts.push(fromA ? b.bx[seg] : b.ax[seg], fromA ? b.by[seg] : b.ay[seg]);
        const next = other(headEdge, seg);
        if (next === -1) break;
        fromA = b.ae[next] === headEdge;
        seg = next;
      }
      return pts;
    };

    // Open chains first, so their ends are not swallowed mid-loop: a segment
    // whose edge is shared with no other is a genuine end of a contour.
    for (let s = 0; s < n; s++) {
      if (used[s]) continue;
      const openA = other(b.ae[s], s) === -1;
      const openB = other(b.be[s], s) === -1;
      if (!openA && !openB) continue;
      const line = walk(s, openA);
      if (line.length >= 4) lines.push(line);
    }
    // Anything left is a closed loop.
    for (let s = 0; s < n; s++) {
      if (used[s]) continue;
      const line = walk(s, true);
      if (line.length >= 6) {
        line.push(line[0], line[1]);
        lines.push(line);
      }
    }
    return lines;
  }

  /**
   * Chaikin corner cutting. Marching squares output is faceted at the grid
   * scale; two passes of this and it reads as a drawn line.
   */
  function smooth(pts, iterations = 2) {
    let cur = pts;
    for (let it = 0; it < iterations; it++) {
      const out = [cur[0], cur[1]];
      for (let i = 0; i + 3 < cur.length; i += 2) {
        const x0 = cur[i], y0 = cur[i + 1];
        const x1 = cur[i + 2], y1 = cur[i + 3];
        out.push(x0 + (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.25);
        out.push(x0 + (x1 - x0) * 0.75, y0 + (y1 - y0) * 0.75);
      }
      out.push(cur[cur.length - 2], cur[cur.length - 1]);
      cur = out;
    }
    return cur;
  }

  global.Contours = { trace, smooth };
})(window);
