# [Pofo 26] Trace hero

An interactive portfolio hero for Janice Khang. Pointer movements create restrained curves; circles resolve into quiet orbits. A three-second sound sequence replays movement history.

## Run locally

Open `index.html` in a modern browser, or serve this directory:

```sh
python3 -m http.server 8080
```

Then visit http://localhost:8080. No installation or build step is required.

## Interactions

- Move your pointer or drag on touch screens to leave smooth curves.
- Draw a small circle to form a single orbit.
- Revisit a trace to gently brighten its endpoint.
- Rapid back-and-forth movement fades nearby strokes.
- Choose **Hear trace** for a three-second composition; audio starts only on request.
- Choose **Clear trace** to erase the artwork and movement history.
- Focus the canvas and use arrow keys to create traces with a keyboard.

At most nine live strokes and two orbits are retained, with gentle aging and fade-out. Typography responds as a single unit. The experience respects reduced-motion preferences.

## Files

- `index.html` — page structure, metadata, and About dialog.
- `style.css` — responsive layout and visual styling.
- `app.js` — Canvas drawing, gesture recognition, and Web Audio synthesis.

The project uses native browser APIs without external dependencies. Movement history stays in memory for the current session; it is not uploaded or saved between visits. The Work link opens https://janice-khang.com/.

## Validation

JavaScript syntax and simulated checks for continuous curves, circle detection, density limits, fading, magnetic movement bounds, and clearing have passed. Real-browser visual and audio QA remains manual.
