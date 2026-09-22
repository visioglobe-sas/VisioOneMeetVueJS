# Custom Navigation Trace

## Description

Restyles the route drawn by [`compute-navigation`](./compute-navigation.md) with custom colors, via `venue.updateNavigationTrace(navigationTrace, options)` — the same `NavigationTrace` object created by `venue.createNavigationTrace()`, just given a `NavigationTraceUpdateOptions` object afterward.

## SDK usage

```js
const navigation = venue.computeNavigation({ origin: originPoi, destination: destinationPoi })
const trace = venue.createNavigationTrace(navigation)
view.setCurrentNavigationTrace(trace)

venue.updateNavigationTrace(trace, {
  progressColor: '#E53935',
  progressOutlineColor: '#FFFFFF',
  progressFutureColor: '#F8C9C7',
  previewColor: '#F8C9C7',
  previewOutlineColor: '#FFFFFF',
})
```

`NavigationTraceUpdateOptions` (`Navigation/NavigationTraceUpdateOptions.d.ts`) only exposes colors (plus `textureRepeat`/`animationSpeed`, relevant only for the `'textured'` `displayMode`) — there is no way to change `displayMode` or `thickness` after creation, and `createNavigationTrace()` itself takes no options, so a trace always starts in the SDK's default display mode.

## Things to know

- **There is no "reset to default" call.** Colors are one-way: once changed, the only way back to the SDK's own look is to re-apply its documented defaults yourself (`Line.color` defaults to `'#0094F0'`, the inactive/preview segment to `'#C5C5C5'` — see `Venue/Line.d.ts`).
- **`updateNavigationTrace` can throw internally even on a fully valid trace.** On this demo venue it consistently throws `TypeError: Cannot read properties of undefined (reading 'material')` deep inside the SDK's line-rendering pipeline (`LineAdapter.updateLine`) — yet every color in the options object is still applied correctly before it throws. Wrap the call in `try/catch` and treat the color change as applied regardless of whether it throws; don't treat the throw as a sign the update failed.
- Colors only affect a trace that already exists — calling `updateNavigationTrace` before `createNavigationTrace`/`setCurrentNavigationTrace` has nothing to act on. If you want a consistent look, re-apply the same options object right after creating each new trace, not just once.
- Field naming is easy to mix up: `progressColor` is the segment **not yet walked** (the "active" part still ahead), while `progressFutureColor` is a second, separate color also tied to that unwalked portion — read `NavigationTraceUpdateOptions.d.ts`'s own doc comments rather than assuming from the name alone.

## Learn more

See [`compute-navigation`](./compute-navigation.md) for how the `Navigation`/`NavigationTrace` pair is computed and displayed in the first place — this feature only adds a styling call on top of it.
