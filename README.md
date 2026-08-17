# ccwcc

Generative works in the browser, made with [p5.js](https://p5js.org/).

Every piece is a pure function of a short seed string, so any result can be
brought back by asking for it by name — `?seed=kuroshio-71`. Nothing touches
`Math.random()` once generation begins. (The geometry is exact; a few hundred
pixels along blurred shadow edges can differ between runs, because the
browser's canvas blur is not itself bit-deterministic.)

## Running it

No build step, no dependencies to fetch — p5 is vendored in `lib/`. Any static
server will do:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

Opening `index.html` from the filesystem works in most browsers too, though
some block loading the local scripts.

## Works

### 01 · 墨流し — Suminagashi

`sketches/01-suminagashi/`

Suminagashi ("flowing ink") is a 12th-century Japanese marbling technique: ink
is touched to the surface of still water with a brush, alternating with a brush
of clear surfactant, and the resulting film is lifted onto a sheet of paper.

The whole piece is two operations applied to circles, both from A. Jaffer's
*Marbling Mathematics* (2013):

- **A drop.** Water is incompressible and the film is thin, so a new drop of
  radius `r` displaces every existing point at distance `d` to `√(d² + r²)`.
  Nothing is lost, only rearranged — which is why the entire history of the
  piece stays legible in the spacing of the bands.
- **A comb.** Dragging a needle through the surface displaces points along the
  direction of travel, decaying exponentially with distance from the line. Bend
  that line into a sinusoid first and you get the plumed, feathered edges that
  a real comb pull leaves.

Everything else is composition: where the brush lands, how far the centre
wanders between touches, the rhythm of ink against clear, and how the sheet is
combed afterwards. Drop radii are solved for coverage rather than guessed, so a
sheet never ends in a hard accidental edge halfway down the page.

The marbled area is not always the whole sheet. Four traditional formats —
全紙, 色紙, 短冊, 横物 — decide how much paper is deliberately left alone, and
the caption sits at a fixed height regardless so the works hang together as a
series.

| | |
|---|---|
| click / space | a new sheet |
| R | pour this seed again |
| S | save a PNG |
| `?seed=…` | reproduce a particular sheet |
| `?still=1` | skip the pour animation |

### 02 · 枯山水 — Karesansui

`sketches/02-karesansui/`

A dry garden: gravel, some stones set in it, moss where the damp collects at
their feet. Companion to 01 — that piece is ink displaced by drops on water,
this one is gravel that never moves at all.

The furrows are not drawn one at a time. A karesansui is raked outward from the
stones and inward from the edge, and the two patterns meet wherever they happen
to meet — which is exactly a level set. Let φ(p) be the distance from p to the
nearest thing already there:

```
φ = smin( distance to the gardener's starting edge,
          distance to stone 1, distance to stone 2, … )
```

Contour it at one rake-tooth apart and the rings around the stones, the
straight lines in the open gravel, and the seams between them all fall out
together. `smin` is a polynomial smooth minimum: a hard `min` creases where two
sources meet, and gravel cannot hold a crease.

Stones are star-shaped about their centres, so a stone's outline and its
distance function come from the same radial profile and cannot disagree. The
drawn silhouette is a coarse polygon sampled from that profile — garden stones
are quarried and split, not river-worn — shaded as a flat top face with a ring
of bevels, since from directly overhead that is what there is to see.

The contour tracer in `common/contours.js` stitches marching-squares output
back into ordered polylines, keyed on grid edge indices rather than on
coordinates. A furrow has to know where it starts and ends: each one is stroked
twice, offset either side of where the line actually runs, and that pair is the
whole reason the result reads as raked sand rather than as a contour map.

| | |
|---|---|
| click / space | a new garden |
| R | rake this seed again |
| S | save a PNG |

## Layout

```
common/       shared helpers — seeded RNG, paper textures, sheet presentation,
              contour tracing
lib/          vendored p5.js
sketches/     one directory per work, each self-contained
```

All works are printed on the same sheet at the same size, with the caption on
the same line and the seal in the same corner; only the plate changes shape.
That constancy is what makes a set of unrelated algorithms read as one body of
work rather than a folder of demos.
