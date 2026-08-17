/**
 * sheet.js — how a work is presented.
 *
 * Every piece in this series is printed on the same sheet at the same size,
 * with the caption on the same line and the seal in the same corner. Only the
 * plate — the area actually worked — changes shape. That constancy is what
 * makes a set of unrelated algorithms read as one body of work rather than a
 * folder of demos.
 */
(function (global) {
  'use strict';

  const SIZE = { w: 1240, h: 1600 };
  const MARGIN = { left: 96, right: 96, top: 96, bottom: 196 };

  /**
   * Traditional formats, deciding how much paper is deliberately left alone.
   * `weight` is how often each should come up.
   */
  const FORMATS = [
    // the whole sheet, edge to edge
    { id: 'zenshi', ja: '全紙', roman: 'ZENSHI', x: 96, y: 96, w: 1048, h: 1308, weight: 5 },
    // a square poem card, held high on the page
    { id: 'shikishi', ja: '色紙', roman: 'SHIKISHI', x: 96, y: 96, w: 1048, h: 1048, weight: 3 },
    // a narrow vertical strip, as a poem is written on
    { id: 'tanzaku', ja: '短冊', roman: 'TANZAKU', x: 396, y: 118, w: 448, h: 1230, weight: 2 },
    // a wide band, floated a little above centre
    { id: 'yokomono', ja: '横物', roman: 'YOKOMONO', x: 96, y: 386, w: 1048, h: 646, weight: 2 },
  ];

  /** Fixed baselines, so the caption never moves between works. */
  const CAPTION = { title: SIZE.h - 134, sub: SIZE.h - 100, seal: SIZE.h - 124 };

  const SERIF =
    "'Hiragino Mincho ProN', 'Yu Mincho', 'IPAPMincho', 'IPAMincho', Georgia, 'Times New Roman', serif";

  function pickFormat(rng) {
    return rng.weighted(FORMATS.map((f) => [f, f.weight]));
  }

  /* ---------------------------------------------------------------------- */
  /* type                                                                    */
  /* ---------------------------------------------------------------------- */

  /** p5 has no letter-spacing, and these lines need it badly. */
  function trackedText(g, str, x, y, tracking) {
    let cx = x;
    for (const ch of str) {
      g.text(ch, cx, y);
      cx += g.textWidth(ch) + tracking;
    }
  }

  /**
   * @param {object} o
   * @param {string} o.titleJa
   * @param {string[]} o.fields  the small line, joined with separators
   * @param {string} o.ink       colour for the title
   * @param {string} o.faint     colour for the small line
   * @param {p5.Graphics} o.seal
   */
  function drawCaption(p, g, o) {
    g.push();
    g.noStroke();
    g.textAlign(p.LEFT, p.BASELINE);
    g.textFont(SERIF);

    g.fill(o.ink);
    g.textSize(30);
    trackedText(g, o.titleJa, MARGIN.left, CAPTION.title, 6);

    g.fill(o.faint);
    g.textSize(11.5);
    trackedText(g, o.fields.join('   ·   '), MARGIN.left, CAPTION.sub, 1.4);

    if (o.seal) {
      const s = o.seal.width;
      g.push();
      g.translate(SIZE.w - MARGIN.right - s / 2, CAPTION.seal);
      g.rotate(-0.022);
      g.imageMode(p.CENTER);
      g.image(o.seal, 0, 0);
      g.pop();
    }
    g.pop();
  }

  /* ---------------------------------------------------------------------- */
  /* the seal (落款)                                                         */
  /* ---------------------------------------------------------------------- */

  /**
   * A carved stone seal: red ground with the strokes cut away. The
   * "characters" are the vertical spines and horizontal bars that seal script
   * is built from — abstract, but the right shape at this size.
   */
  function makeSeal(p, size, rng, vermilion) {
    const g = p.createGraphics(size, size);
    g.pixelDensity(2);
    g.clear();
    g.noStroke();
    g.fill(vermilion);
    g.rect(0, 0, size, size, size * 0.04);

    // The stone is old: chip the edges and pit the face.
    g.erase();
    for (let i = 0; i < 90; i++) {
      const edge = rng.int(0, 3);
      const t = rng.float(size);
      const d = rng.float(0.5, size * 0.07);
      const x = edge === 0 ? t : edge === 1 ? size - d : t;
      const y = edge === 0 ? d : edge === 1 ? t : edge === 2 ? size - d : t;
      g.circle(edge === 3 ? d : x, y, rng.float(1, size * 0.11));
    }
    for (let i = 0; i < 260; i++) {
      g.circle(rng.float(size), rng.float(size), rng.float(0.4, 2.0));
    }
    g.noErase();

    // Cut the glyph.
    const m = size * 0.13;
    const inner = size - m * 2;
    g.erase();
    g.noFill();
    g.stroke(255);
    g.strokeWeight(size * 0.045);
    g.rect(m, m, inner, inner);

    const cols = rng.int(1, 2);
    const cw = inner / cols;
    for (let c = 0; c < cols; c++) {
      const x0 = m + cw * c + cw * 0.22;
      const x1 = m + cw * (c + 1) - cw * 0.22;
      const spine = (x0 + x1) / 2 + rng.float(-cw * 0.06, cw * 0.06);
      g.strokeWeight(size * rng.float(0.035, 0.055));
      g.line(spine, m + inner * 0.14, spine, m + inner * 0.86);
      const bars = rng.int(2, 4);
      for (let b = 0; b < bars; b++) {
        const y = m + inner * (0.2 + (0.6 * b) / Math.max(1, bars - 1)) + rng.float(-3, 3);
        g.line(x0, y, x1, y);
      }
      if (rng.bool(0.5)) {
        g.line(x0, m + inner * 0.86, x1, m + inner * 0.86);
      }
    }
    g.noErase();
    return g;
  }

  /* ---------------------------------------------------------------------- */
  /* display                                                                 */
  /* ---------------------------------------------------------------------- */

  /** Scale the canvas element to fit the window without touching its buffer. */
  function fitToWindow(p, pad = 28) {
    const scale = Math.min(
      (p.windowWidth - pad * 2) / SIZE.w,
      (p.windowHeight - pad * 2) / SIZE.h
    );
    const el = document.querySelector('#stage canvas');
    if (el) {
      el.style.width = `${Math.round(SIZE.w * scale)}px`;
      el.style.height = `${Math.round(SIZE.h * scale)}px`;
    }
  }

  /** Faint impression of the plate edge in the sheet. */
  function plateMark(g, plate, dark) {
    g.push();
    g.noFill();
    g.stroke(dark ? 255 : 0, dark ? 26 : 24);
    g.strokeWeight(1);
    g.rect(plate.x - 0.5, plate.y - 0.5, plate.w + 1, plate.h + 1);
    g.pop();
  }

  global.Sheet = {
    SIZE, MARGIN, FORMATS, CAPTION, SERIF,
    pickFormat, trackedText, drawCaption, makeSeal, fitToWindow, plateMark,
  };
})(window);
