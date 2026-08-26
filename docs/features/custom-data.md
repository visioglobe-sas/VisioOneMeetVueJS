# Custom Data

## Description

Reads free-form business key/value data attached to a POI in VisioMapEditor (e.g. price, opening hours, product reference) via `venue.getPOICustomData(poi)`, after loading the venue's `CustomData` from the server with `venue.refreshCustomData()`.

## SDK usage

```js
async function loadCustomData(targetId) {
  const venue = venueRef.value
  if (!venue) return

  // Not called automatically on venue load — the cache starts empty ({})
  // until this resolves at least once. It also rejects, rather than
  // resolving, when the venue has no CustomData published yet — see
  // "Things to know" below.
  try {
    await venue.refreshCustomData()
  } catch {
    // No CustomData published for this venue yet — not a real failure.
  }

  const poi = venue.pois.find((p) => p.id === targetId)
  if (!poi) return // not found

  // Synchronous, always returns {} (never null/undefined).
  const customData = venue.getPOICustomData(poi)
  const entries = Object.entries(customData)
}
```

`refreshCustomData(): Promise<void>` reloads all `CustomData` published for the venue from the server. `getPOICustomData(poi: POI): CustomData` is synchronous and reads from that cache — it does not itself trigger a network call. `CustomData` (`node_modules/@visioglobe/visioone/dist/src/VisioOne/Content/CustomData.d.ts`) is simply `{ readonly [key: string]: string }`: a flat, arbitrary set of string keys/values defined by the map editor while authoring the POI, with no fixed schema.

## Things to know

- **Refresh before read.** `venue.refreshCustomData()` is never called automatically when a venue loads. Until it has been awaited at least once, `getPOICustomData` reads from an empty cache and returns `{}` for every POI, even ones that do have published CustomData. Call it once (or whenever you need fresher data — it re-fetches every time) before relying on lookups.
- **`refreshCustomData()` rejects, not resolves, when nothing is published.** If the venue has no `CustomData` published at all (a 404 fetching its `customData.json`), the promise rejects instead of resolving to an empty cache — confirmed live against the shared demo map. That's a normal "nothing to load yet" outcome, not a real error, so it should be caught and ignored: `getPOICustomData` still safely returns `{}` afterward regardless.
- **Always `{}`, never `null`/`undefined`.** `getPOICustomData` returns an empty object both when the POI has no CustomData at all and when the cache hasn't been refreshed yet — there's no way to tell those two cases apart from the return value alone. `Object.keys(customData).length === 0` is a safe, always-defined emptiness check; no null guard is needed.
- The POI itself is resolved the same way as in `goto-poi`/`occupancy-simulated`: `venue.pois.find(p => p.id === id)`, which is `undefined` (no exception) when the ID doesn't match anything on the loaded venue — a distinct, prior condition from "POI found but no CustomData".
- `refreshCustomData()` fetches CustomData for the whole venue in one call, not per-POI — cheap to call once and reuse for multiple `getPOICustomData` lookups afterward.
