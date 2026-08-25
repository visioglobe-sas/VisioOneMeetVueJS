# UI Part Visibility

## Description

Shows/hides each of the SDK's 5 default on-map UI widgets individually, via `view.setUIPartVisible(uiPart, isVisible)` (and reads the current state with `view.isUIPartVisible(uiPart)`). The valid `uiPart` values are exactly `'floorSelector'`, `'navigation'`, `'poiDetails'`, `'search'`, and `'userTracking'` (type `UIPart`, `View.d.ts`) — no others exist.

## SDK usage

```js
const UI_PARTS = ['floorSelector', 'navigation', 'poiDetails', 'search', 'userTracking']

function toggleUIPart(uiPart, isVisible) {
  viewRef.value?.setUIPartVisible(uiPart, isVisible)
}
```

## Things to know

- The 5 `UIPart` values are exact and case-sensitive. There's no runtime validation visible in the typings — a typo fails silently rather than throwing.
- Hiding `'search'` or `'navigation'` removes the only built-in way for the user to trigger those flows. Only hide one of these if your app provides its own replacement UI for the same flow (a custom search, a "start navigation" button like `compute-navigation`, etc.).
- `setUIPartVisible`/`isUIPartVisible` only take effect once the view is ready — calling them before then has no target to act on.
