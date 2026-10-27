// App-driven floor/building picker, shared by floor-selector and
// native-ui-replacement. Reads the loaded venue's buildings/floors
// (venue.venueLayout.buildings[].floors[]), never hardcoded, and drives the
// camera with view.goToFloor()/view.goToBuilding(). See
// docs/features/floor-selector.md.
import { computed, onBeforeUnmount, ref } from 'vue'

export function useFloorSelector(venueRef, viewRef) {
  const selectedBuildingId = ref(null)
  const currentFloorId = ref(null)

  const buildings = computed(() => venueRef.value?.venueLayout.buildings ?? [])

  const selectedBuilding = computed(
    () => buildings.value.find((building) => building.id === selectedBuildingId.value) ?? null,
  )

  // Highest floor first (typical floor-selector reading order), based on the
  // SDK's own levelIndex rather than array order.
  const floors = computed(() =>
    [...(selectedBuilding.value?.floors ?? [])].sort((a, b) => b.levelIndex - a.levelIndex),
  )

  // Keeps the highlighted floor correct even if the current floor/building
  // changes through the SDK's own floor-selector widget, not just through
  // this picker's buttons.
  function handleCurrentFloorChanged(event) {
    currentFloorId.value = event.newFloor?.id ?? null
    if (event.newBuilding) selectedBuildingId.value = event.newBuilding.id
  }

  // Call once the view is ready.
  function init() {
    const view = viewRef.value
    if (!view) return
    selectedBuildingId.value = view.currentBuilding?.id ?? buildings.value[0]?.id ?? null
    currentFloorId.value = view.currentFloor?.id ?? null
    view.addEventListener('currentfloorchanged', handleCurrentFloorChanged)
  }

  function selectBuilding(building) {
    const view = viewRef.value
    if (!view || building.id === selectedBuildingId.value) return
    selectedBuildingId.value = building.id
    view.goToBuilding(building)
  }

  function selectFloor(floor) {
    const view = viewRef.value
    if (!view || floor.id === currentFloorId.value) return
    view.goToFloor(floor)
  }

  onBeforeUnmount(() => viewRef.value?.removeEventListener('currentfloorchanged', handleCurrentFloorChanged))

  return { buildings, floors, selectedBuildingId, currentFloorId, init, selectBuilding, selectFloor }
}
