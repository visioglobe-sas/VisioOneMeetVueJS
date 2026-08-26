# Dynamic POI CRUD

## Description

Creates, updates and removes a POI (Point Of Interest) at runtime — without republishing the map in VisioMapEditor — via `venue.createPOI()` and `venue.removePOI()`. Because a freshly created POI has no visual footprint by itself, this demo also attaches a `Label` to it with `venue.createLabel()`, at a position copied from an existing POI (the "anchor"), and demonstrates "editing" its visible content via `venue.updateLabel()` — `venue.updatePOI()` itself can only ever change a POI's categories, never anything visual, so it isn't the update path this demo uses (see "Things to know").

## SDK usage

```js
// venue.pois.find(...) — same lookup idiom as goto-poi/custom-data. No
// venue.getPOIById in the SDK typings.
const anchor = venue.pois.find((p) => p.id === anchorId)

// Whichever visual element exists first on the anchor carries a Position in
// the WGS84 shape createLabel expects ({ latitude, longitude, altitude? }).
const position = anchor.labels[0]?.position ?? anchor.markers[0]?.position

// Create: a bare POI is purely a logical id/floor/categories container.
const poi = venue.createPOI({ id: newId }) // throws POIAlreadyExistsError on a duplicate id

// Give it a visual representation: attach a Label at the copied position.
const label = venue.createLabel({ poi, position, width: 2, text: labelText })

// Update: updatePOI can only ever touch categories — never anything visual —
// so "editing" the POI's visible content means updating its Label instead.
venue.updateLabel(label, { text: newLabelText })

// Remove: cascades — removePOI also removes the attached Label from the view.
venue.removePOI(poi)
```

`POICreateOptions` (`node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/POICreateOptions.d.ts`) is `{ id: string; floor?: Floor; categories?: Category[] }`. `venue.createPOI(options): POI` throws `POIAlreadyExistsError` (`Venue/Errors/POIAlreadyExistsError.d.ts`) when `id` is already used in the venue. `venue.removePOI(poi): void` removes the POI and, per its own doc comment, "if the POI to remove has a visual representation, it will be removed from the view too" — no separate `removeLabel` call is needed. `venue.updatePOI(poi, options): void` takes a `POIUpdateOptions` of exactly `{ categories: Category[] }` — the only thing it can change; passing `[]` clears every category.

`venue.createLabel(options: LabelCreateOptions): Label` (`Venue/LabelCreateOptions.d.ts`) takes `{ poi, position, width: number, height?: number, text: string, color?: Color, rotation?: number }`, `position` being a `Position` in WGS84 (`{ latitude, longitude, altitude? }`). `venue.updateLabel(label, options: LabelUpdateOptions): void` (`Venue/LabelUpdateOptions.d.ts`) can change `position`, `width`, `height`, `text`, `isVisible`, and `color` — this demo only ever touches `text`.

## Things to know

- **A bare POI has no visual representation by itself.** `POI` (`Venue/POI.d.ts`) is an aggregator whose `images`/`labels`/`lines`/`surfaces`/`markers` are all `readonly [...]` arrays that start empty — `venue.createPOI()` alone produces an id/floor/categories container invisible on the map. At least one visual element (Image/Label/Line/Marker/Surface) must be created and attached (`poi` field in its `*CreateOptions`) to see anything.
- **`updatePOI` only ever changes categories.** `POIUpdateOptions` has exactly one field, `categories: Category[]` — there is no way to move a POI, change its floor, or touch any visual content through `updatePOI`. Any "edit" story for a POI's visible content has to go through the update method of whichever visual element is attached (`updateLabel`, `updateMarker`, `updateImage`, `updateLine`, `updateSurface`), not `updatePOI`.
- **`removePOI` cascades.** Removing a POI also removes any visual element attached to it from the view — a separately-called `removeLabel`/`removeMarker`/etc. is redundant (and would throw a `*NotFoundError` if attempted afterward, since the element is already gone).
- **`POIAlreadyExistsError` on a duplicate id is a normal outcome, not a crash.** `createPOI` throws synchronously when `id` collides with any POI already in the venue (including ones baked into the published map bundle, not just other dynamically-created ones) — wrap the call in a `try`/`catch` and treat it as an expected "pick another id" state.
- **No coordinate-picking UI here.** This demo sources a WGS84 position by copying an existing POI's own `label`/`marker` position rather than resolving a map-tap into world coordinates — a real "place a pin where the user taps" flow needs the view's own screen-to-world projection, out of scope for this feature.
- A POI resolved with no `labels[0]` and no `markers[0]` (point/marker-only POIs, or an image/line/surface-only POI) has no position this demo can copy — shown as an explicit "no position to copy" state rather than passing `undefined` into `createLabel`.

## Learn more

- `docs/features/goto-poi.md` and `docs/features/custom-data.md` — the same `venue.pois.find(p => p.id === id)` POI-lookup idiom used here for both the new POI's id check and the anchor lookup.
- `docs/features/poi-click.md` — reads `poi.categories`/`poi.labels` for display; this feature creates and mutates those same POI/Label shapes instead of just reading them.
