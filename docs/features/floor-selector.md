# Floor / Building Selector

## Description

Lets the application drive floor and building changes itself, via `view.goToFloor(floor)` and `view.goToBuilding(building)`, backed by the real venue layout data at `venue.venueLayout.buildings[].floors[]` — never a hardcoded floor/building ID.

The SDK already renders its own default floor-selector widget on the map (the `'floorSelector'` `UIPart`, see `View.d.ts`) with no application code required. This feature isn't meant to replace it — it demonstrates that a client can drive the same underlying state from its own UI while staying in sync, including when the current floor changes through some other means (the SDK's own widget included).

## SDK usage

```js
const buildings = computed(() => venueRef.value?.venueLayout.buildings ?? [])

function selectFloor(floor) {
  viewRef.value?.goToFloor(floor)
}

function selectBuilding(building) {
  viewRef.value?.goToBuilding(building)
}

view.addEventListener('currentfloorchanged', (event) => {
  currentFloorId.value = event.newFloor?.id ?? null
  if (event.newBuilding) selectedBuildingId.value = event.newBuilding.id
})
```

Each `Building` (`Building.d.ts`) exposes `id`, `floors: Floor[]`, and `defaultFloorID`. Each `Floor` (`Floor.d.ts`) exposes `id`, `altitude`, and `levelIndex` — there is no "label"/"name" field, so any UI built on this data has to display `floor.id` as-is or map it to a friendlier name itself.

## Things to know

- `goToFloor`/`goToBuilding` expect the full `Floor`/`Building` object, not an ID — since these objects already come straight from `venue.venueLayout`, there's no lookup or "not found" handling needed, unlike POI-based features.
- `goToBuilding` also changes the current floor (to the target building's `defaultFloorID`) — don't call `goToFloor` right after in the same gesture, or you'll trigger two overlapping camera animations.
- `view.currentFloor` is read-only. The only way to change it is `goToFloor`/`goToBuilding` (or navigation/tracking) — listen to `'currentfloorchanged'` (`EventType.d.ts`/`VenueEvent.d.ts`) rather than re-reading state manually after each action, since the current floor can also change through the SDK's own default widget.
- Sort floors by `levelIndex`, not array order, which isn't guaranteed to reflect physical stacking.
