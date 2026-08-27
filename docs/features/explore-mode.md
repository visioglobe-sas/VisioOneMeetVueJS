# Explore Mode

## Description

Drives the SDK's 3 building-exploration modes through the settable `view.currentExploreMode` property, which changes how the map is displayed and interacted with:

- `'global'` — the normal outside view. Moving the camera in or out of a building opens/closes it.
- `'building'` — the outside is hidden and every currently opened building's floors are presented as a "carousel" (an exploded, cross-section-like view). A click on the map switches to `'floor'` mode.
- `'floor'` — only the current floor is displayed.

`'building'` mode is the flagship visual effect: a fast, high-impact way to show a multi-floor building's structure at a glance.

## SDK usage

```js
// Read/observe the mode
const mode = view.currentExploreMode // 'global' | 'building' | 'floor'

view.addEventListener('exploremodechanged', (event) => {
  console.log(event.currentExploreMode) // the new mode
})

// Change the mode
view.currentExploreMode = 'building'
```

`view.currentExploreMode` is a plain settable property of type `ExploreMode = 'global' | 'building' | 'floor'` (`View.d.ts`, `ExploreMode.d.ts`) — assigning to it is enough to change mode, no method call needed.

The `'exploremodechanged'` event (`EventType.d.ts`, `Events/ExploreModeEvent.d.ts`) fires whenever the mode changes, whatever the cause — this app's own assignment, or the SDK's own internal logic (e.g. camera movement, or the click-driven `'building'` → `'floor'` auto-transition described above). Its payload (`ExploreModeEvent`) carries `currentExploreMode` (the new mode), plus `eventType`, `venue`, and `view`. Any UI mirroring the active mode should stay driven by this event rather than by re-reading `view.currentExploreMode` only right after its own calls — this is the same "SDK event can change state outside the app's own calls" situation as `currentfloorchanged` (see `docs/features/floor-selector.md`).

```js
view.currentBuilding // Building | undefined — the currently opened building, if any
view.goToBuilding(building) // opens/animates to a building; returns an AnimationPromise
```

## Things to know

- `'building'` mode only has visible effect once at least one building is actually open (`view.currentBuilding` is defined) — setting `currentExploreMode = 'building'` while the camera is still fully outside has nothing to show. Call `view.goToBuilding(building)` first (it returns an `AnimationPromise`, `await`-able) if no building is open yet.
- The `'building'` → `'floor'` transition on click is automatic, driven by the SDK itself — no app code triggers it, and no app code needs to call `goToFloor` to make it happen. The `'exploremodechanged'` listener is what makes a native control aware this happened.
- `view.currentBuilding` is read-only; it changes as a side effect of `goToBuilding`/`goToFloor`/camera movement, not by being assigned directly.
- `goToGlobal()` also changes `currentExploreMode` to `'global'`, but only once its animation completes — assigning `currentExploreMode = 'global'` directly is immediate and doesn't animate the camera back out on its own.
- Confirmed live against the shared demo map: assigning `currentExploreMode = 'global'` while a building is open (i.e. coming from `'floor'` mode) can log an internal SDK exception (`BuildingAdapter.retrieveVisioOneCoreModelsFromBuilding` — `TypeError: Cannot read properties of undefined (reading 'id')`, thrown from `VenueAnimator.slideBuilding`/`goToBuilding` deep inside the SDK bundle). The mode still ends up correctly at `'global'` and the map keeps working afterwards — it's a noisy console error, not a functional break — but don't be surprised if it shows up in the browser console while wiring this up.

## Learn more

- `docs/features/floor-selector.md` — the sibling "keep a native control in sync with a live SDK event" pattern (`currentfloorchanged` instead of `exploremodechanged`).
