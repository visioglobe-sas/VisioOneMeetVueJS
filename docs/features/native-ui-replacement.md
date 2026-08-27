# Native UI Replacement

## Description

Demonstrates that an app's own fully-native UI can completely replace one of the SDK's default UI components, rather than merely coexisting with it. This screen hides the SDK's built-in floor-selector widget and relies solely on the app's own native floor/building picker (the same one built for the [floor-selector](./floor-selector.md) feature) to drive `view.goToFloor()`/`view.goToBuilding()`.

By default the SDK's floor-selector widget is hidden and the app's native picker is the only floor control on screen — a genuine white-label result, not two overlapping floor pickers. A toggle lets a visitor reveal the SDK's own widget again, side by side with the app's picker, to see both driving the same floor state live and confirm the app's control is a complete, fully-functional replacement, not a partial stand-in.

## SDK usage

The relevant call is `view.setUIPartVisible(uiPart: UIPart, isVisible: boolean): void`, called directly on the `view` instance (no bridge layer in this repo):

```js
view.setUIPartVisible('floorSelector', false) // hide the SDK's own floor-selector widget
view.setUIPartVisible('floorSelector', true)  // reveal it again
```

`UIPart` is a fixed, case-sensitive union (`'floorSelector' | 'navigation' | 'poiDetails' | 'search' | 'userTracking'`) — see [`ui-part-visibility`](./ui-part-visibility.md), which demonstrates all five values generically. This feature is the same call restricted to one specific part (`'floorSelector'`), applied on load so the widget starts hidden, plus a toggle to flip it back on for comparison.

The floor/building picker itself is **not reimplemented** here — it reuses the exact same native control, state, and `view.goToFloor()`/`view.goToBuilding()` calls already built for [`floor-selector`](./floor-selector.md), reading the real venue layout from `venue.venueLayout.buildings[].floors[]` and staying in sync with the current floor via the `currentfloorchanged` event. That control keeps working identically regardless of whether the SDK's own widget is shown or hidden — the point being demonstrated is that the app's control was never dependent on the SDK's widget in the first place.

## Things to know

- `setUIPartVisible` only affects the SDK's own on-map widget's visibility — it has no effect on the app's native picker or on `goToFloor`/`goToBuilding` themselves, which work identically whichever way the SDK widget is toggled.
- The SDK widget's own internal state (which floor it currently highlights) keeps updating even while hidden, so re-showing it via the toggle reflects the current floor immediately, with no separate resync step needed.

## Learn more

- [`ui-part-visibility`](./ui-part-visibility.md) — the general-purpose version of this same SDK call, covering all five hideable UI parts.
- [`floor-selector`](./floor-selector.md) — the native floor/building picker this feature reuses as-is.
