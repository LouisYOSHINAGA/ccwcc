/**
 * kumiko.js — the geometry of a wooden lattice.
 *
 * Kumiko is joinery without nails: a coarse base grid (地組, jigumi) of thin
 * cypress strips, with smaller leaves slotted into it to make a pattern. Each
 * traditional pattern is a construction on a lattice, so each is a short
 * function here — a lattice, and what you draw inside one cell of it.
 *
 * Everything is produced as flat [x0,y0,x1,y1,...] polylines in plate
 * coordinates, generated across the whole section and then cut to it, which is
 * how the real thing works too: strips are cut to length at the frame.
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const ROOT3 = Math.sqrt(3);

  /* ---------------------------------------------------------------------- */
  /* clipping                                                                */
  /* ---------------------------------------------------------------------- */

  /** Liang-Barsky: clip one segment to a rect, or return null. */
  function clipSegment(x0, y0, x1, y1, r) {
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const p = [-dx, dx, -dy, dy];
    const q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) {
        if (q[i] < 0) return null;      // parallel to this edge, and outside
      } else {
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
        else { if (t < t0) return null; if (t < t1) t1 = t; }
      }
    }
    return [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1];
  }

  /**
   * Cut a polyline to a rect, returning the pieces that survive. A strip that
   * leaves and re-enters becomes two strips, exactly as it would on the bench.
   */
  function clipPolyline(pts, rect) {
    const pieces = [];
    let cur = null;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const seg = clipSegment(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], rect);
      if (!seg) { cur = null; continue; }
      if (cur && Math.abs(cur[cur.length - 2] - seg[0]) < 1e-6
              && Math.abs(cur[cur.length - 1] - seg[1]) < 1e-6) {
        cur.push(seg[2], seg[3]);
      } else {
        cur = [seg[0], seg[1], seg[2], seg[3]];
        pieces.push(cur);
      }
    }
    return pieces;
  }

  /* ---------------------------------------------------------------------- */
  /* patterns                                                                */
  /* ---------------------------------------------------------------------- */

  /** Round a pitch so a whole number of cells spans the section. */
  function fit(span, want) {
    return span / Math.max(1, Math.round(span / want));
  }

  /** Drop segments that are duplicates of one already emitted. */
  function deduped() {
    const seen = new Set();
    const out = [];
    return {
      add(x0, y0, x1, y1) {
        const a = `${Math.round(x0 * 8)},${Math.round(y0 * 8)}`;
        const b = `${Math.round(x1 * 8)},${Math.round(y1 * 8)}`;
        const key = a < b ? a + '|' + b : b + '|' + a;
        if (seen.has(key)) return;
        seen.add(key);
        out.push([x0, y0, x1, y1]);
      },
      lines: out,
    };
  }

  /**
   * 麻の葉 — hemp leaf. A triangular lattice, plus in every triangle a spoke
   * from each corner to the centroid. Six of those spokes meet at every
   * lattice point, which is the six-pointed star the pattern is named for.
   */
  function asanoha(rect, want) {
    const s = fit(rect.w, want);
    const h = (s * ROOT3) / 2;
    const cols = Math.ceil(rect.w / s) + 3;
    const rows = Math.ceil(rect.h / h) + 3;
    const d = deduped();
    const px = (i, j) => rect.x + i * s + (j & 1 ? s / 2 : 0) - s;
    const py = (j) => rect.y + j * h - h;

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const ax = px(i, j), ay = py(j);
        const bx = px(i + 1, j), by = py(j);
        const dn = j & 1 ? 1 : 0;
        const cx = px(i + dn, j + 1), cy = py(j + 1);
        const ex = px(i + dn - 1, j + 1), ey = py(j + 1);
        // the triangle pointing down, and the one pointing up
        for (const t of [[ax, ay, bx, by, cx, cy], [ax, ay, ex, ey, cx, cy]]) {
          const [x0, y0, x1, y1, x2, y2] = t;
          d.add(x0, y0, x1, y1);
          d.add(x1, y1, x2, y2);
          d.add(x2, y2, x0, y0);
          const gx = (x0 + x1 + x2) / 3;
          const gy = (y0 + y1 + y2) / 3;
          d.add(x0, y0, gx, gy);
          d.add(x1, y1, gx, gy);
          d.add(x2, y2, gx, gy);
        }
      }
    }
    return d.lines;
  }

  /**
   * 七宝 — seven treasures. Circles on a square lattice of pitch r*sqrt(2), so
   * each one cuts its four neighbours and the overlaps make the petals.
   */
  function shippou(rect, want) {
    const s = fit(rect.w, want);
    const r = s / Math.SQRT2;
    const lines = [];
    for (let j = -1; j * s < rect.h + s; j++) {
      for (let i = -1; i * s < rect.w + s; i++) {
        const cx = rect.x + i * s;
        const cy = rect.y + j * s;
        const pts = [];
        for (let k = 0; k <= 48; k++) {
          const a = (k / 48) * TAU;
          pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        lines.push(pts);
      }
    }
    return lines;
  }

  /** 三崩し — three broken. Triples of parallel strips, turned a quarter each block. */
  function sankuzushi(rect, want) {
    const s = fit(rect.w, want * 1.6);
    const lines = [];
    for (let j = -1; j * s < rect.h + s; j++) {
      for (let i = -1; i * s < rect.w + s; i++) {
        const x = rect.x + i * s;
        const y = rect.y + j * s;
        const vertical = ((i + j) & 1) === 0;
        for (let k = 1; k <= 3; k++) {
          const t = (k / 4) * s;
          lines.push(vertical ? [x + t, y, x + t, y + s] : [x, y + t, x + s, y + t]);
        }
        lines.push([x, y, x + s, y], [x, y, x, y + s]);
      }
    }
    return lines;
  }

  /** 胡麻殻 — sesame husk. A square grid with one diagonal per cell, alternating. */
  function gomagara(rect, want) {
    const s = fit(rect.w, want);
    const lines = [];
    for (let j = -1; j * s < rect.h + s; j++) {
      for (let i = -1; i * s < rect.w + s; i++) {
        const x = rect.x + i * s;
        const y = rect.y + j * s;
        lines.push([x, y, x + s, y], [x, y, x, y + s]);
        lines.push(((i + j) & 1)
          ? [x, y, x + s, y + s]
          : [x + s, y, x, y + s]);
      }
    }
    return lines;
  }

  /** 井桁 — well curb. Paired strips crossing, the shape of the character 井. */
  function igeta(rect, want) {
    const s = fit(rect.w, want * 1.35);
    const g = s * 0.30;
    const lines = [];
    for (let i = -1; i * s < rect.w + s; i++) {
      const x = rect.x + i * s;
      lines.push([x - g, rect.y - s, x - g, rect.y + rect.h + s]);
      lines.push([x + g, rect.y - s, x + g, rect.y + rect.h + s]);
    }
    for (let j = -1; j * s < rect.h + s; j++) {
      const y = rect.y + j * s;
      lines.push([rect.x - s, y - g, rect.x + rect.w + s, y - g]);
      lines.push([rect.x - s, y + g, rect.x + rect.w + s, y + g]);
    }
    return lines;
  }

  /** 菱 — diamond. Two families of parallel strips, leaning against each other. */
  function hishi(rect, want) {
    const s = fit(rect.w, want);
    const lines = [];
    const span = rect.w + rect.h + s * 2;
    const slope = 1.7;
    for (let k = -Math.ceil(span / s); k * s < span; k++) {
      const c = k * s;
      lines.push([rect.x + c - rect.h / slope, rect.y - s,
                  rect.x + c + (rect.h + s) / slope, rect.y + rect.h + s]);
      lines.push([rect.x + c + rect.h / slope, rect.y - s,
                  rect.x + c - (rect.h + s) / slope, rect.y + rect.h + s]);
    }
    return lines;
  }

  /** 枡 — measuring box. Squares with a square set diagonally inside. */
  function masu(rect, want) {
    const s = fit(rect.w, want * 1.2);
    const lines = [];
    for (let j = -1; j * s < rect.h + s; j++) {
      for (let i = -1; i * s < rect.w + s; i++) {
        const x = rect.x + i * s;
        const y = rect.y + j * s;
        lines.push([x, y, x + s, y], [x, y, x, y + s]);
        const m = s / 2;
        lines.push([x + m, y, x + s, y + m, x + m, y + s, x, y + m, x + m, y]);
      }
    }
    return lines;
  }

  const MOTIFS = [
    // `pitch` is the cell size as a fraction of the section's short side, so
    // 0.10 is ten cells across it. Coarser than about a sixth and the pattern
    // stops being kumiko and becomes a window frame.
    { id: 'asanoha', ja: '麻の葉', roman: 'ASANOHA', fn: asanoha, pitch: [0.10, 0.19], weight: 5 },
    { id: 'shippou', ja: '七宝', roman: 'SHIPPŌ', fn: shippou, pitch: [0.11, 0.20], weight: 3 },
    { id: 'sankuzushi', ja: '三崩し', roman: 'SANKUZUSHI', fn: sankuzushi, pitch: [0.13, 0.23], weight: 2 },
    { id: 'gomagara', ja: '胡麻殻', roman: 'GOMAGARA', fn: gomagara, pitch: [0.09, 0.17], weight: 3 },
    { id: 'igeta', ja: '井桁', roman: 'IGETA', fn: igeta, pitch: [0.12, 0.21], weight: 2 },
    { id: 'hishi', ja: '菱', roman: 'HISHI', fn: hishi, pitch: [0.09, 0.17], weight: 2 },
    { id: 'masu', ja: '枡', roman: 'MASU', fn: masu, pitch: [0.11, 0.20], weight: 2 },
  ];

  /* ---------------------------------------------------------------------- */
  /* the panel                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Divide the panel the way a shoji is divided: guillotine cuts at ratios
   * that are never a half, so no two sections are the same size.
   */
  function split(rng, rect, leaves) {
    let rects = [rect];
    const ratios = [0.382, 0.44, 0.58, 0.618, 0.34, 0.66];
    while (rects.length < leaves) {
      // always cut the largest remaining section, so nothing ends up a sliver
      let bi = 0;
      for (let i = 1; i < rects.length; i++) {
        if (rects[i].w * rects[i].h > rects[bi].w * rects[bi].h) bi = i;
      }
      const r = rects[bi];
      const horizontal = r.w < r.h ? rng.bool(0.82) : rng.bool(0.18);
      const t = rng.pick(ratios);
      const a = horizontal
        ? { x: r.x, y: r.y, w: r.w, h: r.h * t }
        : { x: r.x, y: r.y, w: r.w * t, h: r.h };
      const b = horizontal
        ? { x: r.x, y: r.y + r.h * t, w: r.w, h: r.h * (1 - t) }
        : { x: r.x + r.w * t, y: r.y, w: r.w * (1 - t), h: r.h };
      if (Math.min(a.w, a.h, b.w, b.h) < Math.min(rect.w, rect.h) * 0.12) break;
      rects.splice(bi, 1, a, b);
    }
    return rects;
  }

  global.Kumiko = { MOTIFS, split, clipPolyline, fit };
})(window);
