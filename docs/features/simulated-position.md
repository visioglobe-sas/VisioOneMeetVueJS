# Simulated Position

## Description

Animates a tracked position (dot + accuracy circle) between two POIs, via `view.injectTrackedPosition({ position, precisionCircleRadius }, animationOptions?)`. There's no real indoor-positioning source behind this demo (no BLE/Wi-Fi/UWB) — a `setInterval` advances a linearly interpolated position back and forth between the two POIs in place of a real positioning feed. It demonstrates the **display mechanics** of a tracked position, not an indoor-positioning integration.

## SDK usage

```js
view.allowTracking = true // required before the first injectTrackedPosition call

function injectPositionTick(position, precisionCircleRadius) {
  view.injectTrackedPosition({ position, precisionCircleRadius })
}

function stopTracking() {
  view.allowTracking = false // removes the dot and accuracy circle from the map
}
```

A POI has no direct `latitude`/`longitude` field — resolve a position from the first sub-object that carries one:

```js
function resolvePoiPosition(poi) {
  return poi.markers?.[0]?.position ?? poi.labels?.[0]?.position ?? poi.images?.[0]?.position ?? null
}
```

All three (`markers`, `labels`, `images`) carry a `Position` of the same shape (`{ latitude, longitude, altitude? }`) expected by `injectTrackedPosition`, so no conversion is needed once one is found.

## Things to know

- `injectTrackedPosition` throws if called while `view.allowTracking` is still `false` — always set `allowTracking = true` before the first call.
- There's no dedicated "stop tracking" method. Setting `allowTracking = false` back is the only documented way to remove the dot and accuracy circle from the map (`View.d.ts`).
- `precisionCircleRadius` is read fresh on every call — updating it takes effect on the next `injectTrackedPosition` call, not retroactively on the position already displayed.
