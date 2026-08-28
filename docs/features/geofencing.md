# Geofencing

## Description

Triggers a visual alert when a tracked position (see `simulated-position`) enters the boundary of a zone — here, a POI's `Surface`. The SDK has no dedicated geofence/point-in-polygon API; this feature is built entirely from two existing public primitives: `Surface.positions` (a zone's boundary, as WGS84 vertices) and `venue.updateSurface()` (the visual alert), with containment computed in app code.

## SDK usage

Each `Surface` on a POI (`poi.surfaces: Surface[]`) exposes `positions: Position[]`, the WGS84 vertices of that surface's boundary — the same `{ latitude, longitude, altitude? }` shape `view.injectTrackedPosition()` takes, so no coordinate conversion is needed between "zone" and "tracked position":

```js
const zonePoi = venue.pois.find((p) => p.id === zoneId)
const zoneSurfaces = zonePoi.surfaces // Surface[], each with .positions: Position[]
```

On every tracked-position tick (this demo reuses the `simulated-position` interpolation loop, ~150ms), a plain ray-casting test checks whether the current position falls inside any of the zone's surface polygons:

```js
function pointInPolygon(point, positions) {
  let inside = false
  for (let i = 0, j = positions.length - 1; i < positions.length; j = i++) {
    const xi = positions[i].longitude, yi = positions[i].latitude
    const xj = positions[j].longitude, yj = positions[j].latitude
    const intersects =
      (yi > point.latitude) !== (yj > point.latitude) &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}
```

On a state transition (outside → inside or back), the zone surface is recolored with `venue.updateSurface()`, the same call used by `clickable-surface`/`category-highlight`:

```js
venue.updateSurface(surface, { color: isInside ? '#E74C3C' : 'initial' })
```

## Things to know

- The SDK does not fire any event on tracked-position change (no `trackedpositionchanged` in `View.EventType`) — containment has to be re-checked on whatever cadence the app already polls the position at, rather than reacting to a push notification from the SDK.
- `Surface.positions` treats a surface as a flat polygon; the ray-casting test here ignores altitude entirely. That's accurate enough for a single-floor zone but would falsely trigger for a multi-floor building's footprint if the tracked position's floor isn't otherwise constrained.
- Like `clickable-surface`, this only works on a POI that actually has one or more `Surface`s (`poi.surfaces`) — a marker-only POI has no boundary to test against.
- `color: 'initial'` is required to revert a surface to its bundle-defined color; leaving it unset would keep displaying the last alert color even after leaving the zone (same caveat as `clickable-surface`).

## Learn more

- [`simulated-position`](./simulated-position.md) — the tracked-position simulation this feature is built on top of.
- [`clickable-surface`](./clickable-surface.md) — the other feature using `venue.updateSurface()` for a similar color-driven visual state.
