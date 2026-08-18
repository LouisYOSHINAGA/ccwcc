/**
 * 組子 — Kumiko
 *
 * Joinery without nails. A coarse base grid of cypress strips, divided into
 * sections, each section filled with a pattern that is itself a construction
 * on a lattice — hemp leaf, seven treasures, sesame husk, well curb.
 *
 * The counterweight to the first two works in this series: nothing here flows.
 * Every line is straight, every angle is decided in advance, and the only
 * softness allowed is that no strip is quite where it should be, because a
 * person cut it.
 *
 *   click / space   a new panel
 *   R               build this seed again
 *   S               save a PNG
 */
'use strict';

const TITLES = [
  ['組子', 'KUMIKO'], ['明障子', 'AKARI-SHŌJI'], ['連子', 'RENJI'],
  ['欄間', 'RANMA'], ['格子', 'KŌSHI'], ['地組', 'JIGUMI'],
];

function rgba(hex, a) {
  const [r, g, b] = Paper.hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

/* -------------------------------------------------------------------------- */
/* building the panel                                                          */
/* -------------------------------------------------------------------------- */

function build(seed, rng) {
  const pal = rng.pick(PALETTES);
  const plate = Sheet.pickFormat(rng);
  const short = Math.min(plate.w, plate.h);
  const [titleJa, titleRoman] = rng.pick(TITLES);

  // The frame: an outer stile, and rails between the sections.
  const stile = short * rng.float(0.028, 0.045);
  const rail = stile * rng.float(0.55, 0.8);
  const strip = short * rng.float(0.0055, 0.0085);

  const inner = {
    x: stile, y: stile,
    w: plate.w - stile * 2,
    h: plate.h - stile * 2,
  };
  const sections = Kumiko.split(rng, inner, rng.weighted([[2, 3], [3, 5], [4, 4], [5, 2]]));

  // Each section gets its own pattern, and no two neighbours the same.
  const strips = [];
  const used = [];
  for (const sec of sections) {
    let motif;
    for (let attempt = 0; attempt < 12; attempt++) {
      motif = rng.weighted(Kumiko.MOTIFS.map((m) => [m, m.weight]));
      if (!used.includes(motif.id) || attempt > 7) break;
    }
    used.push(motif.id);
    sec.motif = motif;

    // Fill the section proper, inside the rails that surround it.
    const field = {
      x: sec.x + rail / 2, y: sec.y + rail / 2,
      w: sec.w - rail, h: sec.h - rail,
    };
    const want = Math.min(field.w, field.h) * rng.float(motif.pitch[0], motif.pitch[1]);
    // Finer patterns are cut from finer stock — a constant strip width turns
    // a dense asanoha into a solid block of wood.
    const sw = Math.min(strip, Math.max(strip * 0.42, want * 0.115));
    for (const line of motif.fn(field, want)) {
      for (const piece of Kumiko.clipPolyline(line, field)) {
        strips.push({ pts: piece, w: sw * rng.float(0.9, 1.12), kind: 'leaf' });
      }
    }
  }

  // The frame is added last so it draws over the cut ends of the leaves, and
  // is revealed first, because that is the order a panel is actually built.
  const frame = [];
  for (const sec of sections) {
    frame.push({ pts: [sec.x, sec.y, sec.x + sec.w, sec.y], w: rail, kind: 'rail' });
    frame.push({ pts: [sec.x, sec.y + sec.h, sec.x + sec.w, sec.y + sec.h], w: rail, kind: 'rail' });
    frame.push({ pts: [sec.x, sec.y, sec.x, sec.y + sec.h], w: rail, kind: 'rail' });
    frame.push({ pts: [sec.x + sec.w, sec.y, sec.x + sec.w, sec.y + sec.h], w: rail, kind: 'rail' });
  }
  const h = stile / 2;
  frame.push({ pts: [0, h, plate.w, h], w: stile, kind: 'stile' });
  frame.push({ pts: [0, plate.h - h, plate.w, plate.h - h], w: stile, kind: 'stile' });
  frame.push({ pts: [h, 0, h, plate.h], w: stile, kind: 'stile' });
  frame.push({ pts: [plate.w - h, 0, plate.w - h, plate.h], w: stile, kind: 'stile' });

  const leafLayer = createGraphics(plate.w, plate.h);
  leafLayer.pixelDensity(1);
  leafLayer.clear();
  const frameLayer = createGraphics(plate.w, plate.h);
  frameLayer.pixelDensity(1);
  frameLayer.clear();

  // The lit paper behind: brightest a little above centre, as a lamp would be.
  const ground = createGraphics(plate.w, plate.h);
  ground.pixelDensity(1);
  const gctx = ground.drawingContext;
  const grad = gctx.createRadialGradient(
    plate.w * rng.float(0.4, 0.6), plate.h * rng.float(0.32, 0.5), 0,
    plate.w * 0.5, plate.h * 0.5, Math.hypot(plate.w, plate.h) * 0.62
  );
  grad.addColorStop(0, pal.glow);
  grad.addColorStop(1, pal.glowEdge);
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, plate.w, plate.h);
  // the tooth of the paper stretched over the frame
  ground.noStroke();
  const gRng = new Rng(seed + ':ground');
  for (let i = 0; i < (plate.w * plate.h) / 900; i++) {
    ground.fill(rgba(gRng.bool() ? '#ffffff' : '#000000', gRng.float(0.01, 0.05)));
    ground.circle(gRng.float(plate.w), gRng.float(plate.h), gRng.float(1, 5));
  }

  return {
    pal, plate, titleJa, titleRoman, sections,
    order: frame.concat(strips),
    frameCount: frame.length,
    strip,
    drawRng: new Rng(seed + ':draw'),
    leafLayer, frameLayer, ground,
    layers: [leafLayer, frameLayer, ground],
  };
}

/* -------------------------------------------------------------------------- */
/* drawing one strip                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A strip of cypress.
 *
 * Backlit, it is a silhouette: no highlight is possible, only the soft bleed
 * where light wraps past the edge of the wood. Front-lit, it is the opposite —
 * a pale face with a bevel down one side and its shadow on the paper below.
 * Getting this backwards is what makes rendered joinery look like a diagram.
 */
function drawStrip(ctx, s, pal, jitter) {
  const path = new Path2D();
  path.moveTo(s.pts[0], s.pts[1]);
  for (let i = 2; i < s.pts.length; i += 2) path.lineTo(s.pts[i], s.pts[i + 1]);

  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = pal.backlit ? rgba(pal.wood, 0.96) : pal.wood;
  ctx.lineWidth = s.w * jitter;
  ctx.stroke(path);

  if (!pal.backlit) {
    // the bevel down the shaded side of the stock
    ctx.save();
    ctx.translate(s.w * 0.22, s.w * 0.26);
    ctx.strokeStyle = rgba(pal.woodDark, 0.5);
    ctx.lineWidth = s.w * 0.34;
    ctx.stroke(path);
    ctx.restore();
  }
}

/* -------------------------------------------------------------------------- */

Work.run({
  slug: 'kumiko',
  revealFrames: 300,
  grainTint: 120,
  build,

  steps: (p) => p.order.length,

  step(p, i) {
    const s = p.order[i];
    const target = i < p.frameCount ? p.frameLayer : p.leafLayer;
    drawStrip(target.drawingContext, s, p.pal, p.drawRng.float(0.92, 1.1));
  },

  /**
   * The soft part of the light is one pass over the finished lattice, not a
   * filter on every strip: a panel has thousands of them, and blurring each
   * one separately costs about fifteen seconds a sheet to produce an effect
   * that is identical when done once at the end.
   *
   * Backlit, that pass is a bleed in place — light wrapping past the edge of
   * the wood. Front-lit it is offset, and it is a shadow on the paper behind.
   */
  paint(p, g, quick) {
    g.image(p.ground, 0, 0);
    const ctx = g.drawingContext;
    if (!quick) {
      const back = p.pal.backlit;
      ctx.save();
      ctx.filter = `blur(${p.strip * (back ? 0.8 : 0.7)}px)`;
      g.push();
      g.tint(255, back ? 78 : 128);
      if (!back) g.translate(p.strip * 0.5, p.strip * 0.7);
      g.image(p.leafLayer, 0, 0);
      g.image(p.frameLayer, 0, 0);
      g.pop();
      ctx.restore();
    }
    g.image(p.leafLayer, 0, 0);
    g.image(p.frameLayer, 0, 0);
  },

  caption: (p) => ({
    titleJa: p.titleJa,
    fields: [
      p.titleRoman,
      '組子 KUMIKO',
      `${p.plate.ja} ${p.plate.roman}`,
      `${p.pal.name} ${p.pal.roman}`,
      p.sections.map((s) => s.motif.roman).join(' + '),
      p.seed.toUpperCase(),
    ],
  }),
});
