/**
 * work.js — the part of every piece that is not the piece.
 *
 * Each work in this series answers the same four questions — what to build
 * from a seed, how many steps it takes to draw, how to draw one, and what the
 * caption says — and then needs the same two hundred lines of canvas setup,
 * layer juggling, URL handling and key bindings around it. That scaffolding
 * lives here once, so a sketch file contains only its own idea.
 *
 * A work supplies:
 *
 *   build(seed, rng)      -> piece state; must include `plate` and `pal`
 *   steps(piece)          -> how many draw steps the reveal has
 *   step(piece, i)        -> perform step i, drawing into the piece's layers
 *   paint(piece, g, quick)-> composite the plate, in plate-local coordinates
 *   caption(piece)        -> { titleJa, fields }
 *
 * `pal` must carry `paper` (the mount colour) and may carry `dark` and `ink`.
 */
(function (global) {
  'use strict';

  const SIZE = Sheet.SIZE;

  let cfg = null;
  let piece = null;
  let sheetLayer = null;
  let grainLayer = null;
  let dirty = true;
  let still = false;

  function mix(a, b, t) {
    const A = Paper.hexToRgb(a);
    const B = Paper.hexToRgb(b);
    const c = A.map((v, i) => Math.min(255, Math.max(0, Math.round(v + (B[i] - v) * t))));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function dispose(p) {
    if (!p) return;
    for (const l of p._layers || []) if (l) l.remove();
  }

  function generate(seed) {
    const rng = new Rng(seed);
    noiseSeed(hashString(String(seed)));

    const next = cfg.build(String(seed), rng);
    next.seed = String(seed);
    next.rng = rng;
    next._layers = (next.layers || []).slice();

    const pal = next.pal;
    const plate = next.plate;
    next.paper = Paper.makePaper(window, SIZE.w, SIZE.h, {
      rng: new Rng(seed + ':paper'),
      base: pal.paper,
      dark: pal.dark,
      laid: cfg.laid !== false,
    });
    next.film = Paper.makeFilm(window, plate.w, plate.h, {
      rng: new Rng(seed + ':film'),
      strength: cfg.filmStrength ?? (pal.dark ? 18 : 26),
    });
    next.seal = Sheet.makeSeal(window, 58, new Rng(seed + ':seal'),
      pal.dark ? '#C4443F' : '#A82730');
    next._layers.push(next.paper, next.film, next.seal);

    next.total = cfg.steps ? cfg.steps(next) : 0;
    next.cursor = 0;
    next.reveal = 0;
    // A reveal is paced by how long it should take to watch, not by how much
    // work there is: some of these draw a whole sheet in a few milliseconds.
    next.perFrame = cfg.revealFrames ? next.total / cfg.revealFrames : Infinity;

    dispose(piece);
    piece = next;
    dirty = true;
    window.__ready = false;
    window.piece = piece;
    updateHud();
  }

  /**
   * @param {number} budgetMs 0 to finish immediately; otherwise a guard against
   *   a single frame running long on a dense sheet.
   */
  function advance(budgetMs) {
    if (!cfg.step) return;
    const start = performance.now();
    const all = budgetMs === 0;
    if (!all) piece.reveal += piece.perFrame;
    let ran = 0;
    while (piece.cursor < piece.total && (all || piece.cursor < piece.reveal)) {
      cfg.step(piece, piece.cursor++);
      ran++;
      if (!all && ran % 8 === 0 && performance.now() - start > budgetMs) break;
    }
    if (ran) dirty = true;
  }

  function rebuild(quick) {
    const plate = piece.plate;
    const pal = piece.pal;

    sheetLayer.clear();
    sheetLayer.image(piece.paper, 0, 0);

    const ctx = sheetLayer.drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(plate.x, plate.y, plate.w, plate.h);
    ctx.clip();
    sheetLayer.push();
    sheetLayer.translate(plate.x, plate.y);
    cfg.paint(piece, sheetLayer, quick);
    sheetLayer.pop();

    if (!quick) {
      sheetLayer.push();
      sheetLayer.blendMode(MULTIPLY);
      sheetLayer.image(piece.film, plate.x, plate.y);
      sheetLayer.pop();
    }
    ctx.restore();

    Sheet.plateMark(sheetLayer, plate, pal.dark);

    const cap = cfg.caption(piece);
    const ink = cap.ink || pal.ink || (pal.dark ? mix(pal.paper, '#ffffff', 0.82) : '#241F19');
    Sheet.drawCaption(window, sheetLayer, {
      titleJa: cap.titleJa,
      fields: cap.fields,
      ink,
      faint: cap.faint || mix(ink, pal.paper, 0.5),
      seal: piece.seal,
    });

    if (!quick) {
      Paper.vignette(sheetLayer, {
        alpha: pal.dark ? 0.32 : 0.2,
        color: pal.dark ? '0, 0, 0' : '48, 38, 26',
      });
    }
  }

  function updateHud() {
    const el = document.getElementById('seed');
    if (el) el.textContent = piece.seed;
    const url = new URL(location.href);
    url.searchParams.set('seed', piece.seed);
    history.replaceState(null, '', url);
  }

  /** Install the p5 lifecycle for one work. */
  function run(config) {
    cfg = config;

    global.setup = function () {
      const params = new URLSearchParams(location.search);
      still = params.get('still') === '1';
      const seed = params.get('seed') || randomSeed();
      if (still) {
        const hud = document.getElementById('hud');
        if (hud) hud.style.display = 'none';
      }

      const c = createCanvas(SIZE.w, SIZE.h);
      c.parent('stage');
      pixelDensity(1);

      sheetLayer = createGraphics(SIZE.w, SIZE.h);
      sheetLayer.pixelDensity(1);
      grainLayer = Paper.makeGrain(window, SIZE.w, SIZE.h, {
        rng: new Rng('grain'),
        strength: cfg.grain ?? 21,
      });

      Sheet.fitToWindow(window);
      generate(seed);
      if (still) {
        advance(0);
        rebuild(false);
      }
    };

    global.draw = function () {
      const busy = piece.cursor < piece.total;
      if (busy) advance(16);
      if (dirty || (!busy && !window.__ready)) {
        rebuild(piece.cursor < piece.total);
        dirty = false;
      }
      if (!busy) window.__ready = true;

      image(sheetLayer, 0, 0);
      push();
      blendMode(OVERLAY);
      tint(255, cfg.grainTint ?? 140);
      image(grainLayer, 0, 0);
      pop();
    };

    global.windowResized = function () { Sheet.fitToWindow(window); };

    global.mousePressed = function () {
      if (mouseX >= 0 && mouseY >= 0 && mouseX <= width && mouseY <= height) {
        generate(randomSeed());
      }
    };

    global.keyPressed = function () {
      if (key === ' ') generate(randomSeed());
      else if (key === 'r' || key === 'R') generate(piece.seed);
      else if (key === 's' || key === 'S') saveCanvas(`${cfg.slug}-${piece.seed}`, 'png');
    };
  }

  global.Work = { run, mix, get piece() { return piece; } };
})(window);
