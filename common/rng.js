/**
 * rng.js — small deterministic random-number toolkit.
 *
 * Every piece in this repository is generated from a single short seed string.
 * The same seed must always produce the same image, so nothing here may touch
 * Math.random(). mulberry32 is used: tiny, fast, and good enough for art.
 */
(function (global) {
  'use strict';

  /** FNV-1a. Turns a seed string into a 32-bit unsigned integer. */
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  class Rng {
    constructor(seed) {
      this.seed = String(seed);
      this.state = hashString(this.seed) || 1;
      this._spare = null;
    }

    /** Uniform float in [0, 1). */
    next() {
      this.state = (this.state + 0x6d2b79f5) >>> 0;
      let t = this.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** Uniform float in [a, b). With one argument, [0, a). */
    float(a = 1, b) {
      if (b === undefined) { b = a; a = 0; }
      return a + this.next() * (b - a);
    }

    /** Uniform integer in [a, b]. With one argument, [0, a - 1]. */
    int(a, b) {
      if (b === undefined) { b = a - 1; a = 0; }
      return a + Math.floor(this.next() * (b - a + 1));
    }

    /** True with probability p. */
    bool(p = 0.5) {
      return this.next() < p;
    }

    /** -1 or +1. */
    sign() {
      return this.next() < 0.5 ? -1 : 1;
    }

    /** Uniform element of an array. */
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }

    /** Weighted choice from [[value, weight], ...]. */
    weighted(pairs) {
      let total = 0;
      for (const [, w] of pairs) total += w;
      let t = this.next() * total;
      for (const [value, w] of pairs) {
        t -= w;
        if (t <= 0) return value;
      }
      return pairs[pairs.length - 1][0];
    }

    /** Gaussian sample (Box-Muller, with the second value cached). */
    gauss(mu = 0, sigma = 1) {
      if (this._spare !== null) {
        const v = this._spare;
        this._spare = null;
        return mu + sigma * v;
      }
      let u = 0, v = 0, s = 0;
      do {
        u = this.next() * 2 - 1;
        v = this.next() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const f = Math.sqrt((-2 * Math.log(s)) / s);
      this._spare = v * f;
      return mu + sigma * u * f;
    }

    /** Gaussian clamped to [lo, hi] by resampling. */
    gaussClamped(mu, sigma, lo, hi) {
      for (let i = 0; i < 12; i++) {
        const v = this.gauss(mu, sigma);
        if (v >= lo && v <= hi) return v;
      }
      return Math.min(hi, Math.max(lo, mu));
    }

    /** Shuffle a copy of an array (Fisher-Yates). */
    shuffled(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }
  }

  /** A pronounceable seed, e.g. "kuroshio-71". Short enough to be readable. */
  function randomSeed() {
    const cons = 'kstnhmyrwgzdbp';
    const vows = 'aiueo';
    let word = '';
    for (let i = 0; i < 4; i++) {
      word += cons[Math.floor(Math.random() * cons.length)];
      word += vows[Math.floor(Math.random() * vows.length)];
    }
    return word + '-' + (10 + Math.floor(Math.random() * 90));
  }

  global.Rng = Rng;
  global.hashString = hashString;
  global.randomSeed = randomSeed;
})(window);
