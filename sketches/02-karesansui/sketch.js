/**
 * 枯山水 — Karesansui
 *
 * A dry garden: no water, no plants to speak of. A field of raked gravel,
 * some stones set in it, and moss where the damp collects at their feet.
 *
 * The furrows are not drawn one by one. They are the level sets of a single
 * distance field — distance to the nearest stone, or to the edge the gardener
 * started from, smoothly blended where the two meet. Rake the field at one
 * tooth-width per contour and the rings around the stones, the straight lines
 * in the open, and the seams between them all fall out of the same equation.
 *
 * Companion to 01: that piece is ink displaced by drops on water, this one is
 * gravel that never moves at all.
 *
 *   click / space   a new garden
 *   R               rake this seed again
 *   S               save a PNG
 *   ?seed=…&still=1 reproduce a specific garden, without the raking animation
 */
'use strict';

const SHEET = Sheet.SIZE;

const TITLES = [
  ['石庭', 'SEKITEI'], ['砂紋', 'SAMON'], ['蓬莱', 'HŌRAI'], ['亀島', 'KAMEJIMA'],
  ['静寂', 'SEIJAKU'], ['七五三', 'SHICHIGOSAN'], ['独坐', 'DOKUZA'], ['残雪', 'ZANSETSU'],
];

/** Roughly six seconds at 60fps: long enough to watch, short enough to wait. */
const REVEAL_FRAMES = 340;

let piece = null;
let sheetLayer;
let grainLayer;
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
  // Clamped: an out-of-range or NaN component would stringify to something
  // like "#NaN2030", which canvas rejects *silently* — leaving whatever
  // fillStyle happened to be set before, which is a very confusing bug.
  const c = A.map((v, i) => Math.min(255, Math.max(0, Math.round(v + (B[i] - v) * t))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/* -------------------------------------------------------------------------- */
/* the ground                                                                  */
/* -------------------------------------------------------------------------- */

/** Gravel: a flat base, per-grain lightness, and a scatter of larger stones. */
function makeGround(w, h, pal, rng) {
  const g = createGraphics(w, h);
  g.pixelDensity(1);
  g.background(pal.ground);

  g.loadPixels();
  const px = g.pixels;
  for (let i = 0; i < px.length; i += 4) {
    const v = (rng.next() - 0.5) * 18;
    px[i] += v;
    px[i + 1] += v;
    px[i + 2] += v * 0.9;
  }
  g.updatePixels();

  // Individual grains large enough to read, lit from the upper left.
  const light = pal.furrowLight;
  const dark = pal.furrowDark;
  g.noStroke();
  const count = Math.round((w * h) / 500);
  for (let i = 0; i < count; i++) {
    const x = rng.float(w);
    const y = rng.float(h);
    const r = rng.float(0.8, 2.6);
    g.fill(rgba(dark, rng.float(0.05, 0.16)));
    g.circle(x + 0.4, y + 0.5, r);
    g.fill(rgba(light, rng.float(0.10, 0.30)));
    g.circle(x - 0.3, y - 0.4, r * 0.9);
  }
  return g;
}

/* -------------------------------------------------------------------------- */
/* stones and moss                                                             */
/* -------------------------------------------------------------------------- */

function polyPath(pts) {
  const path = new Path2D();
  path.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
  path.closePath();
  return path;
}

/**
 * The damp collar at the foot of a stone. Drawn as a blob with its edge
 * stippled — moss has no outline, it just stops being moss.
 */
function drawMoss(g, stone, pal, rng) {
  const ctx = g.drawingContext;
  const R = stone.reach * rng.float(0.95, 1.22);
  const harm = [
    [rng.float(0.10, 0.26), rng.int(2, 3), rng.float(6.28)],
    [rng.float(0.06, 0.16), rng.int(4, 6), rng.float(6.28)],
  ];
  const cx = stone.x + rng.gauss(0, stone.r * 0.15);
  const cy = stone.y + stone.r * rng.float(0.12, 0.3);
  const radius = (a) => {
    let f = 1;
    for (const [amp, k, p] of harm) f *= 1 + amp * Math.sin(k * a + p);
    return R * f;
  };

  const pts = [];
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    const r = radius(a);
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82);
  }
  // Laid down at low opacity: moss on gravel is a change of tone, not a
  // patch of colour, and at this scale a solid green reads as a spill.
  // Blurred, because the polygon is scaffolding, not an edge: moss has no
  // outline, it just stops being moss, and a crisp boundary here turns the
  // whole patch into a sticker.
  ctx.save();
  ctx.filter = `blur(${Math.max(4, R * 0.16)}px)`;
  ctx.fillStyle = rgba(pal.moss[0], 0.5);
  ctx.fill(polyPath(pts));
  ctx.restore();

  // stipple the boundary outward so it dissolves into the gravel
  g.noStroke();
  for (let i = 0; i < 1400; i++) {
    const a = rng.float(Math.PI * 2);
    const r = radius(a) * rng.float(0.86, 1.3);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.82;
    g.fill(rgba(rng.pick(pal.moss), rng.float(0.08, 0.42)));
    g.circle(x, y, rng.float(0.7, 2.8));
  }
  // and texture the inside
  for (let i = 0; i < 1100; i++) {
    const a = rng.float(Math.PI * 2);
    const r = radius(a) * Math.sqrt(rng.next()) * 0.95;
    g.fill(rgba(rng.pick(pal.moss), rng.float(0.06, 0.3)));
    g.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82, rng.float(0.7, 2.6));
  }
}

/** Shrink a polygon towards its centroid, and lean it slightly uphill. */
function insetPoly(pts, k, leanX, leanY) {
  let cx = 0, cy = 0;
  const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
  cx /= n; cy /= n;
  const out = [];
  for (let i = 0; i < pts.length; i += 2) {
    out.push(cx + (pts[i] - cx) * k + leanX, cy + (pts[i + 1] - cy) * k + leanY);
  }
  return out;
}

/**
 * A stone, seen from above.
 *
 * Not a shaded ball: from directly overhead what you actually see is a flat
 * top face and a ring of foreshortened side facets around it, each catching a
 * different amount of light depending on which way it turns. Building it that
 * way — top face, bevel, cast shadow — is what makes it sit *in* the gravel
 * instead of floating on it.
 */
function drawStone(g, stone, pal, rng) {
  const ctx = g.drawingContext;
  const outer = stone.facets(rng, rng.int(9, 14));
  // the top face is offset uphill, so the lit side reads narrow and the
  // shaded side broad, as it would on a stone tipped away from the sun
  const inner = insetPoly(outer, rng.float(0.60, 0.74), -stone.r * 0.10, -stone.r * 0.13);
  const outerPath = polyPath(outer);
  const innerPath = polyPath(inner);
  const base = rng.pick(pal.stones);
  const light = pal.stoneLight;

  // cast shadow — short and fairly crisp: the sun is high
  ctx.save();
  ctx.filter = `blur(${Math.max(2, stone.r * 0.07)}px)`;
  ctx.translate(stone.r * 0.11, stone.r * 0.16);
  ctx.fillStyle = rgba(pal.dark ? '#000000' : '#2C2822', pal.dark ? 0.55 : 0.38);
  ctx.fill(outerPath);
  ctx.restore();

  // the bevel: one facet per edge of the silhouette, shaded by its normal
  const LX = -0.6392, LY = -0.7690;   // unit vector, up and to the left
  const n = outer.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = outer[i * 2], ay = outer[i * 2 + 1];
    const bx = outer[j * 2], by = outer[j * 2 + 1];
    const ex = bx - ax, ey = by - ay;
    const len = Math.hypot(ex, ey) || 1;
    // outward normal, given the vertices run clockwise in screen coordinates
    const nx = ey / len, ny = -ex / len;
    // Clamp before the power: the dot product can land a hair outside [-1, 1]
    // from rounding, and Math.pow of a negative base is NaN.
    const lit = Math.min(1, Math.max(0, (nx * LX + ny * LY + 1) * 0.5));
    const t = Math.pow(lit, 1.35);
    const tone = t > 0.5
      ? mixHex(base, light, (t - 0.5) * 1.5)
      : mixHex(base, '#000000', (0.5 - t) * 1.1);
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(inner[j * 2], inner[j * 2 + 1]);
    ctx.lineTo(inner[i * 2], inner[i * 2 + 1]);
    ctx.closePath();
    ctx.fill();
    // a hairline along each facet edge, so they read as distinct planes
    ctx.strokeStyle = rgba('#000000', 0.10);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }

  // the top face
  ctx.fillStyle = mixHex(base, light, 0.22);
  ctx.fill(innerPath);

  // weathering, kept inside the silhouette
  ctx.save();
  ctx.clip(outerPath);
  g.noStroke();
  for (let i = 0; i < rng.int(5, 11); i++) {
    const a = rng.float(Math.PI * 2);
    const d = rng.float(stone.r * 0.8);
    g.fill(rgba(rng.bool() ? light : '#000000', rng.float(0.03, 0.10)));
    g.circle(stone.x + Math.cos(a) * d, stone.y + Math.sin(a) * d, rng.float(stone.r * 0.3, stone.r));
  }
  for (let i = 0; i < Math.round(stone.r * 11); i++) {
    const a = rng.float(Math.PI * 2);
    const d = rng.float(stone.reach);
    g.fill(rgba(rng.bool() ? '#ffffff' : '#000000', rng.float(0.02, 0.09)));
    g.circle(stone.x + Math.cos(a) * d, stone.y + Math.sin(a) * d, rng.float(0.5, 1.9));
  }
  // cracks, running with the grain of the rock
  g.noFill();
  for (let i = 0; i < rng.int(1, 3); i++) {
    g.stroke(rgba('#000000', rng.float(0.10, 0.24)));
    g.strokeWeight(rng.float(0.5, 1.3));
    let x = stone.x + rng.gauss(0, stone.r * 0.4);
    let y = stone.y + rng.gauss(0, stone.r * 0.4);
    let a = stone.tilt + rng.gauss(0, 0.4);
    g.beginShape();
    for (let s = 0; s < 6; s++) {
      g.vertex(x, y);
      a += rng.gauss(0, 0.35);
      x += Math.cos(a) * stone.r * 0.26;
      y += Math.sin(a) * stone.r * 0.26;
    }
    g.endShape();
  }
  ctx.restore();

  // where the stone meets the gravel
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = rgba('#000000', pal.dark ? 0.55 : 0.34);
  ctx.stroke(outerPath);
}

/* -------------------------------------------------------------------------- */
/* the rake                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One furrow.
 *
 * A groove in gravel lit from the upper left is dark on its near wall and
 * bright on its far one, so each contour is stroked twice, offset either side
 * of where the line actually runs. That pair is the entire reason this reads
 * as raked sand rather than as a contour map — and it only works if the two
 * strokes are wide enough, and far enough apart, to be seen as two things.
 * Both are therefore scaled to the rake spacing rather than fixed: a rake
 * leaves the gravel corrugated edge to edge, not scored with hairlines.
 */
function drawFurrow(ctx, pts, pal, spacing, jitter, alpha) {
  const path = new Path2D();
  path.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);

  const shift = spacing * 0.115;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.save();
  ctx.translate(-shift * 0.94, -shift * 1.06);
  ctx.strokeStyle = rgba(pal.furrowDark, 0.52 * alpha);
  ctx.lineWidth = Math.max(2, spacing * 0.25) * jitter;
  ctx.stroke(path);
  ctx.restore();

  ctx.save();
  ctx.translate(shift * 0.88, shift);
  ctx.strokeStyle = rgba(pal.furrowLight, 0.7 * alpha);
  ctx.lineWidth = Math.max(1.8, spacing * 0.22) * jitter;
  ctx.stroke(path);
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* generation                                                                  */
/* -------------------------------------------------------------------------- */

function generate(seed) {
  const rng = new Rng(seed);
  noiseSeed(hashString(String(seed)));

  const pal = rng.pick(PALETTES);
  const plate = Sheet.pickFormat(rng);
  const short = Math.min(plate.w, plate.h);
  const [titleJa, titleRoman] = rng.pick(TITLES);

  const stones = Garden.placeStones(rng, plate);

  // The rake: a direction, and how much the gardener let the line wander.
  const angle = rng.float(Math.PI * 2);
  const flowing = rng.bool(0.45);
  const spacing = short * rng.float(0.015, 0.028);
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const nx = -uy;
  const ny = ux;
  const wave = flowing ? short * rng.float(0.03, 0.10) : 0;
  const warpAmp = spacing * rng.float(0.25, 0.6);

  // The gardener starts from one edge, so the distance to that edge has to be
  // positive across the whole plate — otherwise a corner of the garden ends up
  // on the far side of the baseline and comes out unraked. Which corner is
  // nearest depends on the angle, so measure rather than assume, and leave
  // room for the wave and the warp that get added afterwards.
  let minAcross = Infinity;
  for (const [x, y] of [[0, 0], [plate.w, 0], [0, plate.h], [plate.w, plate.h]]) {
    minAcross = Math.min(minAcross, x * nx + y * ny);
  }
  const rake = {
    ux, uy, nx, ny,
    offset: minAcross - wave - warpAmp - rng.float(spacing),
    wave,
    k: (Math.PI * 2) / (short * rng.float(0.4, 1.1)),
    phase: rng.float(Math.PI * 2),
  };

  // A slow noise on top: gravel is not ruled paper.
  const warpScale = rng.float(0.0011, 0.0026);
  const field = Garden.buildField({
    plate,
    stones,
    rake,
    step: 2.5,
    seam: spacing * rng.float(1.6, 3.2),
    warp: (x, y) => (noise(x * warpScale, y * warpScale) - 0.5) * 2 * warpAmp,
  });

  // One contour per rake tooth.
  const levels = [];
  for (let v = spacing; v < field.max; v += spacing) levels.push(v);
  const traced = Contours.trace(field.f, field.gw, field.gh, levels);

  const furrows = [];
  for (const { level, lines } of traced) {
    for (const line of lines) {
      if (line.length < 8) continue;
      const pts = Contours.smooth(line, 1);
      for (let i = 0; i < pts.length; i++) pts[i] *= field.step;
      furrows.push({ level, pts });
    }
  }

  if (piece) {
    for (const l of [piece.paper, piece.seal, piece.film, piece.ground, piece.rake, piece.features]) {
      if (l) l.remove();
    }
  }

  const ground = makeGround(plate.w, plate.h, pal, new Rng(seed + ':gravel'));

  // Stones and moss, drawn back to front so the near ones overlap the far.
  const features = createGraphics(plate.w, plate.h);
  features.pixelDensity(1);
  features.clear();
  const fRng = new Rng(seed + ':stones');
  const mossChance = 0.35 * (pal.mossy ?? 1);
  for (const stone of stones.slice().sort((a, b) => a.y - b.y)) {
    if (fRng.bool(mossChance)) drawMoss(features, stone, pal, fRng);
    drawStone(features, stone, pal, fRng);
  }

  const rakeLayer = createGraphics(plate.w, plate.h);
  rakeLayer.pixelDensity(1);
  rakeLayer.clear();

  piece = {
    seed: String(seed),
    pal,
    plate,
    titleJa,
    titleRoman,
    stones,
    furrows,
    spacing,
    flowing,
    ground,
    rake: rakeLayer,
    features,
    paper: Paper.makePaper(window, SHEET.w, SHEET.h, {
      rng: new Rng(seed + ':paper'),
      base: pal.paper,
      dark: pal.dark,
      laid: true,
    }),
    film: Paper.makeFilm(window, plate.w, plate.h, {
      rng: new Rng(seed + ':film'),
      strength: pal.dark ? 16 : 22,
    }),
    seal: Sheet.makeSeal(window, 58, new Rng(seed + ':seal'), pal.dark ? '#C4443F' : '#A82730'),
    rngDraw: new Rng(seed + ':draw'),
    cursor: 0,
    // how far into the sequence the reveal has got, in furrows
    reveal: 0,
    perFrame: furrows.length / REVEAL_FRAMES,
  };

  dirty = true;
  window.__ready = false;
  window.piece = piece;
  updateHud();
}

/**
 * Rake a few more furrows into the accumulating layer.
 *
 * Furrows come in level order, so revealing them in sequence looks like the
 * pattern spreading outward from the stones and inward from the edge at once.
 * Drawing one is so cheap that a frame budget would finish the whole garden in
 * well under a second, so the pace is set by how long the reveal *should*
 * take, with the budget kept only as a guard for very dense sheets.
 *
 * @param {number} budgetMs 0 to finish the garden immediately
 */
function advance(budgetMs) {
  const start = performance.now();
  const ctx = piece.rake.drawingContext;
  const pal = piece.pal;
  const all = budgetMs === 0;
  if (!all) piece.reveal += piece.perFrame;
  let ran = 0;
  while (piece.cursor < piece.furrows.length && (all || piece.cursor < piece.reveal)) {
    const f = piece.furrows[piece.cursor++];
    const r = piece.rngDraw;
    drawFurrow(ctx, f.pts, pal, piece.spacing, r.float(0.88, 1.12), r.float(0.82, 1));
    ran++;
    if (!all && ran % 8 === 0 && performance.now() - start > budgetMs) break;
  }
  if (ran) dirty = true;
}

/* -------------------------------------------------------------------------- */
/* rendering                                                                   */
/* -------------------------------------------------------------------------- */

function rebuildSheet(quick) {
  const plate = piece.plate;
  const pal = piece.pal;

  sheetLayer.clear();
  sheetLayer.image(piece.paper, 0, 0);

  const ctx = sheetLayer.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.rect(plate.x, plate.y, plate.w, plate.h);
  ctx.clip();

  sheetLayer.image(piece.ground, plate.x, plate.y);
  sheetLayer.image(piece.rake, plate.x, plate.y);
  sheetLayer.image(piece.features, plate.x, plate.y);

  if (!quick) {
    sheetLayer.push();
    sheetLayer.blendMode(MULTIPLY);
    sheetLayer.image(piece.film, plate.x, plate.y);
    sheetLayer.pop();
  }
  ctx.restore();

  Sheet.plateMark(sheetLayer, plate, pal.dark);

  Sheet.drawCaption(window, sheetLayer, {
    titleJa: piece.titleJa,
    fields: [
      piece.titleRoman,
      '枯山水 KARESANSUI',
      `${plate.ja} ${plate.roman}`,
      `${pal.name} ${pal.roman}`,
      `${piece.stones.length} STONES`,
      piece.seed.toUpperCase(),
    ],
    ink: pal.ink,
    faint: mixHex(pal.ink, pal.paper, 0.5),
    seal: piece.seal,
  });

  if (!quick) {
    Paper.vignette(sheetLayer, {
      alpha: pal.dark ? 0.34 : 0.2,
      color: pal.dark ? '0, 0, 0' : '48, 38, 26',
    });
  }
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
    strength: 20,
  });

  Sheet.fitToWindow(window);
  generate(seed);
  if (still) {
    advance(0);
    rebuildSheet(false);
  }
}

function draw() {
  const raking = piece.cursor < piece.furrows.length;
  if (raking) advance(16);
  if (dirty || (!raking && !window.__ready)) {
    rebuildSheet(piece.cursor < piece.furrows.length);
    dirty = false;
  }
  if (!raking) window.__ready = true;

  image(sheetLayer, 0, 0);
  push();
  blendMode(OVERLAY);
  tint(255, 130);
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

function newGarden() {
  generate(randomSeed());
}

function mousePressed() {
  if (mouseX >= 0 && mouseY >= 0 && mouseX <= width && mouseY <= height) newGarden();
}

function keyPressed() {
  if (key === ' ') newGarden();
  else if (key === 'r' || key === 'R') generate(piece.seed);
  else if (key === 's' || key === 'S') saveCanvas(`karesansui-${piece.seed}`, 'png');
}
