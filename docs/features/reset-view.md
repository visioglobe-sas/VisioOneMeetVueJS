# Reset View

## Description

Recenters the camera on the whole venue via `view.goToGlobal()` — a `View` method that takes no arguments and animates the camera back to the venue's default overview.

## SDK usage

```js
viewRef.value.goToGlobal()
```

`viewRef` is the template ref exposing the object returned by `visioOne.createView(container, venue)` (see `VisioOneMap.vue`'s `defineExpose`) — most `View` methods, including this one, are called on it directly, no bridge involved.

## Things to know

- Takes no arguments — it always resets to the venue's default global view, not a custom position or zoom level.
- `viewRef` is only populated after the `ready` event fires; calling `goToGlobal()` before that is a no-op if you guard with optional chaining (`viewRef.value?.goToGlobal()`).
- The camera animates back immediately when called; there's no callback or event to await.
