# Camera Lock on Position

## Description

Locks the camera's focus onto the currently tracked position, via `view.lockCameraPositionOnTracking` — a plain boolean property on `View` — similar to a "recenter on me" mode in a GPS app. It only has a visible effect while a tracked position is actively being fed to the view (see `docs/features/simulated-position.md` for `injectTrackedPosition`/`allowTracking`).

## SDK usage

```js
view.lockCameraPositionOnTracking = true // or false to release the lock
```

## Things to know

- This is a no-op, not an exception, when `view.allowTracking` is `false`. The SDK's own doc comment (`View.d.ts`) states: *"This won't have any effect if flag 'allowTracking' isn't set to true."* — unlike `injectTrackedPosition`, which throws in that case.
- It's a fire-and-forget setter — no event or callback confirms the camera actually recentered; the only feedback is visual, on the next position update.
- A sibling property, `lockCameraOrientationOnTracking`, locks the camera's orientation to the device's orientation sensor instead of (or alongside) the position lock.
- The SDK does not reset `lockCameraPositionOnTracking` automatically when `allowTracking` goes back to `false` — if your app toggles tracking on and off, reset this property explicitly too, or a stale lock can silently carry over into the next tracking session.
