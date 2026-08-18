/**
 * 金継ぎ — Kintsugi
 *
 * A bowl is dropped. The pieces are joined with urushi lacquer and the seam is
 * dusted with gold, so the repair is the most conspicuous thing about the
 * object. The break is not concealed and not apologised for; it is where the
 * piece has been.
 *
 * The fracture is generated the way ceramic actually fails — radial cracks
 * from the point of impact, then chords laid across the sectors they leave —
 * and the shards are kept as straight-edged polygons. The raggedness is put
 * back at drawing time by a function seeded from each edge's own endpoints, so
 * the two shards either side of a crack generate the identical ragged line
 * without sharing any data. They still fit.
 *
 *   click / space   break another
 *   R               break this seed again
 *   S               save a PNG
 */
'use strict';

const TITLES = [
  ['金継ぎ', 'KINTSUGI'], ['継ぎ目', 'TSUGIME'], ['破鏡', 'HAKYŌ'],
  ['呼継', 'YOBITSUGI'], ['景色', 'KESHIKI'], ['傷跡', 'KIZUATO'],
];

function rgba(hex, a) {
  const [r, g, b] = Paper.hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

/* -------------------------------------------------------------------------- */

/** Where the vessels sit. One, given the whole plate, or a few smaller. */
function placeVessels(rng, plate) {
  const n = rng.weighted([[1, 6], [2, 3], [3, 2]]);
  if (n === 1) {
    return [{ x: plate.w / 2, y: plate.h * 0.48, r: Math.min(plate.w, plate.h) * 0.40 }];
  }
  // Sized from the space each one actually gets, so they never grow into
  // each other however many there are.
  const along = plate.h > plate.w;
  const cell = (along ? plate.h : plate.w) / n;
  const r = Math.min(cell * 0.42, Math.min(plate.w, plate.h) * 0.40);
  const spots = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    spots.push({
      x: along ? plate.w * (0.5 + rng.float(-0.05, 0.05)) : plate.w * t,
      y: along ? plate.h * t : plate.h * (0.48 + rng.float(-0.04, 0.04)),
      r: r * rng.float(0.86, 1.0),
    });
  }
  return spots;
}

function build(seed, rng) {
  const pal = rng.pick(PALETTES);
  const plate = Sheet.pickFormat(rng);
  const metal = rng.weighted(METALS.map((m) => [m, m.weight]));
  const [titleJa, titleRoman] = rng.pick(TITLES);

  const vessels = [];
  for (const spot of placeVessels(rng, plate)) {
    const R = spot.r;
    const squash = rng.float(0.93, 1.0);
    const harm = [
      [rng.float(0.004, 0.014), rng.int(2, 3), rng.float(6.28)],
      [rng.float(0.003, 0.010), rng.int(4, 6), rng.float(6.28)],
    ];
    const outline = [];
    const rimKeys = new Set();
    const N = 108;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      let f = 1;
      for (const [amp, k, p] of harm) f += amp * Math.sin(k * a + p);
      const x = spot.x + Math.cos(a) * R * f;
      const y = spot.y + Math.sin(a) * R * f * squash;
      outline.push(x, y);
      rimKeys.add(`${Math.round(x * 4)},${Math.round(y * 4)}`);
    }

    const ia = rng.float(Math.PI * 2);
    const id = R * rng.float(0.1, 0.55);
    const impact = [spot.x + Math.cos(ia) * id, spot.y + Math.sin(ia) * id * squash];
    const total = Fracture.area(outline);
    const shards = Fracture.shatter(rng, {
      outline, impact,
      radial: rng.int(2, 4),
      extra: rng.int(16, 34),
      jitter: R * 0.09,
      minArea: total * 0.0035,
    });

    // An edge is part of the rim, not a crack, exactly when both its ends are
    // original outline vertices — clipping only ever inserts new points along
    // the cut, so two survivors can only be adjacent if they always were.
    const amp = R * 0.017;
    const isRim = (ax, ay, bx, by) =>
      rimKeys.has(`${Math.round(ax * 4)},${Math.round(ay * 4)}`) &&
      rimKeys.has(`${Math.round(bx * 4)},${Math.round(by * 4)}`);

    const drawn = [];
    const seen = new Set();
    const seams = [];
    for (const poly of shards) {
      drawn.push({
        poly,
        outline: Fracture.raggedOutline(poly, amp, isRim),
        tone: rng.pick(pal.glaze),
        toneAlpha: rng.float(0.05, 0.22),
        area: Fracture.area(poly),
      });
      const n = poly.length / 2;
      for (let i = 0; i < n; i++) {
        const ax = poly[i * 2], ay = poly[i * 2 + 1];
        const bx = poly[((i + 1) % n) * 2], by = poly[((i + 1) % n) * 2 + 1];
        if (isRim(ax, ay, bx, by)) continue;
        const key = Fracture.edgeKey(ax, ay, bx, by);
        if (seen.has(key)) continue;
        seen.add(key);
        seams.push({ pts: Fracture.crackEdge(ax, ay, bx, by, amp), w: R * rng.float(0.005, 0.010) });
      }
    }
    // longest seams first, so the repair reads as main joins then fine ones
    seams.sort((a, b) => b.pts.length - a.pts.length);
    drawn.sort((a, b) => b.area - a.area);
    vessels.push({ ...spot, R, squash, outline, impact, shards: drawn, seams });
  }

  const shardLayer = createGraphics(plate.w, plate.h);
  shardLayer.pixelDensity(1);
  shardLayer.clear();
  const goldLayer = createGraphics(plate.w, plate.h);
  goldLayer.pixelDensity(1);
  goldLayer.clear();

  // The field, and the shadow each vessel drops on it.
  const ground = createGraphics(plate.w, plate.h);
  ground.pixelDensity(1);
  ground.background(pal.ground);
  const gRng = new Rng(seed + ':ground');
  ground.noStroke();
  for (let i = 0; i < (plate.w * plate.h) / 800; i++) {
    ground.fill(rgba(gRng.bool() ? '#ffffff' : '#000000', gRng.float(0.008, 0.04)));
    ground.circle(gRng.float(plate.w), gRng.float(plate.h), gRng.float(1, 5));
  }
  const gctx = ground.drawingContext;
  for (const v of vessels) {
    gctx.save();
    gctx.filter = `blur(${v.R * 0.09}px)`;
    gctx.fillStyle = rgba('#000000', pal.dark ? 0.5 : 0.34);
    gctx.beginPath();
    gctx.ellipse(v.x + v.R * 0.05, v.y + v.R * 0.10, v.R * 1.02, v.R * 1.02 * v.squash, 0, 0, Math.PI * 2);
    gctx.fill();
    gctx.restore();
  }

  const ops = [];
  vessels.forEach((v, vi) => v.shards.forEach((_, i) => ops.push({ t: 'shard', vi, i })));
  vessels.forEach((v, vi) => v.seams.forEach((_, i) => ops.push({ t: 'seam', vi, i })));

  return {
    pal, plate, metal, titleJa, titleRoman, vessels, ops,
    shardLayer, goldLayer, ground,
    drawRng: new Rng(seed + ':draw'),
    layers: [shardLayer, goldLayer, ground],
  };
}

/* -------------------------------------------------------------------------- */

function path(pts) {
  const p = new Path2D();
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  p.closePath();
  return p;
}

/**
 * One shard.
 *
 * The glaze gradient is defined in the vessel's coordinates, not the shard's,
 * so it runs continuously across every piece and the bowl still reads as one
 * curved object that happens to be in bits. Only the firing variation and the
 * crazing belong to the individual shard.
 */
function drawShard(g, v, sh, pal, rng) {
  const ctx = g.drawingContext;
  const p = path(sh.outline);

  const grad = ctx.createLinearGradient(
    v.x - v.R * 0.9, v.y - v.R * 0.9,
    v.x + v.R * 0.7, v.y + v.R * 0.95
  );
  grad.addColorStop(0, Work.mix(pal.glaze[0], pal.glazeLight, 0.55));
  grad.addColorStop(0.45, pal.glaze[0]);
  grad.addColorStop(1, Work.mix(pal.glaze[0], pal.glazeDark, 0.72));
  ctx.fillStyle = grad;
  ctx.fill(p);

  ctx.save();
  ctx.clip(p);
  // this piece came out of a different part of the kiln
  ctx.fillStyle = rgba(sh.tone, sh.toneAlpha);
  ctx.fill(p);

  // the well of the bowl, drawn in vessel coordinates so it stays continuous
  ctx.strokeStyle = rgba(pal.glazeDark, 0.3);
  ctx.lineWidth = v.R * 0.03;
  ctx.beginPath();
  ctx.ellipse(v.x, v.y, v.R * 0.63, v.R * 0.63 * v.squash, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 貫入 — the glaze crazes as it cools, finer than any crack
  g.noFill();
  for (let i = 0; i < rng.int(3, 10); i++) {
    g.stroke(rgba(pal.crackle, rng.float(0.06, 0.2)));
    g.strokeWeight(rng.float(0.4, 0.9));
    let x = v.x + rng.gauss(0, v.R * 0.5);
    let y = v.y + rng.gauss(0, v.R * 0.5);
    let a = rng.float(Math.PI * 2);
    g.beginShape();
    for (let k = 0; k < 7; k++) {
      g.vertex(x, y);
      a += rng.gauss(0, 0.5);
      x += Math.cos(a) * v.R * 0.09;
      y += Math.sin(a) * v.R * 0.09;
    }
    g.endShape();
  }
  ctx.restore();

  // the broken edge itself, before any lacquer goes on
  ctx.strokeStyle = rgba(pal.glazeDark, 0.55);
  ctx.lineWidth = Math.max(0.8, v.R * 0.004);
  ctx.stroke(p);
}

/**
 * A tapered ribbon along a polyline: the polygon swept by a width that varies
 * from end to end. Stroking with a round cap instead — which is the obvious
 * way — leaves a bead at every joint between runs, and a seam made of beads
 * reads as rope lying on the bowl rather than as metal lying in it.
 */
function ribbon(pts, halfWidth) {
  const n = pts.length / 2;
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const px = pts[i * 2];
    const py = pts[i * 2 + 1];
    const a = Math.max(0, i - 1) * 2;
    const b = Math.min(n - 1, i + 1) * 2;
    let tx = pts[b] - pts[a];
    let ty = pts[b + 1] - pts[a + 1];
    const d = Math.hypot(tx, ty) || 1;
    tx /= d; ty /= d;
    const h = halfWidth(n === 1 ? 0 : i / (n - 1));
    left.push(px - ty * h, py + tx * h);
    right.push(px + ty * h, py - tx * h);
  }
  const poly = left.slice();
  for (let i = right.length - 2; i >= 0; i -= 2) poly.push(right[i], right[i + 1]);
  return poly;
}

/**
 * One seam.
 *
 * Gold is dusted onto a bed of lacquer by hand, so the line swells and thins
 * along its length and comes to nothing where it meets another seam or the
 * rim. Three ribbons: the lacquer bed, the gold itself, and a narrower
 * highlight set up and to the left where the light is.
 */
function drawSeam(g, seam, metal, rng) {
  const ctx = g.drawingContext;
  const w = seam.w;
  const phase = rng.float(Math.PI * 2);
  const freq = rng.float(4, 11);
  const swell = rng.float(0.85, 1.2);
  // tapered at both ends, wandering in between
  const profile = (t) => {
    const ends = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.42);
    return w * swell * (0.62 + 0.38 * ends) * (1 + 0.22 * Math.sin(t * freq + phase)) * ends;
  };

  const bed = ribbon(seam.pts, (t) => profile(t) * 1.45);
  ctx.fillStyle = rgba(metal.dark, 0.62);
  ctx.fill(path(bed));

  ctx.fillStyle = metal.mid;
  ctx.fill(path(ribbon(seam.pts, profile)));

  ctx.save();
  ctx.translate(-w * 0.3, -w * 0.34);
  ctx.fillStyle = rgba(metal.bright, 0.8);
  ctx.fill(path(ribbon(seam.pts, (t) => profile(t) * 0.34)));
  ctx.restore();

  // a little dust that missed the joint
  g.noStroke();
  for (let i = 0; i < seam.pts.length; i += 6) {
    if (!rng.bool(0.10)) continue;
    g.fill(rgba(metal.bright, rng.float(0.15, 0.4)));
    g.circle(seam.pts[i] + rng.gauss(0, w * 1.4), seam.pts[i + 1] + rng.gauss(0, w * 1.4),
             rng.float(0.4, 1.1));
  }
}

/* -------------------------------------------------------------------------- */

Work.run({
  slug: 'kintsugi',
  revealFrames: 300,
  grainTint: 120,
  build,

  steps: (p) => p.ops.length,

  step(p, i) {
    const op = p.ops[i];
    const v = p.vessels[op.vi];
    if (op.t === 'shard') {
      drawShard(p.shardLayer, v, v.shards[op.i], p.pal, p.drawRng);
    } else {
      drawSeam(p.goldLayer, v.seams[op.i], p.metal, p.drawRng);
    }
  },

  paint(p, g, quick) {
    g.image(p.ground, 0, 0);
    g.image(p.shardLayer, 0, 0);
    if (!quick) {
      // metal throws light back at the room
      const ctx = g.drawingContext;
      ctx.save();
      ctx.filter = 'blur(6px)';
      g.push();
      g.tint(255, 80);
      g.image(p.goldLayer, 0, 0);
      g.pop();
      ctx.restore();
    }
    g.image(p.goldLayer, 0, 0);
  },

  caption: (p) => ({
    titleJa: p.titleJa,
    fields: [
      p.titleRoman,
      '金継ぎ KINTSUGI',
      `${p.plate.ja} ${p.plate.roman}`,
      `${p.pal.name} ${p.pal.roman}`,
      `${p.metal.ja} ${p.metal.roman}`,
      `${p.vessels.reduce((n, v) => n + v.shards.length, 0)} SHARDS`,
      p.seed.toUpperCase(),
    ],
  }),
});
