# Compute Navigation

## Description

Computes and displays a route between two places, via three SDK calls used in sequence: `venue.computeNavigation({ origin, destination })` to compute the route, `venue.createNavigationTrace(navigation)` to build a visual representation of it, and `view.setCurrentNavigationTrace(navigationTrace)` to render it as the current trace on the view.

## SDK usage

```js
function computeItinerary(originPoi, destinationPoi) {
  const navigation = venue.computeNavigation({ origin: originPoi, destination: destinationPoi })
  const trace = venue.createNavigationTrace(navigation)
  view.setCurrentNavigationTrace(trace)
  return trace
}

function clearItinerary(trace) {
  view.removeCurrentNavigationTrace()
  venue.removeNavigationTrace(trace)
}
```

`computeNavigation` returns a `Navigation` (the request plus the ordered `NavigationInstruction[]`, in a locale-independent format — see `Navigation.d.ts`/`NavigationInstruction.d.ts`). It isn't visible on the map by itself; it must be turned into a `NavigationTrace` before it can be made current on the view.

`origin`/`destination` accept a `POI`, a raw ID string, or a `Position` (type `POIOrIDOrPosition`, see `NavigationRequest.d.ts`) — passing a `POI` object (resolved beforehand via `venue.pois.find`) lets you distinguish an unknown ID from a genuinely unreachable route, since the SDK itself doesn't otherwise separate the two.

## Things to know

- `computeNavigation` throws when both places exist but no route connects them (disconnected buildings in the routing graph, for example) — `RouteNotFoundError`, `SourceOutOfLimitError`, or `DestinationOutOfLimitError` (see `Navigation/Errors/` in the typings).
- Removing a displayed route takes two calls: `view.removeCurrentNavigationTrace()` clears it from the view/UI, while `venue.removeNavigationTrace(trace)` destroys the `NavigationTrace` object itself on the venue. Skipping the second leaves an orphaned object.
- `NavigationRequest` also accepts `type` (`'fastest'` by default, or `'shortest'`) and `isAccessible` (accessible routing) — see `NavigationRequestType.d.ts`.
- This SDK surface only covers computing and displaying a full route at once. Step-by-step guided navigation (`view.setCurrentNavigationInstruction`, `view.navigateToNextInstruction`/`navigateToPreviousInstruction`) and real position tracking along a route are separate SDK capabilities not exercised here.
