# Real-Time Occupancy (Simulated Data)

## Description

Dynamically colors a POI's surface to reflect an occupancy status (free / soon occupied / occupied), by calling `venue.updateSurface(surface, { color })` directly on the `venue` instance. There is no real sensor behind this demo — a `setInterval` cycles through colors every 2.5 seconds in place of a real IoT feed — but it shows exactly the SDK calls you'd wire to a real data source (websocket, API polling) without changing anything else.

## SDK usage

```js
function updateOccupancy(targetPlaceId, color) {
  const venue = venueRef.value
  if (!venue) return
  const poi = venue.pois.find((p) => p.id === targetPlaceId)
  if (!poi) return
  poi.surfaces.forEach((surface) => venue.updateSurface(surface, { color }))
}
```

A POI's surfaces are colored individually via `venue.updateSurface`; there is no single "set POI color" call.

## Things to know

- There's no `venue.getPOIById` — looking up a POI is always `venue.pois.find(p => p.id === id)`. It resolves to `undefined` with no error if the ID doesn't match anything on the loaded venue, so check before using the result.
- `color: undefined` resets a surface to its normal appearance — it isn't a default color you need to hardcode.
- `venue` is only populated after the `ready` event; calling `updateOccupancy` before that is a no-op as long as the caller guards on `venueRef.value` being set.
