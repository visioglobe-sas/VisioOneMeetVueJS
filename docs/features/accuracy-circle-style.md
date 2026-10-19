# Accuracy Circle Style

## Description

Recolors the precision (accuracy) circle around the tracked position live, via `view.updatePositionTrackerGraphicOptions({ color, opacity })`. The circle's size is a separate setting: `precisionCircleRadius`, passed on each `view.injectTrackedPosition(...)` call. Builds on the tracked-position simulation described in `docs/features/simulated-position.md`.

## SDK usage

Style the marker (any time, tracking or not):

```js
view.updatePositionTrackerGraphicOptions({
  color: '#e53935', // hex, rgba() or hsl() — precision circle only (not the center arrow)
  opacity: 0.6,     // precision circle only
})
```

Start tracking, re-apply the style, then feed positions with the circle radius in meters:

```js
view.allowTracking = true
view.updatePositionTrackerGraphicOptions({ color, opacity }) // re-apply after every (re)start
view.injectTrackedPosition({
  position: { latitude, longitude, altitude },
  precisionCircleRadius: 6, // meters; omitted or 0 -> no circle drawn
})
```

Both options are optional: pass only `color` or only `opacity` to change just one of them.

## Things to know

- **Only the precision circle is recolored, not the arrow in its center.** In SDK 1.1.0, `color`/`opacity` feed only the circle drawn with `precisionCircleRadius`; the tracked-position arrow at its center is a separate image that always keeps its default look. With no (or a `0`) radius there is nothing visible to recolor, despite the SDK typings describing the options as applying to "the dot and its precision circle".
- **Stored, not drawn.** `updatePositionTrackerGraphicOptions` only stores the options; they are rendered on the **next** `injectTrackedPosition` call. With a regular position feed (this demo injects every ~150 ms) the change looks instant; with a slow feed it shows up on the next fix. Calling it while tracking is off is fine — the options are used once positions start flowing.
- **Reset on stop.** Setting `view.allowTracking = false` resets color and opacity to the SDK defaults (`#0094f0`, `0.3`). If your app stops and restarts tracking, call `updatePositionTrackerGraphicOptions` again after `allowTracking = true`, before (or with) the first inject — otherwise the circle silently reverts to the default blue.
- **No getter.** The SDK exposes no way to read the current graphic options back; keep the selected color/opacity in your own app state.
- **Radius is not a graphic option.** The circle size is `precisionCircleRadius` on each `injectTrackedPosition` call (in meters), not part of `updatePositionTrackerGraphicOptions`.
- **Validation throws.** An invalid `color` throws (the SDK accepts hex, `rgba()` or `hsl()` strings). A non-number `opacity` throws `"Blue dot's opacity must be a number."`. Note that the opacity check is a falsy test, so `0` skips validation entirely — prefer a small positive minimum (e.g. `0.1`) over `0`.

## Learn more

- `docs/features/simulated-position.md` — `allowTracking` and `injectTrackedPosition`.
- `PositionTrackerGraphicOptions` and `PositionTrackerOptions` in the SDK typings (`dist/src/VisioOne/View/`).
