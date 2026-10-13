# 3D Icon Marker

## Description

Places a custom picture (here a small PNG embedded as a data URL) at a spot on the 3D map with `venue.createImage()`, changes how it behaves relative to the camera live with `venue.updateImage()`, and removes it with `venue.removeImage()`. The image is owned by an existing POI (the "anchor") and placed at that POI's own position, so no `createPOI` is needed.

## SDK usage

```js
// Same POI lookup idiom as goto-poi / dynamic-poi-crud.
const anchor = venue.pois.find((p) => p.id === anchorId)

// A POI has no direct lat/lng field: copy the Position of its first label or
// marker (WGS84 { latitude, longitude, altitude? }).
const position = anchor.labels[0]?.position ?? anchor.markers[0]?.position

// Create: width/height are in meters, url can be a web URL, a path relative
// to the venue's baseURL, or a data URL.
const image = venue.createImage({
  poi: anchor,
  position,
  width: 6,
  height: 6,
  url: 'data:image/png;base64,...',
  orientationType: 'facing', // 'fixed' | 'flat' | 'facing'
})

// Update any subset of { position, width, height, rotation, url, orientationType, isVisible }.
venue.updateImage(image, { orientationType: 'fixed' })

// Remove.
venue.removeImage(image)
```

`ImageCreateOptions` (`node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/ImageCreateOptions.d.ts`) is `{ poi: POI; position: Position; width: number; height?: number; rotation?: number; url: string; orientationType?: OrientationType }`. `OrientationType` (`Venue/OrientationType.d.ts`) is:

- `'fixed'` — flat on the ground, with a fixed heading (`rotation`, in degrees relative to the map's orientation, only applies in this mode);
- `'flat'` — flat on the ground, turning to face the camera;
- `'facing'` — documented as "always camera facing".

`venue.updateImage(image, options: ImageUpdateOptions): void` and `venue.removeImage(image): void` take the `Image` instance returned by `createImage`.

## Things to know

- **The owner POI keeps its own images.** `createImage` appends to the owner POI's `images` array: a POI that already shows an icon from the published map (e.g. a restaurant pictogram) ends up with two images. Removing yours with `removeImage` leaves the map's own icon untouched. Calling `removePOI` on the owner, on the other hand, would remove every visual element attached to it, yours included.
- **One `Image` per `createImage` call.** Calling `createImage` again does not replace the previous image, it adds another one. Keep a reference to the returned `Image` and `removeImage` it first if you only want one at a time.
- **Data URLs work.** A base64 PNG data URL renders without any extra configuration or network request.
- **Altitude matters.** The position copied from a label sits at the label's own altitude (0.5 m above the floor on the demo map), at the same height as the label text. In practice an image created there can z-fight with the label or the floor (visible stripes), especially in `'flat'` and `'facing'` modes; in our tests `'fixed'` drew cleanly on top. Raising `position.altitude` (e.g. via `updateImage(image, { position: { ...position, altitude: 4 } })`) avoids it.
- **`'facing'` vs the map's own icons.** On the demo map with `@visioglobe/visioone` 1.0.x, an image created with `'facing'` was rendered lying on the ground, looking the same as `'flat'`, not as an upright billboard like the pictograms that ship with the published map. Test the orientation modes against your own map and camera angles before relying on one.
- **Indoor floors must be visible.** An image anchored to an indoor POI is only visible when that POI's floor is displayed (e.g. after `view.goToPOI(anchor)` or selecting the floor), not in the default global view of a multi-building venue.
- **Sizes are in meters.** `width`/`height` are world sizes, so the icon gets bigger or smaller on screen as the camera zooms. Passing only `width` to `updateImage` updates both width and height; passing only `height` has no effect.
- A POI with no `labels[0]` and no `markers[0]` has no position to copy. Handle it as an explicit "no position" state rather than passing `undefined` into `createImage`.

## Learn more

- `docs/features/dynamic-poi-crud.md`: the same "copy an anchor POI's position" approach, used there to attach a `Label` to a freshly created POI.
- `docs/features/goto-poi.md`: `view.goToPOI()`, to bring the anchor's floor into view.
