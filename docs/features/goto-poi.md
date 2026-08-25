# Go To POI

## Description

Centers and zooms the camera on a POI given its ID, via `view.goToPOI(poi, animationOptions)`. The POI is first looked up with `venue.pois.find(p => p.id === targetId)` (there's no dedicated `venue.getPOIById` in the SDK typings — see `node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/Venue.d.ts`), and its surfaces are optionally highlighted via `venue.updateSurface(surface, { selectionColor: '#057DBC' })` so the targeted POI is visually obvious in addition to the camera move.

## SDK usage

```js
function goToPoi(targetId) {
  const venue = venueRef.value
  const view = viewRef.value
  if (!venue || !view) return

  const poi = venue.pois.find((p) => p.id === targetId)
  if (!poi) return // not found

  poi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: '#057DBC' }))
  view.goToPOI(poi, {
    orientation: { pitch: 20 },
    padding: { top: 100, bottom: 100, left: 100, right: 100 },
  })
}

function clearHighlight(poi) {
  poi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: undefined }))
}
```

`goToPOI` takes the same `AnimationOptions` as the SDK's other camera methods (`goToFloor`, `goToBuilding`, `goToGlobal`) — `orientation.pitch` and `padding` are optional, used here only to keep the camera slightly tilted and the POI away from the screen edges.

## Things to know

- There's no `venue.getPOIById`; `venue.pois.find(...)` resolves to `undefined` (no exception) when the ID doesn't match anything on the loaded venue.
- `goToPOI` requires the full `POI` object, not just its ID — resolve it via `venue.pois.find` first.
- The surface highlight (`selectionColor`) is entirely optional — `view.goToPOI` works fine on its own. `selectionColor: undefined` resets a surface to normal, the same pattern used for `color` in the occupancy feature.
