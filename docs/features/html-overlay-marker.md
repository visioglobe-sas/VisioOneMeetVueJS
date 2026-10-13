# HTML Overlay Marker

## Description

Overlays a plain HTML element (here, a "Open now · 12:00–14:00" badge) on the map at a geographic position with `venue.createMarker()`, shows/hides it with `venue.updateMarker()`, and removes it with `venue.removeMarker()`. Unlike a `Label` or an `Image`, which live inside the 3D scene, a marker is drawn on top of it: it always faces the screen, is never hidden by walls or other 3D geometry, and, being a regular DOM node, it can receive clicks and be restyled with plain CSS/DOM. The marker is owned by an existing POI (the "anchor"), so no `createPOI` is needed.

## SDK usage

```js
// Same POI lookup idiom as goto-poi / custom-text-label.
const anchor = venue.pois.find((p) => p.id === 'B4-UL00-ID0009')

// A POI has no direct lat/lng field: copy the Position of its first label or
// marker, then nudge it (~4 m) so the badge doesn't cover the map's own label.
const anchorPosition = anchor.labels[0]?.position ?? anchor.markers[0]?.position
const position = {
  ...anchorPosition,
  latitude: anchorPosition.latitude + 0.00004,
  longitude: anchorPosition.longitude + 0.00004,
}

// Any HTMLElement. Don't set position/top/left/transform on it (see "Things to know").
const element = document.createElement('div')
element.textContent = 'Open now · 12:00–14:00'
element.setAttribute(
  'style',
  'background:#0B6BCB;color:#FFFFFF;font:600 14px sans-serif;padding:6px 12px;' +
    'border-radius:14px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer',
)

const marker = venue.createMarker({ poi: anchor, position, element })

// The SDK sets pointer-events:none on the element at creation: opt back in to make it clickable.
element.style.pointerEvents = 'auto'
element.addEventListener('click', (event) => {
  event.stopPropagation() // otherwise the click also reaches the map and opens the POI underneath
  console.log('Badge tapped')
})

// Change the content: the element is a live DOM node, no SDK call needed.
marker.element.textContent = 'Closed today'

// Hide / show.
venue.updateMarker(marker, { isVisible: false })
venue.updateMarker(marker, { isVisible: true })

// Remove (also detaches the element from the DOM).
venue.removeMarker(marker)
```

Signatures, from `node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/`:

- `createMarker(options: MarkerCreateOptions): Marker`, where `MarkerCreateOptions` is `{ poi: POI; position: Position; element?: HTMLElement; isForeignMarker?: boolean }`.
- `updateMarker(marker: Marker, options: MarkerUpdateOptions): void`, where `MarkerUpdateOptions` is `{ position?: Position; isVisible?: boolean }`.
- `removeMarker(marker: Marker): void`.

The returned `Marker` exposes `poi`, `position`, `element`, `isVisible` and `isForeignMarker` as read-only fields.

## Things to know

- **`element` is required for an HTML marker.** Although optional in the typings, `createMarker` without it throws `Cannot createMarker, invalid element provided, options.element is missing`.
- **Not clickable by default.** The SDK sets `pointer-events: none` on the element at creation, so clicks fall through to the map (and open the card of the POI underneath). Set `element.style.pointerEvents = 'auto'` right after `createMarker`; the SDK does not reset it afterwards (camera moves included). Call `event.stopPropagation()` in your click handler so the click doesn't also reach the map.
- **The SDK owns the element's layout.** It moves the element into its own overlay container and sets `position: absolute; top: 0; left: 0; translate: -50% -50%` (the element is **centered** on the position), a per-frame `transform: translate(x, y)` and a `z-index`. Don't style those properties on the element itself; wrap your content in a child element if you need your own transforms or animations.
- **Never occluded by 3D.** The marker is drawn above the 3D scene, so walls and other geometry never hide it, at any camera pitch.
- **Floor-dependent display.** A marker is only displayed while its POI's floor is the displayed floor; on any other floor (or in the global view of a multi-building venue) the SDK sets `display: none`. This demo moves the camera to the anchor with `view.goToPOI(anchor)` right after creating the marker.
- **`updateMarker` only handles `position` and `isVisible`.** `isVisible: false` sets `display: none` but keeps the element in the DOM. Content and styling changes are plain DOM edits on `marker.element`.
- **Don't reuse a removed marker.** `removeMarker` or `updateMarker` on a marker that was already removed throws `Provided marker is not registered`. Drop your reference after removing it.
- **The marker belongs to its anchor POI.** It is appended to `anchor.markers`. If you copy an anchor's position from `anchor.markers` (as above) and place markers repeatedly, skip your own marker so you don't copy an already-offset position. Calling `removePOI` on the anchor would remove every visual attached to it.
- **One `Marker` per `createMarker` call.** Calling it again adds a second marker; keep the returned reference and `removeMarker` it first if you only want one.

## Learn more

- `MarkerCreateOptions.isForeignMarker` and the `foreignmarkerupdated` view event (`VisioOne/View/EventType.d.ts`, `View/Events/ForeignMarkerEvent.d.ts`): for positioning a native (non-HTML) view yourself from the screen coordinates the SDK sends on every camera move. Not used in this demo.
- `docs/features/custom-text-label.md`: the same anchor-POI approach for text drawn inside the 3D scene (`venue.createLabel()`).
- `docs/features/goto-poi.md`: `view.goToPOI()`, used here to bring the anchor's floor into view.
