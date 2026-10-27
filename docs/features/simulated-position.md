# Simulated Position

## Description

Animates a tracked position (dot + accuracy circle) between two POIs, via `view.injectTrackedPosition({ position, precisionCircleRadius }, animationOptions?)`. There's no real indoor-positioning source behind this demo (no BLE/Wi-Fi/UWB) — a `setInterval` advances a linearly interpolated position back and forth between the two POIs in place of a real positioning feed. It demonstrates the **display mechanics** of a tracked position, not an indoor-positioning integration.

## SDK usage

```js
if (!view.allowTracking) view.allowTracking = true // required before the first injectTrackedPosition call; set it once

function injectPositionTick(position, precisionCircleRadius) {
  view.injectTrackedPosition({ position, precisionCircleRadius })
}

function stopTracking() {
  view.allowTracking = false // removes the dot and accuracy circle from the map
}
```

A POI has no direct `latitude`/`longitude` field. Read its position off the objects it owns, all of which carry a `Position` of the shape `injectTrackedPosition` expects (`{ latitude, longitude, altitude? }`), in this order: its first label, its first image, its first marker, else the centroid of its first surface's vertices:

```js
function poiPosition(poi) {
  const owned = poi.labels[0] ?? poi.images[0] ?? poi.markers[0]
  if (owned) return owned.position
  const vertices = poi.surfaces[0]?.positions
  if (!vertices?.length) return null
  const mean = (key) => vertices.reduce((sum, v) => sum + (v[key] ?? 0), 0) / vertices.length
  return { latitude: mean('latitude'), longitude: mean('longitude'), altitude: mean('altitude') }
}
```

## Things to know

- `injectTrackedPosition` throws if called while `view.allowTracking` is still `false` — always set `allowTracking = true` before the first call.
- Set `allowTracking = true` once, not on every position update: each assignment also forces `lockCameraPositionOnTracking` (and `lockCameraOrientationOnTracking`) back to `true`, re-locking the camera on the tracked position and undoing any user pan or lock toggle. Guard it with `if (!view.allowTracking)` — see `docs/features/camera-lock-on-position.md`.
- There's no dedicated "stop tracking" method. Setting `allowTracking = false` back is the only documented way to remove the dot and accuracy circle from the map (`View.d.ts`).
- `precisionCircleRadius` is read fresh on every call — updating it takes effect on the next `injectTrackedPosition` call, not retroactively on the position already displayed.
