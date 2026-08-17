# ccwcc

Generative works in the browser, made with [p5.js](https://p5js.org/).

Every piece is a pure function of a short seed string, so any result can be
reproduced exactly by asking for it by name — `?seed=kuroshio-71`. Nothing
touches `Math.random()` once generation begins.

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

| | |
|---|---|
| click / space | a new sheet |
| R | pour this seed again |
| S | save a PNG |
| `?seed=…` | reproduce a particular sheet |
| `?still=1` | skip the pour animation |

## Layout

```
common/       shared helpers — seeded RNG, paper and grain textures
lib/          vendored p5.js
sketches/     one directory per work, each self-contained
```
