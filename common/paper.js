/**
 * paper.js — the support the ink sits on.
 *
 * A generated image only reads as a *print* if the ground has as much
 * variation as the marks do. Three layers do that here:
 *
 *   mottle  low-frequency blotching, the cloudiness of handmade sheets
 *   fibre   short pale strands suspended in the pulp
 *   grain   per-pixel tooth, laid over everything at the very end
 *
 * All of it is driven by the piece's Rng, so a seed reproduces the paper as
 * well as the composition.
 */
(function (global) {
  'use strict';

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  /**
   * The sheet itself: base colour, cloudiness, fibres.
   * @returns {p5.Graphics}
   */
  function makePaper(p, w, h, opts) {
    const rng = opts.rng;
    const base = hexToRgb(opts.base);
    const dark = !!opts.dark;
    const g = p.createGraphics(w, h);
    g.pixelDensity(1);
    g.background(base[0], base[1], base[2]);

    // --- mottle: rendered small and scaled up, which is both fast and gives
    // exactly the soft-edged unevenness we want. It has to stay near the
    // threshold of visibility — any stronger and the sheet reads as stained
    // rather than handmade.
    const sc = 6;
    const mw = Math.ceil(w / sc);
    const mh = Math.ceil(h / sc);
    const m = p.createGraphics(mw, mh);
    m.pixelDensity(1);
    m.loadPixels();
    const nOff = rng.float(1000);
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        // two octaves: a slow wash plus a finer curdle
        const n =
          p.noise(x * 0.05 + nOff, y * 0.05 + nOff) * 0.6 +
          p.noise(x * 0.19 + nOff * 2, y * 0.19 + nOff * 2) * 0.4;
        const v = (n - 0.5) * 2;
        const i = (y * mw + x) * 4;
        // warm both ways: pulp is never grey
        m.pixels[i] = v > 0 ? 255 : 96;
        m.pixels[i + 1] = v > 0 ? 248 : 82;
        m.pixels[i + 2] = v > 0 ? 228 : 62;
        m.pixels[i + 3] = Math.min(255, Math.abs(v) * (dark ? 26 : 20));
      }
    }
    m.updatePixels();
    g.image(m, 0, 0, w, h);
    m.remove();

    // --- laid lines: the wire mesh of the mould, printed faintly into the
    // sheet. Close-spaced chain of verticals, with a heavier one now and then.
    if (opts.laid !== false) {
      const pitch = 5.5;
      g.strokeWeight(1);
      for (let x = rng.float(pitch); x < w; x += pitch) {
        g.stroke(255, 252, 240, dark ? 5 : 7);
        g.line(x, 0, x, h);
      }
      for (let x = rng.float(180); x < w; x += 176) {
        g.stroke(90, 78, 58, dark ? 5 : 9);
        g.line(x, 0, x, h);
      }
    }

    // --- fibres
    const fibreCount = Math.round((w * h) / 2600);
    g.noFill();
    for (let i = 0; i < fibreCount; i++) {
      const x = rng.float(w);
      const y = rng.float(h);
      const a = rng.float(Math.PI * 2);
      const len = rng.float(4, 26);
      const pale = rng.bool(dark ? 0.35 : 0.6);
      const alpha = rng.float(4, dark ? 20 : 15);
      g.stroke(pale ? 255 : 40, pale ? 250 : 34, pale ? 235 : 26, alpha);
      g.strokeWeight(rng.float(0.5, 1.2));
      g.beginShape();
      let cx = x;
      let cy = y;
      let ca = a;
      for (let s = 0; s <= 4; s++) {
        g.vertex(cx, cy);
        ca += rng.gauss(0, 0.35);
        cx += Math.cos(ca) * (len / 4);
        cy += Math.sin(ca) * (len / 4);
      }
      g.endShape();
    }

    // --- a few darker specks: dust in the pulp
    g.noStroke();
    const speckCount = Math.round((w * h) / 9000);
    for (let i = 0; i < speckCount; i++) {
      g.fill(30, 24, 18, rng.float(8, 34));
      g.circle(rng.float(w), rng.float(h), rng.float(0.7, 2.4));
    }

    return g;
  }

  /**
   * Per-pixel tooth, meant to be composited with OVERLAY so that mid-grey is
   * a no-op and only the deviation shows.
   * @returns {p5.Graphics}
   */
  function makeGrain(p, w, h, opts) {
    const rng = opts.rng;
    const strength = opts.strength ?? 26;
    const g = p.createGraphics(w, h);
    g.pixelDensity(1);
    g.loadPixels();
    const px = g.pixels;
    for (let i = 0; i < px.length; i += 4) {
      const v = 128 + (rng.next() - 0.5) * strength * 2;
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
      px[i + 3] = 255;
    }
    g.updatePixels();
    return g;
  }

  /**
   * Paint a soft radial darkening into an existing layer — the falloff of a
   * sheet lit from above, and a gentle way to hold the eye near the centre.
   */
  function vignette(g, opts = {}) {
    const w = g.width;
    const h = g.height;
    const ctx = g.drawingContext;
    const inner = opts.inner ?? 0.42;
    const alpha = opts.alpha ?? 0.22;
    const col = opts.color ?? '0, 0, 0';
    const grad = ctx.createRadialGradient(
      w * 0.5, h * 0.46, Math.max(w, h) * inner,
      w * 0.5, h * 0.5, Math.max(w, h) * 0.78
    );
    grad.addColorStop(0, `rgba(${col}, 0)`);
    grad.addColorStop(1, `rgba(${col}, ${alpha})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  global.Paper = { makePaper, makeGrain, vignette, hexToRgb };
})(window);
