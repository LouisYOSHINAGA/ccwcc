/**
 * 墨流し — Suminagashi
 *
 * One sheet of handmade paper, one bowl of still water, and a brush that
 * alternates between ink and clear surfactant. Each touch of the brush pushes
 * every earlier ring outward, so the whole history of the piece stays legible
 * in the spacing of the bands. Then the surface is combed, and the sheet is
 * laid down to lift the film.
 *
 * The maths lives in marbling.js. This file decides *what to make* with it:
 * where the brush goes, what colour it carries, how the surface is combed,
 * and how the finished sheet is presented.
 *
 *   click / space   a new sheet
 *   R               pour this seed again
 *   S               save a PNG
 *   ?seed=…&still=1 reproduce a specific sheet, without the pour animation
 */
'use strict';

/* -------------------------------------------------------------------------- */
/* the sheet                                                                   */
/* -------------------------------------------------------------------------- */

const SHEET = Sheet.SIZE;
const MARGIN = Sheet.MARGIN;

const TITLES = {
  stone: [['静水', 'SEISUI'], ['泉', 'IZUMI'], ['淵', 'FUCHI'], ['月映', 'TSUKIBAE'], ['石', 'ISHI']],
  tide: [['潮目', 'SHIOME'], ['汀', 'MIGIWA'], ['層雲', 'SŌUN'], ['州', 'SU']],
  rain: [['雨脚', 'AMAASHI'], ['群島', 'GUNTŌ'], ['星屑', 'HOSHIKUZU'], ['苔庭', 'KOKENIWA']],
  twin: [['双', 'SŌ'], ['逢瀬', 'ŌSE'], ['二石', 'NISEKI'], ['響', 'HIBIKI']],
};

/* -------------------------------------------------------------------------- */
/* state                                                                       */
/* -------------------------------------------------------------------------- */

let piece = null;      // everything about the current sheet
let sheetLayer;        // paper + ink + caption, rebuilt when the ink changes
let inkLayer;          // plate-sized, transparent, holds the rings alone
let grainLayer;        // static per-pixel tooth, composited last
let dirty = true;
let still = false;

/* -------------------------------------------------------------------------- */
/* colour helpers                                                              */
/* -------------------------------------------------------------------------- */

function rgba(hex, a) {
  const [r, g, b] = Paper.hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

function mixHex(a, b, t) {
  const A = Paper.hexToRgb(a);
  const B = Paper.hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/* -------------------------------------------------------------------------- */
/* the score: a list of brush and comb operations                              */
/* -------------------------------------------------------------------------- */

/**
 * The ink in the brush at step `i` of `n`. Early drops are the darkest: the
 * ink thins as the session goes on, and having the outer bands heaviest gives
 * the sheet somewhere to settle.
 */
function inkStyle(pal, rng, t) {
  const base = rng.bool(pal.accentChance)
    ? pal.accent
    : rng.weighted([[pal.inks[0], 5], [pal.inks[1], 3], [pal.inks[2], 2]]);
  const thinned = mixHex(base, pal.paper, 0.16 * t + rng.float(0, 0.07));
  const alpha = 0.97 - 0.14 * t + rng.float(-0.03, 0.03);
  return {
    fill: rgba(thinned, Math.max(0.6, Math.min(1, alpha))),
    stroke: rgba(mixHex(base, pal.dark ? '#ffffff' : '#000000', 0.3), 0.42),
    weight: rng.float(0.5, 1.0),
  };
}

/** A ring of clear surfactant: no pigment, so the paper reads through it. */
function clearStyle(pal, rng) {
  return {
    fill: rgba(pal.clear, 1),
    stroke: rgba(pal.inks[0], rng.float(0.06, 0.16)),
    weight: rng.float(0.4, 0.8),
  };
}

/**
 * The rhythm of the brush: how many ink touches between each clear one. This
 * sets the whole character of the sheet — even alternation gives fine hairline
 * bands, doubled ink gives heavy strata, doubled clear leaves the paper open.
 */
function makeBrush(pal, rng) {
  const pattern = rng.weighted([
    [[1, 1], 5],       // even
    [[1, 2], 3],       // open: more paper than ink
    [[2, 1], 3],       // heavy strata
    [[1, 1, 2, 1], 2], // syncopated
  ]);
  let i = 0;
  let left = pattern[0];
  let inking = true;
  return function nextStyle(t) {
    if (left <= 0) {
      i = (i + 1) % pattern.length;
      left = pattern[i];
      inking = !inking;
    }
    left--;
    return inking ? inkStyle(pal, rng, t) : clearStyle(pal, rng);
  };
}

/**
 * The drop radius that will just cover the plate.
 *
 * Each drop adds pi*r^2 of surface, and the ink spreads outward from where it
 * lands, so a cluster of `count` drops of radius r reaches out to about
 * r*sqrt(count). Solving for the radius that takes the outermost ring past the
 * corner of the plate — rather than guessing at it — is what keeps a sheet
 * from ending in a hard, accidental edge halfway down the page.
 *
 * `reach` is how far past that corner to go: 1 is exactly the corner, more for
 * clusters that sit off-centre or are split between several pools.
 */
function coverageRadius(plate, count, reach) {
  const halfDiagonal = Math.hypot(plate.w, plate.h) / 2;
  // E[f^2] over the per-drop size jitter below, so the estimate stays honest
  const jitter = 1.09;
  return (halfDiagonal * reach) / Math.sqrt(count * jitter);
}

/** Three harmonics of irregularity for one touch of the brush. */
function wobbleFor(rng) {
  const w = [];
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    w.push([rng.float(0.004, 0.022), rng.int(2, 7), rng.float(Math.PI * 2)]);
  }
  return w;
}

/**
 * A run of drops from one spot on the water. The brush never lands twice in
 * exactly the same place, so the centre wanders — that drift is most of what
 * separates this from a bullseye.
 */
function pour(ops, rng, brush, o) {
  let cx = o.x;
  let cy = o.y;
  for (let i = 0; i < o.count; i++) {
    const t = i / Math.max(1, o.count - 1);
    cx += rng.gauss(0, o.drift) + (o.driftX ?? 0);
    cy += rng.gauss(0, o.drift) + (o.driftY ?? 0);
    const r = o.radius * rng.float(0.72, 1.34) * (1 - 0.12 * t);
    ops.push({
      t: 'drop',
      x: cx,
      y: cy,
      r,
      style: brush(o.tStart + (o.tSpan ?? 1) * t),
      wobble: wobbleFor(rng),
    });
    // an occasional nudge of the water keeps the rings from nesting too neatly
    if (i % 7 === 6) {
      ops.push({ t: 'breathe', scale: rng.float(180, 620), amount: rng.float(0.15, 0.45), phase: rng.float(6.28) });
    }
  }
}

/**
 * A comb pull, split into steps so it can be watched being drawn.
 *
 * Splitting is exact for a straight pull — the displacement is parallel to the
 * line, so a point's distance from it never changes and the steps simply add.
 * With a wavy line it is not quite exact, and the small difference reads as
 * the drag of a real comb rather than a single instantaneous shear.
 */
function combOps(ops, rng, o) {
  const steps = o.steps ?? 18;
  for (let i = 0; i < steps; i++) {
    ops.push({
      t: 'comb',
      base: o.base,
      angle: o.angle,
      amount: o.amount / steps,
      decay: o.decay,
      wave: o.wave ?? 0,
      period: o.period ?? 1,
      phase: o.phase ?? 0,
      // Resampling walks every point in the scene, so it is not worth doing
      // between every sub-step — only often enough to keep curves smooth.
      refine: i % 5 === 4 || i === steps - 1,
    });
  }
}

function buildScore(rng, pal, plate) {
  const W = plate.w;
  const H = plate.h;
  const short = Math.min(W, H);
  const layout = rng.weighted([['stone', 5], ['tide', 3], ['rain', 3], ['twin', 2]]);
  const brush = makeBrush(pal, rng);
  const ops = [];

  if (layout === 'stone') {
    // One sustained pour, off-centre, large enough to run out past the edges.
    const count = rng.int(150, 230);
    pour(ops, rng, brush, {
      x: W * rng.float(0.42, 0.58),
      y: H * rng.float(0.40, 0.56),
      count,
      radius: coverageRadius(plate, count, rng.float(1.25, 1.5)),
      drift: short * rng.float(0.006, 0.017),
      tStart: 0,
    });
  } else if (layout === 'tide') {
    // The brush walks a slow diagonal, laying the rings down as strata.
    const count = rng.int(160, 230);
    const a = rng.float(-0.5, 0.5) + (rng.bool() ? Math.PI / 2 : 0);
    const span = short * rng.float(0.5, 0.9);
    pour(ops, rng, brush, {
      x: W * 0.5 - (Math.cos(a) * span) / 2,
      y: H * 0.5 - (Math.sin(a) * span) / 2,
      count,
      radius: coverageRadius(plate, count, rng.float(1.3, 1.55)),
      drift: short * 0.008,
      driftX: (Math.cos(a) * span) / count,
      driftY: (Math.sin(a) * span) / count,
      tStart: 0,
    });
  } else if (layout === 'rain') {
    // Several small pools, poured in turn, that grow into one another.
    const pools = rng.int(3, 6);
    const each = rng.int(38, 62);
    // Split between pools, so each has to reach correspondingly further.
    const radius = coverageRadius(plate, each * pools, rng.float(1.5, 1.8));
    for (let i = 0; i < pools; i++) {
      pour(ops, rng, brush, {
        x: W * rng.float(0.2, 0.8),
        y: H * rng.float(0.18, 0.82),
        count: each,
        radius: radius * rng.float(0.85, 1.2),
        drift: short * rng.float(0.005, 0.014),
        tStart: i / pools,
        tSpan: 1 / pools,
      });
    }
  } else {
    // Two pools of unequal weight, close enough to crowd each other.
    const big = rng.int(110, 150);
    const small = rng.int(50, 85);
    const radius = coverageRadius(plate, big + small, rng.float(1.4, 1.65));
    const gap = short * rng.float(0.22, 0.36);
    const a = rng.float(Math.PI * 2);
    const cx = W * rng.float(0.44, 0.56);
    const cy = H * rng.float(0.44, 0.56);
    pour(ops, rng, brush, {
      x: cx + Math.cos(a) * gap * 0.5, y: cy + Math.sin(a) * gap * 0.5,
      count: big, radius, drift: short * 0.010, tStart: 0, tSpan: 0.6,
    });
    pour(ops, rng, brush, {
      x: cx - Math.cos(a) * gap * 0.5, y: cy - Math.sin(a) * gap * 0.5,
      count: small, radius: radius * 0.85, drift: short * 0.010,
      tStart: 0.6, tSpan: 0.4,
    });
  }

  /* --- the comb ---------------------------------------------------------- */

  // A broad, almost flat pull first: this is the one that turns concentric
  // circles into something that looks like it was made by a hand.
  const mainAngle = rng.float(Math.PI * 2);
  combOps(ops, rng, {
    base: [W * rng.float(0.3, 0.7), H * rng.float(0.3, 0.7)],
    angle: mainAngle,
    amount: short * rng.float(0.10, 0.30),
    decay: rng.float(0.9955, 0.9992),
    wave: short * rng.float(0.02, 0.09),
    period: short * rng.float(0.35, 1.1),
    phase: rng.float(Math.PI * 2),
    steps: 22,
  });

  // Then one to three finer counter-pulls, usually across the first.
  const pulls = rng.weighted([[1, 3], [2, 4], [3, 2]]);
  for (let i = 0; i < pulls; i++) {
    const across = rng.bool(0.7);
    combOps(ops, rng, {
      base: [W * rng.float(0.15, 0.85), H * rng.float(0.15, 0.85)],
      angle: mainAngle + (across ? Math.PI / 2 : 0) + rng.gauss(0, 0.45),
      amount: short * rng.float(0.03, 0.13) * rng.sign(),
      decay: rng.float(0.975, 0.996),
      wave: short * rng.float(0.005, 0.05),
      period: short * rng.float(0.12, 0.5),
      phase: rng.float(Math.PI * 2),
      steps: 14,
    });
  }

  // A stir, sometimes: a needle turned once in the surface.
  if (rng.bool(0.45)) {
    ops.push({
      t: 'stir',
      x: W * rng.float(0.2, 0.8),
      y: H * rng.float(0.2, 0.8),
      radius: short * rng.float(0.18, 0.42),
      strength: rng.float(0.25, 0.9) * rng.sign(),
    });
  }

  const [titleJa, titleRoman] = rng.pick(TITLES[layout]);
  const drops = ops.filter((o) => o.t === 'drop').length;
  return { layout, ops, titleJa, titleRoman, drops };
}

/* -------------------------------------------------------------------------- */
/* generation                                                                  */
/* -------------------------------------------------------------------------- */

function generate(seed) {
  const rng = new Rng(seed);
  noiseSeed(hashString(String(seed)));

  const pal = rng.pick(PALETTES);
  const plate = Sheet.pickFormat(rng);
  const score = buildScore(rng, pal, plate);

  const marbling = new Marbling({
    width: plate.w,
    height: plate.h,
    maxSeg: 2.2,
    maxPoints: 190000,
    margin: Math.max(plate.w, plate.h) * 0.1,
  });

  if (piece) {
    for (const layer of [piece.paper, piece.seal, piece.film]) {
      if (layer) layer.remove();
    }
  }

  const paper = Paper.makePaper(window, SHEET.w, SHEET.h, {
    rng: new Rng(seed + ':paper'),
    base: pal.paper,
    dark: pal.dark,
    laid: true,
  });

  piece = {
    seed: String(seed),
    pal,
    plate,
    rng,
    score,
    marbling,
    paper,
    film: Paper.makeFilm(window, plate.w, plate.h, {
      rng: new Rng(seed + ':film'),
      strength: pal.dark ? 22 : 30,
    }),
    seal: Sheet.makeSeal(window, 58, new Rng(seed + ':seal'), pal.dark ? '#C4443F' : '#B0272E'),
    cursor: 0,
  };

  if (inkLayer) inkLayer.remove();
  inkLayer = createGraphics(plate.w, plate.h);
  inkLayer.pixelDensity(1);
  inkLayer.clear();
  dirty = true;
  window.__ready = false;
  window.piece = piece;
  updateHud();
}

/** Run score operations until the frame budget runs out. */
function advance(budgetMs) {
  const start = performance.now();
  const { score, marbling } = piece;
  let ran = 0;
  while (piece.cursor < score.ops.length) {
    const op = score.ops[piece.cursor++];
    switch (op.t) {
      case 'drop': marbling.drop(op.x, op.y, op.r, op.style, op.wobble); break;
      case 'comb': marbling.comb(op); break;
      case 'stir': marbling.stir(op.x, op.y, op.radius, op.strength); break;
      case 'breathe': marbling.breathe(op.scale, op.amount, op.phase); break;
    }
    if (op.refine !== false && op.t !== 'breathe') marbling.refine();
    ran++;
    if (budgetMs > 0 && performance.now() - start > budgetMs) break;
  }
  if (ran) dirty = true;
  return piece.cursor < score.ops.length;
}

/* -------------------------------------------------------------------------- */
/* rendering                                                                   */
/* -------------------------------------------------------------------------- */

function drawInk() {
  inkLayer.clear();
  const ctx = inkLayer.drawingContext;
  ctx.lineJoin = 'round';
  for (const ring of piece.marbling.rings) {
    if (ring.dead) continue;
    const p = ring.pts;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    ctx.fillStyle = ring.style.fill;
    ctx.fill();
    if (ring.style.stroke) {
      ctx.strokeStyle = ring.style.stroke;
      ctx.lineWidth = ring.style.weight;
      ctx.stroke();
    }
  }
}

function drawCaption(g) {
  const pal = piece.pal;
  Sheet.drawCaption(window, g, {
    titleJa: piece.score.titleJa,
    fields: [
      piece.score.titleRoman,
      '墨流し SUMINAGASHI',
      `${piece.plate.ja} ${piece.plate.roman}`,
      `${pal.name} ${pal.roman}`,
      `${piece.score.drops} DROPS`,
      piece.seed.toUpperCase(),
    ],
    ink: pal.dark ? mixHex(pal.paper, '#ffffff', 0.82) : pal.inks[0],
    faint: pal.dark ? mixHex(pal.paper, '#ffffff', 0.5) : mixHex(pal.inks[0], pal.paper, 0.5),
    seal: piece.seal,
  });
}

function rebuildSheet(quick) {
  drawInk();
  const plate = piece.plate;

  sheetLayer.clear();
  sheetLayer.image(piece.paper, 0, 0);

  const ctx = sheetLayer.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plate.x, plate.y, plate.w, plate.h);
  ctx.clip();

  if (!quick) {
    // A soft halo first: ink wicking into damp paper.
    ctx.filter = 'blur(9px)';
    sheetLayer.push();
    sheetLayer.tint(255, 105);
    sheetLayer.image(inkLayer, plate.x, plate.y);
    sheetLayer.pop();
    ctx.filter = 'none';
  }

  sheetLayer.image(inkLayer, plate.x, plate.y);

  if (!quick) {
    // Where the film pooled and where it went thin.
    sheetLayer.push();
    sheetLayer.blendMode(MULTIPLY);
    sheetLayer.image(piece.film, plate.x, plate.y);
    sheetLayer.pop();
  }
  ctx.restore();

  // The impression a plate leaves in the sheet.
  Sheet.plateMark(sheetLayer, plate, piece.pal.dark);

  drawCaption(sheetLayer);
  Paper.vignette(sheetLayer, {
    alpha: piece.pal.dark ? 0.3 : 0.2,
    color: piece.pal.dark ? '0, 0, 0' : '48, 38, 26',
  });
}

/* -------------------------------------------------------------------------- */
/* p5 lifecycle                                                                */
/* -------------------------------------------------------------------------- */

function setup() {
  const params = new URLSearchParams(location.search);
  still = params.get('still') === '1';
  const seed = params.get('seed') || randomSeed();
  if (still) document.getElementById('hud').style.display = 'none';

  const c = createCanvas(SHEET.w, SHEET.h);
  c.parent('stage');
  pixelDensity(1);

  sheetLayer = createGraphics(SHEET.w, SHEET.h);
  sheetLayer.pixelDensity(1);
  grainLayer = Paper.makeGrain(window, SHEET.w, SHEET.h, {
    rng: new Rng('grain'),
    strength: 22,
  });

  Sheet.fitToWindow(window);
  generate(seed);
  if (still) {
    advance(0);
    rebuildSheet();
  }
}

function draw() {
  const pouring = piece.cursor < piece.score.ops.length;
  if (pouring) advance(18);
  if (dirty || (!pouring && !window.__ready)) {
    rebuildSheet(piece.cursor < piece.score.ops.length);
    dirty = false;
  }
  if (!pouring) window.__ready = true;
  image(sheetLayer, 0, 0);
  push();
  blendMode(OVERLAY);
  tint(255, 150);
  image(grainLayer, 0, 0);
  pop();
}

function windowResized() {
  Sheet.fitToWindow(window);
}

function updateHud() {
  const el = document.getElementById('seed');
  if (el) el.textContent = piece.seed;
  const url = new URL(location.href);
  url.searchParams.set('seed', piece.seed);
  history.replaceState(null, '', url);
}

function newSheet() {
  generate(randomSeed());
}

function mousePressed() {
  if (mouseX >= 0 && mouseY >= 0 && mouseX <= width && mouseY <= height) newSheet();
}

function keyPressed() {
  if (key === ' ') newSheet();
  else if (key === 'r' || key === 'R') generate(piece.seed);
  else if (key === 's' || key === 'S') saveCanvas(`suminagashi-${piece.seed}`, 'png');
}
