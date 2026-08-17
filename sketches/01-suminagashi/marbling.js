/**
 * marbling.js — the physics of floating ink.
 *
 * Suminagashi (墨流し, "flowing ink") is made by touching a brush of ink to
 * still water. The drop spreads into a disc and, in doing so, pushes every
 * older ring outward. Because water is (near enough) incompressible and the
 * film is thin, that push is an exact, area-preserving map: a point at
 * distance d from a new drop of radius r moves to
 *
 *     d' = sqrt(d^2 + r^2)
 *
 * so nothing is lost, only rearranged. Combing the surface — dragging a
 * needle or a rake through it — is the second operation, a displacement that
 * decays exponentially with distance from the line of travel.
 *
 * Both are from A. Jaffer, "Marbling Mathematics" (2013). Everything drawn by
 * this sketch is those two maps, applied in some order, to circles.
 *
 * Geometry is kept as flat [x0, y0, x1, y1, ...] arrays: one closed polygon
 * per drop, in the order the drops were made.
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;

  class Ring {
    constructor(pts, style) {
      /** @type {number[]} flat x,y pairs, implicitly closed */
      this.pts = pts;
      this.style = style;
      /** Set once a ring has been pushed entirely off the plate. */
      this.dead = false;
    }
  }

  class Marbling {
    /**
     * @param {object} opts
     * @param {number} opts.width   plate width, used to retire off-plate rings
     * @param {number} opts.height  plate height
     * @param {number} [opts.maxSeg] target edge length before an edge is split
     * @param {number} [opts.maxPoints] soft budget; maxSeg relaxes past it
     */
    constructor(opts) {
      this.w = opts.width;
      this.h = opts.height;
      this.maxSeg = opts.maxSeg ?? 2.4;
      this.maxPoints = opts.maxPoints ?? 220000;
      /** How far outside the plate a ring may stray before it is retired. */
      this.margin = opts.margin ?? Math.max(this.w, this.h) * 0.12;
      this.rings = [];
      this.points = 0;
    }

    /* ------------------------------------------------------------------ */
    /* operations                                                          */
    /* ------------------------------------------------------------------ */

    /**
     * Drop ink of radius r at (cx, cy). Displaces every existing point, then
     * appends the new disc on top.
     */
    drop(cx, cy, r, style, wobble) {
      const rr = r * r;
      for (const ring of this.rings) {
        if (ring.dead) continue;
        const p = ring.pts;
        for (let i = 0; i < p.length; i += 2) {
          const dx = p[i] - cx;
          const dy = p[i + 1] - cy;
          const d2 = dx * dx + dy * dy;
          // sqrt(1 + r^2/d^2) is the scale factor that maps d -> sqrt(d^2+r^2)
          const m = Math.sqrt(1 + rr / (d2 > 1e-9 ? d2 : 1e-9));
          p[i] = cx + dx * m;
          p[i + 1] = cy + dy * m;
        }
      }
      const n = Math.max(64, Math.min(900, Math.round((TAU * r) / this.maxSeg)));
      const pts = new Array(n * 2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        // `wobble` is a list of [amplitude, harmonic, phase]: a brush never
        // lays down a true circle, and the difference is what stops a stack
        // of these from looking machined.
        let rad = r;
        if (wobble) {
          for (let k = 0; k < wobble.length; k++) {
            const [amp, freq, phase] = wobble[k];
            rad += r * amp * Math.sin(a * freq + phase);
          }
        }
        pts[i * 2] = cx + Math.cos(a) * rad;
        pts[i * 2 + 1] = cy + Math.sin(a) * rad;
      }
      this.rings.push(new Ring(pts, style));
      this.refine();
      return this;
    }

    /**
     * Comb the surface: everything is dragged along `u`, by `amount` at the
     * line itself, decaying by `decay` per pixel of distance from it.
     *
     * `wave` bends the line into a sinusoid before measuring that distance,
     * which is what produces the feathered, plumed edges of a real comb pull.
     *
     * @param {object} o
     * @param {number[]} o.base   a point on the line [x, y]
     * @param {number} o.angle    direction of travel, radians
     * @param {number} o.amount   displacement at the line, px
     * @param {number} o.decay    per-pixel falloff, ~0.95-0.995
     * @param {number} [o.wave]   amplitude of the sinusoidal bend, px
     * @param {number} [o.period] wavelength of that bend, px
     * @param {number} [o.phase]
     */
    comb(o) {
      const ux = Math.cos(o.angle);
      const uy = Math.sin(o.angle);
      const nx = -uy;      // unit normal
      const ny = ux;
      const bx = o.base[0];
      const by = o.base[1];
      const amount = o.amount;
      const logDecay = Math.log(o.decay);
      const wave = o.wave ?? 0;
      const k = o.period ? TAU / o.period : 0;
      const phase = o.phase ?? 0;

      for (const ring of this.rings) {
        if (ring.dead) continue;
        const p = ring.pts;
        for (let i = 0; i < p.length; i += 2) {
          const rx = p[i] - bx;
          const ry = p[i + 1] - by;
          let d = rx * nx + ry * ny;                 // signed distance to line
          if (wave) {
            const t = rx * ux + ry * uy;             // position along the line
            d -= wave * Math.sin(t * k + phase);
          }
          const s = amount * Math.exp(logDecay * Math.abs(d));
          p[i] += ux * s;
          p[i + 1] += uy * s;
        }
      }
      this.refine();
      return this;
    }

    /**
     * Stir: rotate the sheet about (cx, cy) by `strength` radians at the
     * centre, falling off as a Gaussian of radius `radius`.
     */
    stir(cx, cy, radius, strength) {
      const inv = 1 / (radius * radius);
      for (const ring of this.rings) {
        if (ring.dead) continue;
        const p = ring.pts;
        for (let i = 0; i < p.length; i += 2) {
          const dx = p[i] - cx;
          const dy = p[i + 1] - cy;
          const a = strength * Math.exp(-(dx * dx + dy * dy) * inv);
          if (a > -1e-4 && a < 1e-4) continue;
          const c = Math.cos(a);
          const s = Math.sin(a);
          p[i] = cx + dx * c - dy * s;
          p[i + 1] = cy + dx * s + dy * c;
        }
      }
      this.refine();
      return this;
    }

    /**
     * Breathe: a smooth divergence-free wobble from two sine fields. Used at
     * low amplitude to take the machine-perfection off the circles.
     */
    breathe(scale, amount, phase = 0) {
      const k = TAU / scale;
      for (const ring of this.rings) {
        if (ring.dead) continue;
        const p = ring.pts;
        for (let i = 0; i < p.length; i += 2) {
          const x = p[i];
          const y = p[i + 1];
          p[i] += amount * Math.sin(y * k + phase);
          p[i + 1] += amount * Math.sin(x * k * 0.87 - phase * 1.3);
        }
      }
      return this;
    }

    /* ------------------------------------------------------------------ */
    /* upkeep                                                              */
    /* ------------------------------------------------------------------ */

    /**
     * Rings stretch as they are pushed outward, so edges are split to keep
     * curves smooth; rings that have left the plate entirely are retired.
     * Past the point budget the target edge length is relaxed instead of
     * refusing to subdivide, so shapes stay closed rather than going faceted
     * in one place and smooth in another.
     */
    refine() {
      const seg = this.points > this.maxPoints
        ? this.maxSeg * (1 + (this.points - this.maxPoints) / this.maxPoints)
        : this.maxSeg;
      const segSq = seg * seg;
      const lo = -this.margin;
      const hiX = this.w + this.margin;
      const hiY = this.h + this.margin;
      let total = 0;

      for (const ring of this.rings) {
        if (ring.dead) continue;
        const p = ring.pts;
        const n = p.length;
        const out = [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (let i = 0; i < n; i += 2) {
          const x0 = p[i];
          const y0 = p[i + 1];
          const j = (i + 2) % n;
          const x1 = p[j];
          const y1 = p[j + 1];
          if (x0 < minX) minX = x0;
          if (x0 > maxX) maxX = x0;
          if (y0 < minY) minY = y0;
          if (y0 > maxY) maxY = y0;

          out.push(x0, y0);
          const dx = x1 - x0;
          const dy = y1 - y0;
          const d2 = dx * dx + dy * dy;
          if (d2 > segSq) {
            const k = Math.min(24, Math.ceil(Math.sqrt(d2) / seg));
            for (let s = 1; s < k; s++) {
              const t = s / k;
              out.push(x0 + dx * t, y0 + dy * t);
            }
          }
        }

        // Entirely off the plate, or collapsed to nothing: stop paying for it.
        if (minX > hiX || maxX < lo || minY > hiY || maxY < lo) {
          ring.dead = true;
          ring.pts = null;
          continue;
        }
        ring.pts = out;
        total += out.length >> 1;
      }
      this.points = total;
      return this;
    }

    /** Rings still on the plate, oldest first (drawing order). */
    live() {
      return this.rings.filter((r) => !r.dead);
    }
  }

  global.Marbling = Marbling;
})(window);
