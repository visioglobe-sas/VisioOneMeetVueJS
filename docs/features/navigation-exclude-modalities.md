# Exclude Modalities/Attributes

## Description

Computes a route the same way as [`compute-navigation`](./compute-navigation.md), but passes `NavigationRequest.excludedAttributes` (or `excludedModalities`) to `venue.computeNavigation()` so the routing algorithm ignores any segment carrying one of the given tags — for example, excluding `'lift'` to force a route that avoids elevators.

## SDK usage

```js
function computeItinerary(originPoi, destinationPoi, avoidElevator) {
  const navigation = venue.computeNavigation({
    origin: originPoi,
    destination: destinationPoi,
    excludedAttributes: avoidElevator ? ['lift'] : undefined,
  })
  const trace = venue.createNavigationTrace(navigation)
  view.setCurrentNavigationTrace(trace)
  return trace
}
```

`NavigationRequest` (`Navigation/NavigationRequest.d.ts`) exposes two separate exclusion lists:

- `excludedModalities?: string[]` — the *mode of travel* along a segment (pedestrian, car, bus...), defined in VisioMapEditor.
- `excludedAttributes?: string[]` — a *particularity* of a segment (elevator, stairway, intersection...), also defined in VisioMapEditor.

Both are plain string arrays matched against tags set per-segment when the map was authored; passing an unused string is a silent no-op (it just excludes nothing), not an error.

## Things to know

- **The SDK's own JSDoc for `excludedAttributes` is misleading.** Its doc comment gives `"elevator"` as an example attribute, but the string value actually tagged on a segment's elevator attribute (confirmed by cross-referencing the SDK/MapEditor source and a sibling venue's routing test fixture) is `'lift'`. Pass `excludedAttributes: ['lift']`, not `['elevator']`.
- **`excludedAttributes` and `excludedModalities` are not interchangeable.** An elevator is a segment *attribute* (`'lift'`), not a *modality* — passing `'lift'` inside `excludedModalities` instead of `excludedAttributes` will not exclude it.
- **When the exclusion removes every viable path, `computeNavigation` behaves exactly like an unreachable origin/destination pair** — it throws `RouteNotFoundError`/`SourceOutOfLimitError`/`DestinationOutOfLimitError` (see `Navigation/Errors/` in the typings), the same as `compute-navigation`'s own "no route found" case. There is no separate error type or flag distinguishing "excluded modality made this unreachable" from "these two places were never connected" — from the caller's side, both look identical.
- Both fields are read once per `computeNavigation()` call — toggling them afterward has no effect on an already-computed `Navigation`/`NavigationTrace`; a new call is required to pick up the change.

## Learn more

See [`compute-navigation`](./compute-navigation.md) for the base `Navigation`/`NavigationTrace` computation and display flow that this feature builds on.
