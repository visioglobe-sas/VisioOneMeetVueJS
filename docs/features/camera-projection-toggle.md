# Camera Projection

## Description

Switches the map between a 3D **perspective** camera and a flat **orthographic** camera. The projection is the `cameraProjection` option of `visioOne.createView()` (`'perspective' | 'orthographic'`, default `'perspective'`); the projection of an existing view can be read back through the read-only `view.cameraProjection` property.

Because the option is only read when the view is created, "switching" means recreating the map: tear down the current view and venue, then load the venue again and create a new view with the other projection.

## SDK usage

Creating a view with a given projection:

```js
import { createVisioOne } from '@visioglobe/visioone'

const visioOne = createVisioOne()
let venue = await visioOne.loadVenue({ vg_maphash: hash }, loaderContainer)
let view = await visioOne.createView(viewContainer, venue, { cameraProjection: 'orthographic' })

console.log(view.cameraProjection) // 'orthographic'
```

Switching to the other projection at runtime (full reload):

```js
async function switchProjection(cameraProjection) {
  view.removeEventListener('poiclick', handlePOIClick)
  await visioOne.destroyView(view)
  await visioOne.unloadVenue(venue)

  venue = await visioOne.loadVenue({ vg_maphash: hash }, loaderContainer)
  view = await visioOne.createView(viewContainer, venue, { cameraProjection })

  // Everything attached to the previous view/venue is gone: re-register it.
  view.addEventListener('poiclick', handlePOIClick)
  return view.cameraProjection // what the SDK actually created
}
```

In this repo, `src/components/VisioOneMap.vue` already runs exactly this lifecycle on mount/unmount, so the feature screen passes `{ cameraProjection }` through its `viewOptions` prop and changes the component's `key` to force Vue to unmount it (`destroyView` + `unloadVenue`) and mount a fresh one (`loadVenue` + `createView`).

## Things to know

- **Creation-time only.** `cameraProjection` is a `ViewCreateOptions` field. `view.cameraProjection` is read-only and only reports the projection the view was created with; there is no setter and no runtime switch method.
- **URL parameter precedence.** If the page URL contains `?orthographic` (its presence alone is enough), the SDK creates an orthographic view regardless of the `cameraProjection` option: options are merged as URL parameters > options given to `createView()` > defaults. Handy to force the flat view without touching code, but it overrides your option, so don't combine it with an in-app toggle.
- **Don't recreate a view on the same venue.** In SDK 1.1.0, `await visioOne.destroyView(view)` followed by `visioOne.createView(container, sameVenue, { cameraProjection })` fails: an unhandled `Error: Cannot fetch model` is thrown and the returned promise never resolves, leaving a black map. Also unload the venue and load it again (`destroyView` → `unloadVenue` → `loadVenue` → `createView`), as in the snippet above.
- **A switch is a full map reload.** On the demo map the reload took about 1.5 s. Everything attached to the old view/venue is lost: event listeners (`poiclick`, tracking events...), runtime POIs/markers/labels/images, surface color changes, the current camera position, the selected floor, the theme and accent colors. Save what you need before the switch and re-apply it once the new view resolves. Disable your switch control in the meantime, so a second switch can't start during the reload.
- **No sky in orthographic: the canvas is transparent.** In SDK 1.1.0 the perspective view draws a light sky behind the venue, but the orthographic view draws none and leaves the WebGL canvas transparent, so your page/container background shows through around the map (verified by giving the page a red background: the area around the map turned red in orthographic only). Give the map container the background color you want. The orthographic view also opens much more zoomed out, with the whole venue in frame.
- Read `view.cameraProjection` once `createView()` resolves to confirm what was actually created (e.g. when `?orthographic` is in the URL, it reports `'orthographic'` even if you asked for `'perspective'`).

## Learn more

- `ViewCreateOptions` and `cameraProjection` typings: `node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/ViewCreateOptions.d.ts`, `.../View/CameraProjection.d.ts`.
- URL parameters understood by the SDK: `.../Venue/URLParameters.d.ts`.
- [Configurable Map Server](custom-base-url.md) uses the same unmount/remount pattern to change a load-time option.
