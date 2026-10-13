# Accessible Route

## Description

Computes a route the same way as [`compute-navigation`](./compute-navigation.md), but passes `NavigationRequest.isAccessible: true` to `venue.computeNavigation()` so the routing algorithm only uses the venue's own accessible path — for example rerouting through a lift instead of a stairway or escalator.

## SDK usage

```js
function computeItinerary(originPoi, destinationPoi, accessible) {
  const navigation = venue.computeNavigation({
    origin: originPoi,
    destination: destinationPoi,
    isAccessible: accessible,
  })
  const trace = venue.createNavigationTrace(navigation)
  view.setCurrentNavigationTrace(trace)
  return trace
}
```

`NavigationRequest.isAccessible?: boolean` (`Navigation/NavigationRequest.d.ts`), default `false`:

> If set to true, computed route will only use accessible route.

## Things to know

- **`isAccessible` is sugar over the same exclusion mechanism as [`navigation-exclude-modalities`](./navigation-exclude-modalities.md), pre-filled by the venue itself.** Internally, `isAccessible: true` excludes every segment attribute/modality listed in the venue's own `accessibleRouteAttributes`/`accessibleRouteModalities` — published from VisioMapEditor and read from the venue bundle's `applicationParameters.routingParams` — the same way `excludedAttributes`/`excludedModalities` are excluded manually. There is no public getter for these two lists on `Venue.d.ts`; they are internal to the routing engine, not inspectable through the SDK's public API.
- **The excluded list is venue-defined, not a fixed SDK constant.** Two different venues can (and likely do) publish different `accessibleRouteAttributes`/`accessibleRouteModalities` — the tags that count as "not accessible" are authored per-venue in VisioMapEditor, not hardcoded in the SDK. Don't assume a specific value without checking (or empirically confirming via routing) on the venue you're integrating against.
- **Confirmed live on the shared demo venue:** the default (fastest) route between `B4-UL00-ID0010` and `B4-UL01-ID0014` crosses via a `'stairway'`-tagged segment (`B4-stairs2`); passing `isAccessible: true` for the same pair reroutes the entire path through a `'lift'`-tagged segment (`B4-lift1`) instead — a genuinely different computed route, not just a relabeled one. No `'escalator'`-tagged segment was found anywhere on this particular venue during that exploration, so only `'stairway'` was observed being excluded here — that doesn't mean `'escalator'` isn't also in this venue's `accessibleRouteAttributes`, only that no default route sampled happened to use one.
- **When no accessible route exists, `computeNavigation` fails exactly like an unreachable origin/destination pair** — it throws `RouteNotFoundError`/`SourceOutOfLimitError`/`DestinationOutOfLimitError` (see `Navigation/Errors/` in the typings), same as `navigation-exclude-modalities`'s "exclusion removed every viable path" case. There is no separate error or flag distinguishing "no accessible path exists" from "these two places were never connected at all".
- `isAccessible` is read once per `computeNavigation()` call — toggling it afterward has no effect on an already-computed `Navigation`/`NavigationTrace`; a new call is required to pick up the change.
- `isAccessible: true` and manually passed `excludedAttributes`/`excludedModalities` are additive, not exclusive — both can be combined in the same request; the venue's accessible-route exclusions apply on top of whatever else is explicitly excluded.

## Learn more

See [`compute-navigation`](./compute-navigation.md) for the base `Navigation`/`NavigationTrace` computation and display flow that this feature builds on, and [`navigation-exclude-modalities`](./navigation-exclude-modalities.md) for the lower-level `excludedAttributes`/`excludedModalities` mechanism `isAccessible` builds on internally.
