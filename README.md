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

### 03 · 組子 — Kumiko

`sketches/03-kumiko/`

Joinery without nails: a coarse base grid (地組) of thin cypress strips, with
smaller leaves slotted into it. The counterweight to the first two works —
nothing here flows, every line is straight, and the only softness allowed is
that no strip is quite where it should be.

Each traditional pattern is a construction on a lattice, so each is a short
function: 麻の葉 is a triangular lattice plus, in every triangle, a spoke from
each corner to the centroid — six of those meet at every lattice point, which
is the six-pointed star the pattern is named for. 七宝 is circles on a square
lattice of pitch r√2, so each cuts its four neighbours. The panel is divided by
guillotine cuts at ratios that are never a half, and strips are generated
across a whole section and then cut to it, which is how the real thing works.

Palettes decide whether the panel is seen from the lit side or the dark side of
a lit room. That is not a colour swap: a backlit strip is a silhouette with no
highlight at all, only the soft bleed where light wraps past the wood, while a
front-lit one is a pale face with a bevel and a shadow on the paper behind.

### 04 · 雪華 — Sekka

`sketches/04-sekka/`

In 1832 Doi Toshitsura, lord of Koga, published 雪華図説 — snow crystals seen
through an imported Dutch microscope and cut as woodblock plates, the first
such record in Japan. The pattern went straight onto kimono. This is that
plate, with the crystals grown rather than observed.

Reiter's cellular automaton (2005) on a hexagonal lattice. Each cell holds an
amount of water; a cell is *receptive* if it is frozen or touches something
frozen, and its water is taken out of circulation and can only be added to.
Everything else diffuses:

```
u ← u + (α/2)(mean of the six neighbours − u)     free water
v ← v + γ                        for receptive cells, locked into the crystal
```

Three constants and one seed cell, and out of it comes the whole morphology
diagram — plates, sectored plates, stellar dendrites. Nothing about six-fold
symmetry is written down anywhere; it is a consequence of starting from one
frozen cell on a lattice that has it, which is also why real snow does it.

Two things had to be right to get snowflakes rather than hexagons. Branching is
a diffusive instability, so it needs a vapour gradient: the grid is kept far
larger than the crystal, because a reservoir close to the tips feeds them and
the notches equally and the whole thing fills in solid. And growth must not
stop when the first tip lands — the side branches and the thickening all
happen after that, so it keeps going for a set fraction longer.

Each specimen is annotated with the constants it grew from.

### 05 · 金継ぎ — Kintsugi

`sketches/05-kintsugi/`

A bowl is dropped, and the pieces are joined with lacquer and dusted with gold,
so the repair becomes the most conspicuous thing about the object. The break is
not concealed; it is where the piece has been.

A dropped ceramic does not craze into a Voronoi diagram. It fails from the
point of impact: radial cracks run outward first, then circumferential ones
cross between them. So the break is generated in those two phases — radial
lines through one point (each missing it slightly, or the result is a wheel),
then chords laid square to the direction each crack came from.

Shards are kept as straight-edged convex polygons, which half-plane clipping
preserves, and the raggedness is put back at drawing time by a crack function
seeded from each edge's own endpoints. The two shards either side of a crack
therefore generate the identical ragged line without sharing any data — they
still fit, and the shatter conserves 100% of the area.

The glaze gradient is defined in the vessel's coordinates rather than each
shard's, so it runs continuously across the pieces and the bowl still reads as
one curved object that happens to be in bits. Seams are drawn as tapered
ribbons rather than stroked polylines: a round cap leaves a bead at every
joint, and a seam made of beads reads as rope lying on the bowl rather than
metal lying in it.

### 06 · 算額 — Sangaku

`sketches/06-sangaku/`

In the Edo period, a mathematician who solved a problem worth keeping painted
it on a wooden tablet and hung it under the eaves of a shrine — an offering,
and a challenge to whoever came next. Around nine hundred survive. Most are
geometry, and most of the geometry is circles inside other circles.

The figure is the Apollonian gasket, from Descartes' circle theorem: four
mutually tangent circles satisfy

```
(k1 + k2 + k3 + k4)² = 2(k1² + k2² + k3² + k4²)
```

in curvature, with a companion identity in the complex plane weighting each
curvature by its centre, which locates the fourth circle. Both are quadratics,
so each triple admits two tangent circles; knowing one, the other follows by
reflection — `k' = 2(k1+k2+k3) − k` and the same for `kz` — which is exact,
cheap, and the entire recursion. The generated packing conserves tangency to
floating-point precision: nothing overlaps and nothing escapes the outer
circle.

The theorem appears on a sangaku from Gunma dated 1796, thirty years before
Philip Beecroft rediscovered it in the West.

Circles are drawn with a slight departure from true, because these were brushed
by hand onto a plank; the timber grain is kept faint, since the smallest
circles in a gasket are a pixel wide and lose that argument otherwise.

## Layout

```
common/       shared helpers — seeded RNG, paper and grain textures, sheet
              presentation, the work lifecycle, contour tracing
lib/          vendored p5.js
sketches/     one directory per work, each self-contained
```

All works are printed on the same sheet at the same size, with the caption on
the same line and the seal in the same corner; only the plate changes shape.
That constancy is what makes a set of unrelated algorithms read as one body of
work rather than a folder of demos.
