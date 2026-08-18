/**
 * 算額 — Sangaku
 *
 * In the Edo period, when a mathematician solved a problem worth keeping, the
 * result was painted on a wooden tablet and hung under the eaves of a shrine —
 * an offering, and a challenge to whoever came next. Around nine hundred
 * survive. Most are geometry, and most of the geometry is circles inside other
 * circles.
 *
 * The configuration here is the Apollonian gasket, from Descartes' circle
 * theorem: four mutually tangent circles satisfy
 *
 *     (k1 + k2 + k3 + k4)² = 2(k1² + k2² + k3² + k4²)
 *
 * in curvature, with a companion identity in the complex plane that locates
 * the fourth. The theorem appears on a sangaku from Gunma dated 1796, thirty
 * years before it was rediscovered in the West.
 *
 *   click / space   a new tablet
 *   R               draw this seed again
 *   S               save a PNG
 */
'use strict';

const TITLES = [
  ['算額', 'SANGAKU'], ['円理', 'ENRI'], ['奉納', 'HŌNŌ'],
  ['相切', 'SŌSETSU'], ['容円', 'YŌEN'], ['和算', 'WASAN'],
];

function rgba(hex, a) {
  const [r, g, b] = Paper.hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

/* -------------------------------------------------------------------------- */

/** Where the figures go. A tablet carries one problem, or several. */
function placeFigures(rng, plate) {
  // Mostly one figure. An Apollonian gasket is nearly all small circles, and
  // splitting the board between three of them leaves none of them room to
  // show anything past the fourth generation.
  const n = rng.weighted([[1, 8], [2, 3], [3, 1]]);
  const along = plate.h > plate.w;
  // leave a column clear down the right for the inscription
  const usable = { w: plate.w * 0.86, h: plate.h * 0.94 };
  if (n === 1) {
    return [{ x: usable.w / 2, y: plate.h * 0.5, R: Math.min(usable.w, usable.h) * 0.44 }];
  }
  const cell = (along ? usable.h : usable.w) / n;
  const R = Math.min(cell * 0.44, Math.min(usable.w, usable.h) * 0.44);
  const spots = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    spots.push({
      x: along ? usable.w * 0.5 : usable.w * t,
      y: along ? plate.h * 0.03 + usable.h * t : plate.h * 0.5,
      R: R * rng.float(0.86, 1.0),
    });
  }
  return spots;
}

function build(seed, rng) {
  const pal = rng.pick(PALETTES);
  const plate = Sheet.pickFormat(rng);
  const [titleJa, titleRoman] = rng.pick(TITLES);
  const era = rng.pick(ERAS);
  const year = rng.pick(YEARS);

  const figures = [];
  for (const spot of placeFigures(rng, plate)) {
    const circles = Apollonian.gasket({
      x: spot.x, y: spot.y, R: spot.R,
      split: rng.float(0.34, 0.66),
      minR: Math.max(1.1, spot.R * rng.float(0.004, 0.012)),
      maxCircles: 2600,
    });
    // biggest first, so the tablet fills in the order it would be drawn
    circles.sort((a, b) => (a.gen - b.gen) || (b.r - a.r));
    figures.push({ ...spot, circles });
  }

  // The board: timber, its grain, and the darkening along every exposed edge.
  const board = createGraphics(plate.w, plate.h);
  board.pixelDensity(1);
  board.background(pal.board);
  const bRng = new Rng(seed + ':board');
  const vertical = plate.h > plate.w * 1.4;
  // Sparse and faint. Timber grain that competes with the figure is worse
  // than no grain at all: the smallest circles in a gasket are a pixel wide,
  // and they lose that argument every time.
  board.noFill();
  for (let i = 0; i < (vertical ? plate.w : plate.h) * 0.32; i++) {
    const t = bRng.float(vertical ? plate.w : plate.h);
    board.stroke(rgba(bRng.bool(0.5) ? pal.grain : '#ffffff', bRng.float(0.012, 0.07)));
    board.strokeWeight(bRng.float(0.6, 2.6));
    board.beginShape();
    const steps = 14;
    let drift = 0;
    for (let k = 0; k <= steps; k++) {
      drift += bRng.gauss(0, 1.6);
      const u = (k / steps) * (vertical ? plate.h : plate.w);
      if (vertical) board.vertex(t + drift, u); else board.vertex(u, t + drift);
    }
    board.endShape();
  }
  // knots
  for (let i = 0; i < bRng.int(1, 4); i++) {
    const kx = bRng.float(plate.w);
    const ky = bRng.float(plate.h);
    const kr = bRng.float(8, 26);
    board.noFill();
    for (let r = kr; r > 1; r -= bRng.float(1.5, 3.5)) {
      board.stroke(rgba(pal.grain, bRng.float(0.04, 0.16)));
      board.strokeWeight(bRng.float(0.5, 1.4));
      board.ellipse(kx, ky, r * 2, r * 1.3);
    }
  }
  const bctx = board.drawingContext;
  const edge = bctx.createLinearGradient(0, 0, 0, plate.h);
  edge.addColorStop(0, rgba(pal.boardDark, 0.55));
  edge.addColorStop(0.14, rgba(pal.boardDark, 0));
  edge.addColorStop(0.86, rgba(pal.boardDark, 0));
  edge.addColorStop(1, rgba(pal.boardDark, 0.55));
  bctx.fillStyle = edge;
  bctx.fillRect(0, 0, plate.w, plate.h);
  const side = bctx.createLinearGradient(0, 0, plate.w, 0);
  side.addColorStop(0, rgba(pal.boardDark, 0.45));
  side.addColorStop(0.12, rgba(pal.boardDark, 0));
  side.addColorStop(0.88, rgba(pal.boardDark, 0));
  side.addColorStop(1, rgba(pal.boardDark, 0.45));
  bctx.fillStyle = side;
  bctx.fillRect(0, 0, plate.w, plate.h);

  // The inscription, down the right-hand edge as it would be brushed.
  const insc = createGraphics(plate.w, plate.h);
  insc.pixelDensity(1);
  insc.clear();
  insc.textFont(Sheet.SERIF);
  insc.textAlign(CENTER, CENTER);
  insc.noStroke();
  const boardInk = pal.boardInk || pal.ink;
  const cx = plate.w * 0.945;
  const big = Math.min(38, plate.w * 0.036);
  let y = plate.h * 0.10;
  insc.fill(rgba(boardInk, 0.86));
  insc.textSize(big);
  for (const ch of '奉納') { insc.text(ch, cx, y); y += big * 1.25; }
  y += big * 0.9;
  insc.textSize(big * 0.62);
  insc.fill(rgba(boardInk, 0.7));
  for (const ch of era + year + '年') { insc.text(ch, cx, y); y += big * 0.78; }
  // the conventional opening of a sangaku's working, low on the board
  insc.textSize(big * 0.62);
  insc.fill(rgba(boardInk, 0.6));
  y = plate.h * 0.80;
  for (const ch of '術曰') { insc.text(ch, cx, y); y += big * 0.78; }

  const figLayer = createGraphics(plate.w, plate.h);
  figLayer.pixelDensity(1);
  figLayer.clear();

  const ops = [];
  figures.forEach((f, fi) => f.circles.forEach((_, i) => ops.push({ fi, i })));

  return {
    pal, plate, titleJa, titleRoman, era, year, figures, ops,
    board, insc, figLayer,
    drawRng: new Rng(seed + ':draw'),
    layers: [board, insc, figLayer],
  };
}

/* -------------------------------------------------------------------------- */

/**
 * A circle as a brush would leave it. Perfect ellipses would be right for the
 * mathematics and wrong for the object: these were drawn by hand on a plank,
 * and the small departure from true is most of why it reads as a made thing.
 */
function inkCircle(ctx, x, y, r, wobble, phase) {
  const n = Math.max(16, Math.min(96, Math.round(r * 1.2)));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + wobble * (Math.sin(a * 3 + phase) + 0.6 * Math.sin(a * 5 - phase * 1.7)));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawCircle(g, fig, c, pal, rng) {
  const ctx = g.drawingContext;
  const outer = c.k < 0;
  const wobble = Math.min(0.02, 2.2 / Math.max(6, c.r));
  inkCircle(ctx, c.x, c.y, c.r, wobble, rng.float(Math.PI * 2));

  // Pigment goes on the larger circles only; past a few generations the
  // figure is carried by line alone, which is also how the tablets look.
  if (!outer && !pal.austere && c.gen <= 6 && c.r > fig.R * 0.02) {
    const pig = pal.pigments[(c.gen + 1) % pal.pigments.length];
    ctx.fillStyle = rgba(pig, c.gen <= 4 ? rng.float(0.62, 0.85) : rng.float(0.28, 0.45));
    ctx.fill();
  } else if (!outer && pal.austere && c.gen <= 4) {
    // ink only, but not bare: a thin wash still separates the generations
    ctx.fillStyle = rgba(pal.pigments[c.gen % 3], rng.float(0.08, 0.19));
    ctx.fill();
  }

  ctx.strokeStyle = rgba(pal.boardInk || pal.ink, outer ? 0.92 : Math.min(0.9, 0.58 + 0.32 * Math.min(1, c.r / 40)));
  ctx.lineWidth = outer
    ? Math.max(1.6, fig.R * 0.008)
    : Math.max(0.75, Math.min(2.4, c.r * 0.055));
  ctx.stroke();
}

/* -------------------------------------------------------------------------- */

Work.run({
  slug: 'sangaku',
  revealFrames: 320,
  grainTint: 130,
  filmStrength: 20,
  build,

  steps: (p) => p.ops.length,

  step(p, i) {
    const op = p.ops[i];
    const fig = p.figures[op.fi];
    drawCircle(p.figLayer, fig, fig.circles[op.i], p.pal, p.drawRng);
  },

  paint(p, g) {
    g.image(p.board, 0, 0);
    g.image(p.figLayer, 0, 0);
    g.image(p.insc, 0, 0);
  },

  caption: (p) => ({
    titleJa: p.titleJa,
    fields: [
      p.titleRoman,
      '算額 SANGAKU',
      `${p.plate.ja} ${p.plate.roman}`,
      `${p.pal.name} ${p.pal.roman}`,
      `${p.figures.reduce((n, f) => n + f.circles.length, 0)} CIRCLES`,
      p.seed.toUpperCase(),
    ],
  }),
});
