# Custom Text Label

## Description

Places your own free text on the map (opening hours, a price, a zone name...) with `venue.createLabel()`, restyles it live (color, size, text) with `venue.updateLabel()`, and removes it with `venue.removeLabel()`. The label is owned by an existing POI (the "anchor"), so no `createPOI` is needed, and it is independent of the map's own labels: the anchor's published label stays untouched.

## SDK usage

```js
// Same POI lookup idiom as goto-poi / 3d-icon-marker.
const anchor = venue.pois.find((p) => p.id === 'B4-UL00-ID0009')

// A POI has no direct lat/lng field: copy the Position of its first label or
// marker, then nudge it (~4 m) so the new text doesn't overlap the map's own label.
const anchorPosition = anchor.labels[0]?.position ?? anchor.markers[0]?.position
const position = {
  ...anchorPosition,
  latitude: anchorPosition.latitude + 0.00004,
  longitude: anchorPosition.longitude + 0.00004,
}

// Create: width/height in meters, rotation in degrees (relative to the map's orientation).
const label = venue.createLabel({
  poi: anchor,
  position,
  width: 16,
  height: 3, // always pass it, see "Things to know"
  text: 'Lunch 12:00–14:00',
  color: '#E53935',
  rotation: 0,
})

// Restyle live.
venue.updateLabel(label, { color: '#43A047' })
venue.updateLabel(label, { width: 22, height: 4 }) // always width AND height together
venue.updateLabel(label, { text: 'Closed today' })

// Change rotation: not updatable, so remove and recreate with the same values.
const { poi, position: current, width, height, text, color } = label
venue.removeLabel(label)
const rotated = venue.createLabel({ poi, position: current, width, height, text, color, rotation: 45 })

// Remove.
venue.removeLabel(rotated)
```

Signatures, from `node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/`:

- `createLabel(options: LabelCreateOptions): Label`, where `LabelCreateOptions` is `{ poi: POI; position: Position; width: number; height?: number; text: string; color?: Color; rotation?: number }`.
- `updateLabel(label: Label, options: LabelUpdateOptions): void`, where `LabelUpdateOptions` is `{ position?; width?; height?; text?; isVisible?; color? }`. It has no `rotation`.
- `removeLabel(label: Label): void`.

The returned `Label` exposes the current `poi`, `position`, `width`, `height`, `text`, `color`, `rotation` and `isVisible` as read-only fields.

## Things to know

- **Always pass `height`.** It is optional on `createLabel` but **defaults to `width`**, which gives a square box: the text wraps and gets huge.
- **Always update `width` and `height` together.** `updateLabel(label, { width })` alone also sets `height = width` (documented in `LabelUpdateOptions`), which garbles the text. `height` alone has no effect.
- **`rotation` can only be set at creation.** It is part of `LabelCreateOptions` but not `LabelUpdateOptions`. To change it, `removeLabel` and `createLabel` again with the same values. Passing `rotation` to `updateLabel` anyway happens to rotate the rendering, but `label.rotation` keeps reporting the old value. This is undocumented, so don't rely on it.
- **`text` is required.** An empty string throws `Cannot create Label, text is required`. Validate (and trim) user input before calling.
- **Color formats.** `color` must be hex, `rgb()` or `hsl()` (any alpha is ignored). Anything else throws `Invalid color format provided…`.
- **Text fitting.** The text is scaled to fit inside the `width` × `height` box (meters, so it gets bigger or smaller on screen with zoom). Text that is long relative to the box wraps onto two lines.
- **The label belongs to its anchor POI.** It appears in `anchor.labels` next to the map's own label, which it does not alter. Calling `removePOI` on the anchor would remove every visual attached to it, the map's own label included.
- **One `Label` per `createLabel` call.** Calling `createLabel` again adds a second label, it does not replace the first. Keep the returned reference and `removeLabel` it first if you only want one.
- **Don't reuse a removed label.** `removeLabel` or `updateLabel` on a label that was already removed throws `Provided label is not registered`. Drop your reference after removing it.
- **The anchor's floor must be visible.** A label on an indoor POI only renders while that POI's floor is displayed, not in the default global view of a multi-building venue. This demo moves the camera to the anchor with `view.goToPOI(anchor)` right after creating the label.
- A POI with no `labels[0]` and no `markers[0]` has no position to copy. Handle that as an explicit "no position" state rather than passing `undefined` into `createLabel`.

## Learn more

- `docs/features/dynamic-poi-crud.md`: attaching a `Label` to a POI created at runtime with `venue.createPOI()`.
- `docs/features/3d-icon-marker.md`: the same anchor-POI approach for an image (`venue.createImage()`).
- `docs/features/goto-poi.md`: `view.goToPOI()`, used here to bring the anchor's floor into view.
