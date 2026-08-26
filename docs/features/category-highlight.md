# Category Highlight

## Description

Highlights every POI belonging to a chosen category (e.g. all restaurants, all shops) in one action. There is no dedicated "highlight by category" method in the SDK — it's built from three primitives that already exist elsewhere in this app: `venue.categories` to list the venue's categories, a plain array filter on `poi.categories` to resolve which POIs belong to a category, and `venue.updateSurface(surface, { color })` (as in `occupancy-simulated`/`clickable-surface`) applied to each matching POI's surfaces.

## SDK usage

```js
// venue.categories: Category[], Category = { readonly id: string }. id is a
// raw internal identifier, not a display name — resolve the human-readable
// name via venue.translator.translateCategory().
const categories = venue.categories.map((category) => ({
  id: category.id,
  label: venue.translator.translateCategory(category, venue.currentLocale).name || category.id,
}))

function poisInCategory(categoryId) {
  return venue.pois.filter((poi) => (poi.categories ?? []).some((category) => category.id === categoryId))
}

function highlightCategory(categoryId) {
  const pois = poisInCategory(categoryId)
  pois.forEach((poi) =>
    poi.surfaces.forEach((surface) => venue.updateSurface(surface, { color: '#FF6B00' })),
  )
  return pois // keep the list around so it can be reverted later
}

function clearHighlight(pois) {
  pois.forEach((poi) =>
    poi.surfaces.forEach((surface) => venue.updateSurface(surface, { color: 'initial' })),
  )
}
```

`Category` (`node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/Category.d.ts`) is just `{ readonly id: string }` — a raw internal identifier (a numeric string on the shared demo map, e.g. `"1"`.."`11`"`), not a display name. `venue.categories` is the venue's full list; `poi.categories` is the (possibly multi-valued) subset attached to a given POI. The human-readable name comes from `venue.translator.translateCategory(category, venue.currentLocale).name` — see "Things to know".

## Things to know

- **Not every POI has surfaces.** `poi.surfaces` is an empty array for point/marker-only POIs (e.g. a POI represented only by a pin/label with no floor polygon). Filtering by category still includes those POIs, but the `forEach` over `poi.surfaces` is simply a no-op for them — they don't visually highlight via `updateSurface`. That's expected, not a bug; a full "highlight this category" UX for marker-only POIs would need a different visual (e.g. a custom marker icon), which `updateSurface` cannot provide.
- **Use `color: 'initial'` to revert, not `color: undefined`.** Per `SurfaceUpdateOptions`'s own doc comment (`node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/SurfaceUpdateOptions.d.ts`), `'initial'` is the sentinel that restores a surface to its map-bundle-defined color. Omitting the key or passing `undefined` is not documented to do the same thing — it means "leave this field unspecified" for that particular `updateSurface` call, which is a different contract. (This repo's own `occupancy-simulated` feature currently resets via `color: undefined` — kept as-is there, but not a pattern to copy; new code should use `'initial'`.)
- **A POI can belong to several categories.** `poi.categories` is an array, so `.some(...)` (not `.find`/equality on a single field) is the correct membership test — a POI tagged both "Food and Beverage" and "Wellness and Recreation" (a café inside a spa, say) shows up under either.
- **Only one category highlighted at a time in this demo.** This is an app-level UX choice, not an SDK constraint — the SDK happily lets any number of surfaces carry a custom color simultaneously. Selecting a new category here first reverts the previously-highlighted POIs' surfaces to `'initial'` before applying the new color, so switching categories doesn't leave stale colors behind. Nothing stops a real integration from highlighting several categories concurrently with different colors, as long as each set of POIs/surfaces is tracked separately for its own revert.
- No dedicated venue/map is needed for this feature — any map with categories authored in VisioMapEditor works; the code reads `venue.categories` generically and never hardcodes a category name.
- **`category.id` is never a display name, confirmed live.** It's tempting to assume a well-authored map's `id` already reads as human-readable, but that's not how the SDK resolves it — `id` is a raw internal identifier (numeric on the shared demo map) regardless of authoring quality. Always resolve the display label via `venue.translator.translateCategory(category, venue.currentLocale).name`, the same idiom used for building/floor labels elsewhere in this repo; `id` remains what filtering/highlighting must use.

## Learn more

- `docs/features/occupancy-simulated.md` and `docs/features/clickable-surface.md` — the other features in this repo built on the same `venue.updateSurface(surface, { color })` call.
- `docs/features/poi-click.md` — reads a single POI's `poi.categories` for display; this feature goes the other direction, from category to POIs.
