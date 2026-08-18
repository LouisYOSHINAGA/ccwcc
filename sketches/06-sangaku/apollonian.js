/**
 * apollonian.js — filling a circle with circles.
 *
 * Descartes' circle theorem: if four circles are mutually tangent and k is
 * curvature (1/r, negative for a circle that encloses the others), then
 *
 *     (k1 + k2 + k3 + k4)² = 2(k1² + k2² + k3² + k4²)
 *
 * which solves for the fourth given three. There is a companion identity in
 * the complex plane with each curvature weighted by its centre, and that one
 * gives you *where* the fourth circle is:
 *
 *     (k1z1 + k2z2 + k3z3 + k4z4)² = 2(k1²z1² + k2²z2² + k3²z3² + k4²z4²)
 *
 * Both are quadratics, so each triple admits two tangent circles. Knowing one
 * of them, the other follows by simple reflection — k' = 2(k1+k2+k3) − k, and
 * the same for kz — which is exact, cheap, and the whole recursion.
 *
 * Japanese mathematicians of the Edo period arrived at the theorem
 * independently: it appears in a 1796 sangaku from Gunma, thirty years before
 * the Western rediscovery by Philip Beecroft.
 */
(function (global) {
  'use strict';

  const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const cMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cScale = (a, s) => [a[0] * s, a[1] * s];

  function cSqrt(a) {
    const m = Math.hypot(a[0], a[1]);
    const re = Math.sqrt(Math.max(0, (m + a[0]) / 2));
    const im = Math.sqrt(Math.max(0, (m - a[0]) / 2)) * (a[1] < 0 ? -1 : 1);
    return [re, im];
  }

  /** A circle as curvature plus centre. Negative k encloses. */
  function circle(k, x, y) {
    return { k, x, y, r: Math.abs(1 / k) };
  }

  /** Are these two tangent, internally or externally? */
  function tangent(a, b, tol) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    return Math.abs(d - Math.abs(a.r - b.r)) < tol || Math.abs(d - (a.r + b.r)) < tol;
  }

  /**
   * Both circles tangent to three mutually tangent ones. The two quadratics
   * are solved independently, so the four sign combinations include two
   * spurious pairings; they are thrown out by checking tangency directly,
   * which is cheaper than reasoning about which root goes with which.
   */
  function solve(c1, c2, c3) {
    const k1 = c1.k, k2 = c2.k, k3 = c3.k;
    const z1 = [c1.x, c1.y], z2 = [c2.x, c2.y], z3 = [c3.x, c3.y];
    const kSum = k1 + k2 + k3;
    const root = Math.sqrt(Math.abs(k1 * k2 + k2 * k3 + k3 * k1));

    const zk = cAdd(cAdd(cScale(z1, k1), cScale(z2, k2)), cScale(z3, k3));
    const inner = cAdd(
      cAdd(cScale(cMul(z1, z2), k1 * k2), cScale(cMul(z2, z3), k2 * k3)),
      cScale(cMul(z3, z1), k3 * k1)
    );
    const zRoot = cSqrt(inner);

    const tol = Math.min(c1.r, c2.r, c3.r) * 1e-4 + 1e-9;
    const found = [];
    for (const sk of [1, -1]) {
      const k4 = kSum + sk * 2 * root;
      if (!isFinite(k4) || Math.abs(k4) < 1e-12) continue;
      for (const sz of [1, -1]) {
        const kz = cAdd(zk, cScale(zRoot, sz * 2));
        const c4 = circle(k4, kz[0] / k4, kz[1] / k4);
        if (tangent(c4, c1, tol) && tangent(c4, c2, tol) && tangent(c4, c3, tol)) {
          if (!found.some((f) => Math.abs(f.k - c4.k) < tol && Math.hypot(f.x - c4.x, f.y - c4.y) < tol)) {
            found.push(c4);
          }
        }
      }
    }
    return found;
  }

  /** The other circle tangent to c1, c2, c3, given that c4 is one of them. */
  function reflect(c1, c2, c3, c4) {
    const k = 2 * (c1.k + c2.k + c3.k) - c4.k;
    const x = (2 * (c1.k * c1.x + c2.k * c2.x + c3.k * c3.x) - c4.k * c4.x) / k;
    const y = (2 * (c1.k * c1.y + c2.k * c2.y + c3.k * c3.y) - c4.k * c4.y) / k;
    return circle(k, x, y);
  }

  /**
   * The gasket inside an outer circle, seeded by two internally tangent
   * circles whose radii sum to the outer one — the only way two circles fit
   * tangent to each other and to the inside of a third.
   *
   * @param {object} o
   * @param {number} o.x @param {number} o.y @param {number} o.R
   * @param {number} o.split  first inner circle, as a fraction of R
   * @param {number} o.minR   stop when circles get smaller than this
   * @param {number} [o.maxCircles]
   * @returns {Array} circles, each carrying the generation it appeared in
   */
  function gasket(o) {
    const R = o.R;
    const a = R * o.split;
    const b = R - a;
    const outer = circle(-1 / R, o.x, o.y);
    const c1 = circle(1 / a, o.x - (R - a), o.y);
    const c2 = circle(1 / b, o.x + (R - b), o.y);

    const circles = [outer, c1, c2];
    outer.gen = 0; c1.gen = 1; c2.gen = 1;
    const limit = o.maxCircles ?? 4000;

    const seeds = solve(outer, c1, c2);
    const stack = [];
    for (const s of seeds) {
      s.gen = 2;
      circles.push(s);
      stack.push([outer, c1, c2, s, 2]);
    }

    while (stack.length && circles.length < limit) {
      const [a1, a2, a3, a4, gen] = stack.pop();
      for (const [t1, t2, t3, ex] of [[a1, a2, a4, a3], [a1, a3, a4, a2], [a2, a3, a4, a1]]) {
        const next = reflect(t1, t2, t3, ex);
        if (!isFinite(next.k) || next.r < o.minR || next.k <= 0) continue;
        next.gen = gen + 1;
        circles.push(next);
        if (circles.length >= limit) break;
        stack.push([t1, t2, t3, next, gen + 1]);
      }
    }
    return circles;
  }

  global.Apollonian = { circle, solve, reflect, gasket, tangent };
})(window);
