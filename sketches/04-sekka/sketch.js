/**
 * 雪華 — Sekka
 *
 * A plate of snow crystals, each grown from three numbers.
 *
 * In 1832 Doi Toshitsura, lord of Koga, published 雪華図説 — snow crystals
 * observed under an imported Dutch microscope and cut as woodblock plates.
 * They were the first such record in Japan, and the pattern went straight onto
 * kimono. This is that plate, with the crystals grown rather than observed:
 * Reiter's cellular automaton on a hexagonal lattice, run once per specimen,
 * each with its own diffusion, vapour and deposition constants.
 *
 * Nothing in the model mentions six-fold symmetry. It falls out of starting
 * from a single frozen cell on a lattice that has it — which is also why real
 * snow does it.
 *
 *   click / space   a new plate
 *   R               grow this seed again
 *   S               save a PNG
 */
'use strict';

const TITLES = [
  ['六花', 'RIKKA'], ['雪華', 'SEKKA'], ['雪片', 'SEPPEN'],
  ['結晶', 'KESSHŌ'], ['霜華', 'SŌKA'], ['寒晶', 'KANSHŌ'],
];

function rgba(hex, a) {
  const [r, g, b] = Paper.hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

/* -------------------------------------------------------------------------- */

/**
 * How many specimens, and where. Cells are kept near square whatever shape the
 * plate is, so a tall format gets a tall grid rather than stretched circles.
 */
function layout(rng, plate) {
  if (rng.bool(0.22)) {
    // a single specimen, given the whole plate
    return [{
      x: plate.w / 2,
      y: plate.h * 0.5,
      r: Math.min(plate.w, plate.h) * 0.42,
      solo: true,
    }];
  }
  // Columns follow the width of the plate rather than a free choice, so a
  // narrow format gets fewer and larger specimens instead of a wall of dots.
  const aspect = plate.h / plate.w;
  const base = Math.max(1, Math.min(4, Math.round(plate.w / 300)));
  const cols = Math.max(1, Math.min(4, base + rng.int(-1, 0)));
  const rows = Math.max(1, Math.min(6, Math.round(cols * aspect)));
  const cw = plate.w / cols;
  const ch = plate.h / rows;
  const r = Math.min(cw, ch) * 0.36;
  const spots = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      spots.push({ x: cw * (i + 0.5), y: ch * (j + 0.5) - ch * 0.04, r, solo: false });
    }
  }
  return spots;
}

function build(seed, rng) {
  const pal = rng.pick(PALETTES);
  const plate = Sheet.pickFormat(rng);
  const [titleJa, titleRoman] = rng.pick(TITLES);
  const spots = layout(rng, plate);

  const specimens = [];
  for (const spot of spots) {
    // The three constants of the model, plus how long to keep going after the
    // tips land. Low vapour and a long overrun gives open dendrites; high
    // vapour and a short one gives sectored plates. Both are real snow.
    const alpha = rng.float(0.9, 2.1);
    const beta = rng.float(0.33, 0.80);
    const gamma = rng.float(0.00008, 0.0025);
    const overrun = rng.float(0.4, 2.2);
    // The grid is deliberately far larger than the crystal: branching needs a
    // vapour gradient, and a reservoir close to the tips erases it.
    const stop = Math.max(16, Math.min(64, Math.round(spot.r / 8)));
    const crystal = Sekka.grow({
      radius: Math.round(stop / 0.42),
      stopExtent: stop,
      overrun,
      alpha, beta, gamma,
      maxSteps: 16000,
    });
    specimens.push({
      spot, alpha, beta, gamma, overrun, crystal,
      size: Sekka.scaleToFit(crystal.extent, spot.r),
      maxT: crystal.cells[crystal.cells.length - 1].t || 1,
    });
  }

  // Interleave the specimens by how far through their own growth each cell
  // froze, so the whole plate crystallises together instead of one at a time.
  const ops = [];
  specimens.forEach((sp, si) => {
    for (const cell of sp.crystal.cells) ops.push({ si, cell, k: cell.t / sp.maxT });
  });
  ops.sort((a, b) => a.k - b.k);

  const crystalLayer = createGraphics(plate.w, plate.h);
  crystalLayer.pixelDensity(1);
  crystalLayer.clear();

  // The plate itself: the field, and a hairline around each specimen with its
  // constants set beneath, the way a scientific plate is annotated.
  const frame = createGraphics(plate.w, plate.h);
  frame.pixelDensity(1);
  frame.background(pal.ground);
  const gRng = new Rng(seed + ':ground');
  frame.noStroke();
  for (let i = 0; i < (plate.w * plate.h) / 700; i++) {
    frame.fill(rgba(gRng.bool() ? '#ffffff' : '#000000', gRng.float(0.008, 0.04)));
    frame.circle(gRng.float(plate.w), gRng.float(plate.h), gRng.float(1, 4.5));
  }
  if (!spots[0].solo) {
    frame.textFont(Sheet.SERIF);
    frame.textAlign(CENTER, BASELINE);
    for (const sp of specimens) {
      frame.noFill();
      frame.stroke(rgba(pal.ink, pal.dark ? 0.22 : 0.18));
      frame.strokeWeight(1);
      frame.circle(sp.spot.x, sp.spot.y, sp.spot.r * 2.28);
      frame.noStroke();
      frame.fill(rgba(pal.ink, pal.dark ? 0.5 : 0.42));
      frame.textSize(9);
      frame.text(
        `α${sp.alpha.toFixed(2)}  β${sp.beta.toFixed(2)}  γ${sp.gamma.toFixed(4).slice(1)}`,
        sp.spot.x, sp.spot.y + sp.spot.r * 1.5
      );
    }
  }

  return {
    pal, plate, titleJa, titleRoman, specimens, ops,
    crystalLayer, frame,
    layers: [crystalLayer, frame],
  };
}

/* -------------------------------------------------------------------------- */

/** One cell of ice. Thicker ice is whiter, so the colour follows the water. */
function drawCell(ctx, x, y, size, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const px = x + size * Math.cos(a);
    const py = y + size * Math.sin(a);
    if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

Work.run({
  slug: 'sekka',
  revealFrames: 320,
  grainTint: 120,
  build,

  steps: (p) => p.ops.length,

  step(p, i) {
    const op = p.ops[i];
    const sp = p.specimens[op.si];
    const [dx, dy] = Sekka.position(op.cell.q, op.cell.r, sp.size);
    // thickness, mapped to how far the cell is from just-frozen to solid ice
    const t = Math.min(1, Math.max(0, (op.cell.s - 1) / 1.1));
    const fill = Work.mix(p.pal.crystalDark, p.pal.crystalLight, t);
    drawCell(
      p.crystalLayer.drawingContext,
      sp.spot.x + dx, sp.spot.y + dy,
      sp.size * 1.06,   // a hair oversized, so the lattice has no seams in it
      fill
    );
  },

  paint(p, g, quick) {
    g.image(p.frame, 0, 0);
    // Ice scatters light; on a dark ground that halo is most of what makes it
    // read as crystal rather than as a diagram of one.
    if (!quick && p.pal.glow) {
      const ctx = g.drawingContext;
      ctx.save();
      ctx.filter = 'blur(7px)';
      g.push();
      g.tint(255, 90);
      g.image(p.crystalLayer, 0, 0);
      g.pop();
      ctx.restore();
    }
    g.image(p.crystalLayer, 0, 0);
  },

  caption: (p) => ({
    titleJa: p.titleJa,
    fields: [
      p.titleRoman,
      '雪華 SEKKA',
      `${p.plate.ja} ${p.plate.roman}`,
      `${p.pal.name} ${p.pal.roman}`,
      p.specimens.length === 1 ? 'ONE SPECIMEN' : `${p.specimens.length} SPECIMENS`,
      p.seed.toUpperCase(),
    ],
  }),
});
