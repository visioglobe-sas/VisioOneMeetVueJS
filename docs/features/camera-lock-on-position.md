# Camera Lock on Position

## Description

Locks the camera's focus onto the currently tracked position, via `view.lockCameraPositionOnTracking` — a boolean property on `View` — similar to a "recenter on me" mode in a GPS app. It only has a visible effect while a tracked position is actively being fed to the view (see `docs/features/simulated-position.md` for `injectTrackedPosition`/`allowTracking`).

The SDK owns this state and changes it on its own, so a UI control for it should mirror the SDK value (via the `trackingon` / `trackingoff` / `trackingchanged` view events) rather than keep an independent app-side copy.

## SDK usage

```js
// Toggle the lock (true to follow the tracked position, false to release it)
view.lockCameraPositionOnTracking = !view.lockCameraPositionOnTracking

// Keep a UI control in sync with the SDK — subscribe once, when the view is created.
// The events carry no value: read the property inside the handler.
function syncCameraLock() {
  lockToggle.checked = view.lockCameraPositionOnTracking
}
for (const type of ['trackingon', 'trackingoff', 'trackingchanged']) {
  view.addEventListener(type, syncCameraLock)
}
```

## Things to know

- **`view.allowTracking = true` turns the lock on by itself.** Setting it forces both `lockCameraPositionOnTracking` and `lockCameraOrientationOnTracking` to `true` and fires `trackingon`. So right after tracking starts, the camera already follows the position — a UI toggle that starts at "off" is out of sync.
- **`view.allowTracking = false` turns the lock off by itself** (both locks back to `false`) and fires `trackingoff`. No manual reset is needed when tracking stops.
- **A user pan/drag on the map releases the lock.** While tracking, manipulating the camera sets `lockCameraPositionOnTracking` back to `false` and fires `trackingchanged` — listen to it or your UI will still show "locked".
- **Don't re-set `allowTracking = true` on every position update.** Because of the first point, each assignment re-locks the camera: turning the lock off, or panning the map, would be undone on the next `injectTrackedPosition` tick. Set it once, only when it's still `false` (`if (!view.allowTracking) view.allowTracking = true`).
- Setting `lockCameraPositionOnTracking` while `view.allowTracking` is `false` is a no-op, not an exception (`View.d.ts`: *"This won't have any effect if flag 'allowTracking' isn't set to true."*) — unlike `injectTrackedPosition`, which throws in that case. Setting it to its current value is a no-op too (no event fired).
- A sibling property, `lockCameraOrientationOnTracking`, locks the camera's orientation to the device's orientation sensor; it is also driven by `allowTracking` and reported through `trackingchanged`.

## Learn more

- `docs/features/simulated-position.md` — feeding the tracked position with `injectTrackedPosition`.
- `node_modules/@visioglobe/visioone/dist/src/VisioOne/View/EventType.d.ts` — `trackingon`, `trackingoff`, `trackingchanged`.
