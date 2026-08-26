# Clickable Surface

## Description

Makes a POI's surface(s) SDK-interactive via `venue.updateSurface(surface, options)`, called once per surface with `isInteractive: true`. Once set, the SDK itself swaps the surface's displayed color on hover and on tap/click — no event listener or app-side click handling is needed for the coloring to work. This is the base building block for any "availability" use case (a free/occupied meeting room, a parking spot): the app only needs to flip `isInteractive` and set the three colors below; the SDK owns the rest of the interaction.

## SDK usage

```js
function setInteractive(poi, interactive) {
  poi.surfaces.forEach((surface) =>
    venue.updateSurface(
      surface,
      interactive
        ? { isInteractive: true, color: '#2ECC71', hoverColor: '#F1C40F', selectionColor: '#E74C3C' }
        : { isInteractive: false, color: 'initial' },
    ),
  )
}
```

The POI itself is resolved the same way as in `goto-poi`/`occupancy-simulated`: `venue.pois.find(p => p.id === targetId)`.

`SurfaceUpdateOptions` (see `node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/SurfaceUpdateOptions.d.ts`) exposes the relevant fields:

- `isInteractive: boolean` — when `true`, the surface becomes clickable and the SDK automatically swaps its rendered color on hover/selection using `hoverColor`/`selectionColor`.
- `color: Color | 'initial'` — the surface's idle/base color. `'initial'` resets it to whatever the map bundle originally defined, which is why it's used above when disabling interactivity — without it the surface would stay stuck on the last custom color.
- `hoverColor: Color | 'default'` — color shown while the pointer hovers the surface. `'default'` falls back to the view-wide `View.surfaceHoverColor`.
- `selectionColor: Color | 'default'` — color shown while the surface is in the SDK's clicked/selected state. `'default'` falls back to `View.surfaceSelectionColor`.

## Things to know

- All the interaction (hover detection, selection state, color swap) is entirely SDK-managed once `isInteractive: true` is set — there's nothing to wire on `view.addEventListener('poiclick', ...)` for the coloring itself. A `poiclick` listener is still the right tool if the app also needs to *react* to the tap (e.g. book the room), but the visual feedback happens regardless.
- `hoverColor` only has an observable effect with a pointer device (mouse). On touch-only devices the surface goes straight from idle to `selectionColor` on tap, with no visible hover state.
- Setting `isInteractive: false` does not automatically clear a previously set `color`/`hoverColor`/`selectionColor` — pass `color: 'initial'` explicitly (as above) or the surface keeps displaying the last custom idle color even though it's no longer clickable.
- A surface with `isInteractive: true` but no explicit `hoverColor`/`selectionColor` falls back to the view's global `surfaceHoverColor`/`surfaceSelectionColor` rather than staying unchanged — set them explicitly (as above) for a per-POI color scheme.
- Like `occupancy-simulated`/`goto-poi`, this only works on a POI that actually has one or more `Surface`s (`poi.surfaces`); a marker-only POI has nothing to make interactive this way.
