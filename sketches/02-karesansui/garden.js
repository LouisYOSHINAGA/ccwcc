/**
 * garden.js — the geometry of a dry garden.
 *
 * A karesansui is raked from the stones outward and from the edge inward, and
 * the two patterns meet wherever they happen to meet. That is exactly a level
 * set: if φ(p) is the distance from p to the nearest *thing already there* —
 * a stone, or the edge the gardener started from — then the furrows are the
 * contours of φ at one rake-width apart. Rings around the stones, straight
 * lines in the open, and a seam between them that falls where it falls.
 *
 * So the whole pattern comes from one scalar field, and the only real decisions
 * are where the stones go and how the field is combined.
 */
(function (global) {
  'use strict';

  /**
   * Polynomial smooth minimum. A hard min() creases where two sources meet;
   * real gravel cannot hold a crease, so the seam gets a radius of k.
   */
  function smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }

  /**
   * A garden stone. Star-shaped about its centre, so its outline and its
   * distance function come from the same radial profile and cannot disagree.
   */
  class Stone {
    /**
     * @param {object} o
     * @param {number} o.r       nominal radius
     * @param {number} o.aspect  ratio of the short axis to the long one
     * @param {number} o.tilt    direction of the long axis
     * @param {Array<number[]>} o.harm  [amplitude, harmonic, phase] triples
     * @param {number} [o.buried] how much of the stone sits below the gravel
     */
    constructor(o) {
      this.x = o.x;
      this.y = o.y;
      this.r = o.r;
      this.aspect = o.aspect;
      this.tilt = o.tilt;
      this.harm = o.harm;
      this.buried = o.buried ?? 0.2;
      // Over this distance the rings forget the stone's outline and relax to
      // circles, the way a gardener's rings do a few passes out.
      this.falloff = o.falloff ?? o.r * 2.4;
    }

    /** Radial profile: an ellipse, roughened by a few harmonics. */
    shape(theta) {
      const t = theta - this.tilt;
      const c = Math.cos(t);
      const s = Math.sin(t);
      let f = 1 / Math.sqrt(c * c + (s * s) / (this.aspect * this.aspect));
      for (let i = 0; i < this.harm.length; i++) {
        const [a, k, p] = this.harm[i];
        f *= 1 + a * Math.sin(k * t + p);
      }
      return f;
    }

    /** Signed distance-ish: 0 on the outline, negative inside. */
    distance(px, py) {
      const dx = px - this.x;
      const dy = py - this.y;
      const rho = Math.sqrt(dx * dx + dy * dy);
      // Far out the profile has fully relaxed, so skip the expensive part.
      if (rho > this.r + this.falloff) return rho - this.r;
      const sh = this.shape(Math.atan2(dy, dx));
      const t = Math.min(1, Math.max(0, (rho - this.r) / this.falloff));
      return rho - this.r * (1 + (sh - 1) * (1 - t));
    }

    /**
     * An angular outline. Garden stones are quarried and split, and reading
     * the smooth radial profile straight off gives a river pebble instead —
     * so the drawn silhouette is a coarse polygon sampled from that profile,
     * with the vertices unevenly spaced. The field keeps using the smooth
     * version; the difference is under a rake width and never shows.
     */
    facets(rng, n = 11) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = ((i + rng.float(-0.32, 0.32)) / n) * Math.PI * 2;
        const r = this.r * this.shape(a) * rng.float(0.93, 1.03);
        pts.push(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
      }
      return pts;
    }

    /** Closed polygon following the outline. */
    outline(n = 96) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.r * this.shape(a);
        pts.push(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
      }
      return pts;
    }

    get reach() {
      let m = 1;
      for (let i = 0; i < 32; i++) m = Math.max(m, this.shape((i / 32) * Math.PI * 2));
      return this.r * m;
    }
  }

  /**
   * Distance to the line the gardener started from. Bending it into a sinusoid
   * turns the open gravel from 直線 (straight) into 流水紋 (flowing water).
   */
  function rakeDistance(x, y, rake) {
    const along = x * rake.ux + y * rake.uy;
    const across = x * rake.nx + y * rake.ny;
    return across - rake.offset - rake.wave * Math.sin(along * rake.k + rake.phase);
  }

  /**
   * Sample φ on a regular grid over the plate.
   *
   * @param {object} o
   * @param {{w:number,h:number}} o.plate
   * @param {Stone[]} o.stones
   * @param {object} o.rake
   * @param {number} o.step     grid spacing in px
   * @param {number} o.seam     smoothing radius where two sources meet
   * @param {function} [o.warp] (x, y) => small offset, to take the ruled
   *                            perfection off the open gravel
   */
  function buildField(o) {
    const step = o.step;
    const gw = Math.floor(o.plate.w / step) + 2;
    const gh = Math.floor(o.plate.h / step) + 2;
    const f = new Float32Array(gw * gh);
    const stones = o.stones;
    let max = 0;

    for (let j = 0; j < gh; j++) {
      const y = j * step;
      for (let i = 0; i < gw; i++) {
        const x = i * step;
        let d = rakeDistance(x, y, o.rake);
        for (let s = 0; s < stones.length; s++) {
          d = smin(d, stones[s].distance(x, y), o.seam);
        }
        if (o.warp) d += o.warp(x, y);
        f[j * gw + i] = d;
        if (d > max) max = d;
      }
    }
    return { f, gw, gh, step, max };
  }

  /* ---------------------------------------------------------------------- */
  /* placement                                                               */
  /* ---------------------------------------------------------------------- */

  /**
   * Stone groups, in the tradition of odd numbers and unequal spacing: a
   * dominant 主石 with attendants leaning towards it, never in a row, never
   * evenly spread, and never one in the middle of the plate.
   */
  function placeStones(rng, plate) {
    const short = Math.min(plate.w, plate.h);
    const groups = [];
    const wanted = rng.weighted([[2, 4], [3, 5], [4, 2]]);
    // Odd numbers, and one group that clearly leads. 七五三 — seven, five,
    // three — is the traditional way to divide stones between groups.
    const sizes = [rng.pick([3, 3, 5]), ...rng.shuffled([1, 1, 2, 2, 3])].slice(0, wanted);
    const stones = [];
    const inset = short * 0.15;

    // Composition, not scattering.
    //
    // Spreading the groups as far apart as they will go — the obvious thing to
    // do — lays them out like polka dots, evenly and with nothing left over.
    // A garden is arranged the other way round: a main group set at a power
    // point, the rest placed *in relation to it*, and one large stretch of
    // gravel left with nothing in it at all. So the first group is placed and
    // the others are hung off it at varied distances and angles, which leaves
    // the far side of the plate open by construction.
    const main = {
      x: plate.w * (rng.bool() ? rng.float(0.20, 0.38) : rng.float(0.62, 0.80)),
      y: plate.h * (rng.bool() ? rng.float(0.18, 0.36) : rng.float(0.64, 0.82)),
    };
    groups.push(main);

    for (let g = 1; g < wanted; g++) {
      for (let attempt = 0; attempt < 80; attempt++) {
        const a = rng.float(Math.PI * 2);
        const dist = short * rng.float(0.30, 0.80);
        const x = main.x + Math.cos(a) * dist;
        const y = main.y + Math.sin(a) * dist;
        if (x < inset || y < inset || x > plate.w - inset || y > plate.h - inset) continue;
        let gap = Infinity;
        for (const c of groups) gap = Math.min(gap, Math.hypot(x - c.x, y - c.y));
        if (gap < short * 0.24) continue;
        groups.push({ x, y });
        break;
      }
    }

    for (let g = 0; g < groups.length; g++) {
      const best = groups[g];
      const count = sizes[g];
      const lead = short * rng.float(0.045, 0.085) * (g === 0 ? 1.35 : 0.82);
      const spread = rng.float(Math.PI * 2);
      for (let i = 0; i < count; i++) {
        // attendants get smaller and huddle around the lead stone
        const scale = i === 0 ? 1 : rng.float(0.35, 0.72);
        const r = lead * scale;
        const a = spread + (i / count) * Math.PI * 2 + rng.gauss(0, 0.5);
        const away = i === 0 ? 0 : lead * rng.float(0.75, 1.5);
        stones.push(new Stone({
          x: best.x + Math.cos(a) * away,
          y: best.y + Math.sin(a) * away * 0.75,
          r,
          aspect: rng.float(0.44, 0.82),
          tilt: rng.float(Math.PI * 2),
          harm: [
            [rng.float(0.06, 0.16), rng.int(2, 3), rng.float(Math.PI * 2)],
            [rng.float(0.04, 0.11), rng.int(4, 6), rng.float(Math.PI * 2)],
            [rng.float(0.02, 0.06), rng.int(7, 11), rng.float(Math.PI * 2)],
          ],
          buried: rng.float(0.1, 0.32),
          group: g,
          lead: i === 0,
        }));
      }
    }
    return stones;
  }

  global.Garden = { Stone, smin, rakeDistance, buildField, placeStones };
})(window);
