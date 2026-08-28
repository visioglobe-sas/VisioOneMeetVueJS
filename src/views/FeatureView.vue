<script setup>
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import BottomSheet from '../components/BottomSheet.vue'
import VisioOneMap from '../components/VisioOneMap.vue'
import { features } from '../features'

const props = defineProps({
  slug: { type: String, required: true },
})

const { t } = useI18n()

const currentFeature = features.find((feature) => feature.slug === props.slug)

const visioOneHash = import.meta.env.VITE_VISIOONE_HASH
const visioOneBaseURL = import.meta.env.VITE_VISIOONE_BASE_URL
const visioOneAuthToken = import.meta.env.VITE_VISIOONE_AUTH_TOKEN

// The custom-data feature needs a map that actually has CustomData
// published — the shared demo map pointed at by VITE_VISIOONE_HASH has
// none, whatever a given developer's local .env happens to be set to. So,
// only for this one screen, override the hash with a dedicated map known
// (confirmed live) to carry real CustomData — see docs/features/custom-data.md.
// Every other slug keeps using visioOneHash exactly as before.
const CUSTOM_DATA_MAP_HASH = 'kd9426d8cb3f1c532f22b5bcbd325c280bd351feb'
const mapHash = computed(() => (props.slug === 'custom-data' ? CUSTOM_DATA_MAP_HASH : visioOneHash))

// shallowRef, not ref: `venue`/`view` are VisioOne SDK class instances. A
// deep ref() would wrap every nested object (POIs, Surfaces, Floors...) in a
// Vue reactive Proxy, and the SDK checks object identity internally — a
// proxied Surface/Floor/POI passed back into updateSurface/goToFloor/
// computeNavigation is never === the real instance the SDK registered,
// causing SurfaceNotFoundError/FloorNotFoundError/POINotFoundError/
// BuildingNotFoundError. Matches VisioOneMap.vue's own shallowRef usage for
// the same objects.
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)
const controlsOpen = ref(false)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
  console.log('VisioOne venue loaded:', venue)
  console.log('VisioOne view created:', view)
  if (props.slug === 'floor-selector') initFloorSelector()
  if (props.slug === 'explore-mode') initExploreMode()
  if (props.slug === 'runtime-locale') initRuntimeLocale()
  if (props.slug === 'native-ui-replacement') initNativeUiReplacement()
}

function resetView() {
  viewRef.value?.goToGlobal()
}

function handleError(error) {
  console.error('VisioOne error:', error)
}

// event.pois is an array because a single click can hit several overlapping
// POIs (e.g. a marker sitting on top of a surface) — see POIEvent in the SDK
// typings (@visioglobe/visioone/dist/src/VisioOne/View/Events/POIEvent.d.ts).
const clickedPois = ref([])

function poiName(poi) {
  return poi.labels?.[0]?.text || poi.id
}

function poiCategories(poi) {
  return (poi.categories ?? []).map((category) => category.id).join(', ')
}

function handlePOIClick(event) {
  console.log('POI clicked:', event)
  if (props.slug !== 'poi-click') return
  clickedPois.value = event.pois ?? []
  controlsOpen.value = true
}

// Stand-in for a real occupancy sensor feed: cycles a POI's surface through
// these colors on a timer. See docs/features/occupancy-simulated.md.
const OCCUPANCY_COLORS = ['#2ECC71', '#F1C40F', '#E74C3C']
const OCCUPANCY_INTERVAL_MS = 2500

const placeId = ref('')
const simulatingOccupancy = ref(false)
let occupancyTimer = null
let occupancyColorIndex = 0
// The place ID actually targeted by the running timer — captured at start,
// deliberately not re-read from `placeId` on stop (see stopOccupancySimulation).
let simulatingPlaceId = null

function updateOccupancy(targetPlaceId, color) {
  const venue = venueRef.value
  if (!venue) return
  const poi = venue.pois.find((p) => p.id === targetPlaceId)
  if (!poi) return
  poi.surfaces.forEach((surface) => venue.updateSurface(surface, { color }))
}

function toggleOccupancySimulation() {
  if (simulatingOccupancy.value) {
    stopOccupancySimulation()
  } else {
    startOccupancySimulation()
  }
}

function startOccupancySimulation() {
  const targetPlaceId = placeId.value.trim()
  if (!targetPlaceId) return

  simulatingOccupancy.value = true
  simulatingPlaceId = targetPlaceId
  occupancyColorIndex = 0
  updateOccupancy(targetPlaceId, OCCUPANCY_COLORS[occupancyColorIndex])
  occupancyTimer = setInterval(() => {
    occupancyColorIndex = (occupancyColorIndex + 1) % OCCUPANCY_COLORS.length
    updateOccupancy(targetPlaceId, OCCUPANCY_COLORS[occupancyColorIndex])
  }, OCCUPANCY_INTERVAL_MS)
}

function stopOccupancySimulation() {
  clearInterval(occupancyTimer)
  occupancyTimer = null
  // Reset the POI that was actually being simulated — not whatever `placeId`
  // currently holds, which may have been edited since simulation started.
  if (simulatingPlaceId) {
    // Reset the surface rather than leaving it stuck on the last simulated color.
    updateOccupancy(simulatingPlaceId, undefined)
  }
  simulatingPlaceId = null
  simulatingOccupancy.value = false
}

onBeforeUnmount(() => {
  clearInterval(occupancyTimer)
  clearInterval(positionTimer)
  // Leaving the screen counts as "the simulation stops" too — don't leave the
  // camera lock engaged for whatever destroys/recreates the view next.
  resetCameraLock()
  viewRef.value?.removeEventListener('currentfloorchanged', handleCurrentFloorChanged)
  viewRef.value?.removeEventListener('exploremodechanged', handleExploreModeChanged)
})

// Dedicated Place ID field + Go/Clear buttons — deliberately not wired to
// map-click (that's the poi-click feature's own panel, see handlePOIClick
// above). See docs/features/goto-poi.md for why the two aren't merged.
const goToPoiId = ref('')
const goToPoiNotFound = ref(false)
// The POI currently highlighted by "Go" — kept so "Clear" can reset its
// surfaces even if the input has been edited since, same pattern as
// simulatingPlaceId above.
let highlightedPoi = null

function goToPoi() {
  const venue = venueRef.value
  const view = viewRef.value
  if (!venue || !view) return

  const targetId = goToPoiId.value.trim()
  if (!targetId) return

  const poi = venue.pois.find((p) => p.id === targetId)
  if (!poi) {
    goToPoiNotFound.value = true
    return
  }
  goToPoiNotFound.value = false

  clearGoToPoiHighlight()
  highlightedPoi = poi
  poi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: '#057DBC' }))
  view.goToPOI(poi, {
    orientation: { pitch: 20 },
    padding: { top: 100, bottom: 100, left: 100, right: 100 },
  })
}

function clearGoToPoiHighlight() {
  if (!highlightedPoi) return
  const venue = venueRef.value
  if (venue) {
    highlightedPoi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: undefined }))
  }
  highlightedPoi = null
}

function clearGoToPoi() {
  clearGoToPoiHighlight()
  goToPoiId.value = ''
  goToPoiNotFound.value = false
}

// Floor/building selector: reads the actual loaded venue's buildings/floors
// (venue.venueLayout.buildings[].floors[]) — never hardcoded — and drives the
// camera with view.goToFloor()/view.goToBuilding(). The SDK already shows its
// own default floor-selector widget on the map; this is a second, app-driven
// control demonstrating that a client can build their own UI on top of the
// same API. See docs/features/floor-selector.md.
const selectedBuildingId = ref(null)
const currentFloorId = ref(null)

const buildings = computed(() => venueRef.value?.venueLayout.buildings ?? [])

const selectedBuilding = computed(
  () => buildings.value.find((building) => building.id === selectedBuildingId.value) ?? null,
)

// Highest floor first (typical floor-selector reading order), based on the
// SDK's own levelIndex rather than array order.
const floorsForSelectedBuilding = computed(() =>
  [...(selectedBuilding.value?.floors ?? [])].sort((a, b) => b.levelIndex - a.levelIndex),
)

function syncCurrentFloor() {
  const view = viewRef.value
  if (!view) return
  currentFloorId.value = view.currentFloor?.id ?? null
}

// Keeps this panel's highlighted floor correct even if the current
// floor/building changes through the SDK's own floor-selector widget, not
// just through this panel's buttons.
function handleCurrentFloorChanged(event) {
  currentFloorId.value = event.newFloor?.id ?? null
  if (event.newBuilding) selectedBuildingId.value = event.newBuilding.id
}

function initFloorSelector() {
  const view = viewRef.value
  if (!view) return
  selectedBuildingId.value = view.currentBuilding?.id ?? buildings.value[0]?.id ?? null
  syncCurrentFloor()
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

// Explore mode: drives the SDK's 3 building-exploration modes via the
// settable view.currentExploreMode property ('global' | 'building' |
// 'floor'). 'building' is the flagship "wahou" visual — opened buildings'
// floors shown as an exploded carousel — but it only has anything to show
// once a building is actually open (view.currentBuilding defined). So,
// same idiom as floor-selector's currentfloorchanged sync, this panel's
// active button is kept correct via the 'exploremodechanged' event, which
// also fires the SDK's own auto-transition out of "building" mode on a
// map click (SDK switches to "floor" on its own). See
// docs/features/explore-mode.md.
const EXPLORE_MODES = ['global', 'building', 'floor']
const currentExploreMode = ref(null)

function handleExploreModeChanged(event) {
  currentExploreMode.value = event.currentExploreMode
}

function initExploreMode() {
  const view = viewRef.value
  if (!view) return
  currentExploreMode.value = view.currentExploreMode
  view.addEventListener('exploremodechanged', handleExploreModeChanged)
}

async function selectExploreMode(mode) {
  const view = viewRef.value
  const venue = venueRef.value
  if (!view || mode === currentExploreMode.value) return

  // "building" mode has nothing to show if no building is open yet — open
  // the first one so the carousel effect is always one tap away, rather
  // than requiring the visitor to first navigate into a building manually.
  if (mode === 'building' && !view.currentBuilding) {
    const firstBuilding = venue?.venueLayout.buildings[0]
    if (firstBuilding) await view.goToBuilding(firstBuilding)
  }

  view.currentExploreMode = mode
}

// Itinerary between two Place IDs, via venue.computeNavigation() + a
// NavigationTrace made current on the view. Both POIs are resolved through
// venue.pois.find (same lookup pattern as goto-poi — no venue.getPOIById in
// the SDK typings) so a typo surfaces as an explicit "not found" message
// rather than a silent no-op. See docs/features/compute-navigation.md.
const itineraryOriginId = ref('')
const itineraryDestinationId = ref('')
const itineraryError = ref('')
// The NavigationTrace currently displayed, if any — kept outside any ref
// since it's only ever read by clearItinerary/computeItinerary, same pattern
// as highlightedPoi for goto-poi.
let currentNavigationTrace = null

function computeItinerary() {
  const venue = venueRef.value
  const view = viewRef.value
  if (!venue || !view) return

  const originId = itineraryOriginId.value.trim()
  const destinationId = itineraryDestinationId.value.trim()
  if (!originId || !destinationId) return

  const originPoi = venue.pois.find((p) => p.id === originId)
  const destinationPoi = venue.pois.find((p) => p.id === destinationId)
  if (!originPoi || !destinationPoi) {
    itineraryError.value = t('features.computeNavigation.notFound')
    return
  }

  clearItinerary()

  try {
    const navigation = venue.computeNavigation({ origin: originPoi, destination: destinationPoi })
    currentNavigationTrace = venue.createNavigationTrace(navigation)
    view.setCurrentNavigationTrace(currentNavigationTrace)
    itineraryError.value = ''
  } catch (error) {
    // computeNavigation throws RouteNotFoundError/SourceOutOfLimitError/
    // DestinationOutOfLimitError (see Navigation/Errors in the SDK typings)
    // when the two POIs aren't connected by the routing graph.
    console.error('computeNavigation failed:', error)
    itineraryError.value = t('features.computeNavigation.routeNotFound')
  }
}

function clearItinerary() {
  const venue = venueRef.value
  if (venue && currentNavigationTrace) {
    viewRef.value?.removeCurrentNavigationTrace()
    venue.removeNavigationTrace(currentNavigationTrace)
  }
  currentNavigationTrace = null
  itineraryError.value = ''
}

function clearItineraryFields() {
  clearItinerary()
  itineraryOriginId.value = ''
  itineraryDestinationId.value = ''
}

// Selective UI masking: toggles one of the SDK's own default UI overlays via
// view.setUIPartVisible(uiPart, isVisible) — called directly on the live
// `view` instance, no bridge needed (this is the one platform where the app
// talks to the SDK object directly). The 5 UIPart values below are exact and
// case-sensitive (VisioOne SDK, View.ts) — no others exist. All default to
// visible, matching the SDK's own default (nothing is hidden until a switch
// is flipped). See docs/features/ui-part-visibility.md.
const UI_PARTS = ['floorSelector', 'navigation', 'poiDetails', 'search', 'userTracking']
const uiPartVisibility = ref(Object.fromEntries(UI_PARTS.map((part) => [part, true])))

function toggleUIPart(uiPart) {
  const view = viewRef.value
  if (!view) return
  const isVisible = !uiPartVisibility.value[uiPart]
  uiPartVisibility.value[uiPart] = isVisible
  view.setUIPartVisible(uiPart, isVisible)
}

// Simulated tracked position: walks a dot + accuracy circle back and forth
// between two Place IDs, via view.injectTrackedPosition() (no bridge, same
// direct-SDK-call pattern as the rest of this file). Neither POI carries a
// lat/lng field directly — it's read off its first marker/label/image, which
// all carry a Position in the same shape injectTrackedPosition expects. See
// docs/features/simulated-position.md.
const POSITION_INTERVAL_MS = 150
// Fraction of the origin->destination segment advanced per tick (~150ms *
// 1/0.02 ticks = ~7.5s one-way, then back), not a real speed/time model.
const POSITION_STEP = 0.02

const originPoiId = ref('')
const destinationPoiId = ref('')
const positionError = ref('')
const accuracyRadius = ref(5)
const simulatingPosition = ref(false)
let positionTimer = null
// The resolved origin/destination positions and progress of the currently
// running simulation — module-locals, not refs, same pattern as
// simulatingPlaceId/highlightedPoi above (captured at Start, not re-read from
// the input fields on every tick).
let positionOrigin = null
let positionDestination = null
let positionProgress = 0
let positionDirection = 1

function resolvePoiPosition(id) {
  const venue = venueRef.value
  if (!venue) return null
  const poi = venue.pois.find((p) => p.id === id)
  if (!poi) return null
  return poi.markers?.[0]?.position ?? poi.labels?.[0]?.position ?? poi.images?.[0]?.position ?? null
}

function lerpPosition(from, to, progress) {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * progress,
    longitude: from.longitude + (to.longitude - from.longitude) * progress,
    altitude: (from.altitude ?? 0) + ((to.altitude ?? 0) - (from.altitude ?? 0)) * progress,
  }
}

function toggleSimulatedPosition() {
  if (simulatingPosition.value) {
    stopSimulatedPosition()
  } else {
    startSimulatedPosition()
  }
}

function startSimulatedPosition() {
  const view = viewRef.value
  if (!view) return

  const originId = originPoiId.value.trim()
  const destinationId = destinationPoiId.value.trim()
  if (!originId || !destinationId) return

  const origin = resolvePoiPosition(originId)
  const destination = resolvePoiPosition(destinationId)
  if (!origin || !destination) {
    positionError.value = t('features.simulatedPosition.notFound')
    // Nothing is tracked, so any lingering camera lock from a previous run
    // would be meaningless — keep the "stopped -> unlocked" contract intact.
    resetCameraLock()
    return
  }
  positionError.value = ''

  positionOrigin = origin
  positionDestination = destination
  positionProgress = 0
  positionDirection = 1

  // Mandatory before the first injectTrackedPosition call, or it throws —
  // see PositionTrackerOptions/View.allowTracking in the SDK typings.
  view.allowTracking = true
  simulatingPosition.value = true
  injectSimulatedPositionTick()
  positionTimer = setInterval(injectSimulatedPositionTick, POSITION_INTERVAL_MS)
}

function injectSimulatedPositionTick() {
  const view = viewRef.value
  if (!view || !positionOrigin || !positionDestination) return

  view.injectTrackedPosition({
    position: lerpPosition(positionOrigin, positionDestination, positionProgress),
    // Re-read live on every tick: moving the slider while the simulation
    // runs changes the radius on the next tick, no restart needed.
    precisionCircleRadius: accuracyRadius.value,
  })

  positionProgress += POSITION_STEP * positionDirection
  if (positionProgress >= 1) {
    positionProgress = 1
    positionDirection = -1
  } else if (positionProgress <= 0) {
    positionProgress = 0
    positionDirection = 1
  }
}

function stopSimulatedPosition() {
  clearInterval(positionTimer)
  positionTimer = null
  positionOrigin = null
  positionDestination = null
  // No dedicated "stop tracking" call in the SDK — allowTracking = false is
  // what removes the marker/accuracy circle from the map.
  if (viewRef.value) viewRef.value.allowTracking = false
  simulatingPosition.value = false
  // Locking is a deliberate per-run opt-in, never a lingering state — see
  // resetCameraLock and docs/features/camera-lock-on-position.md.
  resetCameraLock()
}

// Camera lock on the tracked position: view.lockCameraPositionOnTracking is a
// plain boolean toggled directly on the exposed `view` instance, same
// direct-SDK-call pattern as allowTracking/injectTrackedPosition above. Only
// has a visible effect once allowTracking is true (i.e. a simulation is
// running) — setting it beforehand is a documented no-op on the SDK side, not
// an exception (unlike injectTrackedPosition), so no extra guard is needed
// here beyond disabling the checkbox while nothing is being tracked. See
// docs/features/camera-lock-on-position.md.
const lockCameraOnPosition = ref(false)

function resetCameraLock() {
  lockCameraOnPosition.value = false
  if (viewRef.value) viewRef.value.lockCameraPositionOnTracking = false
}

function toggleCameraLock() {
  const view = viewRef.value
  if (!view) return
  lockCameraOnPosition.value = !lockCameraOnPosition.value
  view.lockCameraPositionOnTracking = lockCameraOnPosition.value
}

// Clickable surface: venue.updateSurface(surface, { isInteractive: true, ... })
// makes a POI's surface(s) SDK-managed clickable — once set, the SDK itself
// swaps the surface's displayed color on hover/tap using hoverColor/
// selectionColor below, with zero click-handling code on this side for the
// coloring itself. Base building block for any "availability" use case (a
// free/occupied room, a parking spot). See docs/features/clickable-surface.md.
const clickableSurfacePlaceId = ref('')
const clickableSurfaceEnabled = ref(false)
const clickableSurfaceNotFound = ref(false)
// The POI actually toggled — captured at Enable, not re-read from the input
// on Disable, same pattern as simulatingPlaceId/highlightedPoi above.
let clickableSurfacePoi = null

function setClickableSurfaceInteractive(poi, interactive) {
  const venue = venueRef.value
  if (!venue) return
  poi.surfaces.forEach((surface) =>
    venue.updateSurface(
      surface,
      interactive
        ? { isInteractive: true, color: '#2ECC71', hoverColor: '#F1C40F', selectionColor: '#E74C3C' }
        : { isInteractive: false, color: 'initial' },
    ),
  )
}

function enableClickableSurface() {
  const venue = venueRef.value
  if (!venue) return

  const targetId = clickableSurfacePlaceId.value.trim()
  if (!targetId) return

  const poi = venue.pois.find((p) => p.id === targetId)
  if (!poi) {
    clickableSurfaceNotFound.value = true
    return
  }
  clickableSurfaceNotFound.value = false

  clickableSurfacePoi = poi
  setClickableSurfaceInteractive(poi, true)
  clickableSurfaceEnabled.value = true
}

function disableClickableSurface() {
  if (clickableSurfacePoi) setClickableSurfaceInteractive(clickableSurfacePoi, false)
  clickableSurfacePoi = null
  clickableSurfaceEnabled.value = false
}

// Custom data: free business key/value strings (price, opening hours,
// product reference) attached to a POI in VisioMapEditor, read via
// venue.getPOICustomData(poi). The venue's CustomData cache starts empty
// ({}) and is never refreshed automatically on load — venue.refreshCustomData()
// must be awaited at least once first. "Load" below does both in sequence
// so the feature exercises both SDK calls from a single action, same
// judgment call as the combined Start/Stop buttons elsewhere in this file.
// See docs/features/custom-data.md.
const customDataPlaceId = ref('')
const customDataLoading = ref(false)
const customDataNotFound = ref(false)
// null = nothing loaded yet; [] = POI found but its CustomData is {}; a
// non-empty array otherwise. Distinguishing null from [] is what lets the
// template tell "nothing attempted" from "attempted, found nothing".
const customDataEntries = ref(null)

// POI ids confirmed (live, against CUSTOM_DATA_MAP_HASH) to carry real,
// non-empty CustomData — offered as one-tap shortcuts so the feature shows
// actual key/value pairs without hunting for a valid id first.
const CUSTOM_DATA_SAMPLE_POI_IDS = ['B1', 'B3-UL00-ID0065', 'B3-UL00-ID0064']

function loadCustomDataSample(id) {
  customDataPlaceId.value = id
  loadCustomData()
}

async function loadCustomData() {
  const venue = venueRef.value
  if (!venue) return

  const targetId = customDataPlaceId.value.trim()
  if (!targetId) return

  customDataLoading.value = true
  customDataNotFound.value = false
  customDataEntries.value = null

  try {
    // refreshCustomData() rejects (rather than resolving) when the venue has
    // no CustomData published yet — e.g. a 404 on its customData.json,
    // confirmed against the shared demo map. That's a normal "nothing to
    // load yet" outcome, not a real failure, so it's swallowed here and the
    // lookup proceeds against whatever the (possibly still-empty) cache
    // holds — see docs/features/custom-data.md.
    try {
      await venue.refreshCustomData()
    } catch (error) {
      console.warn('refreshCustomData failed (likely no CustomData published for this venue):', error)
    }

    const poi = venue.pois.find((p) => p.id === targetId)
    if (!poi) {
      customDataNotFound.value = true
      return
    }

    // Synchronous, always returns {} (never null/undefined) — including
    // when the POI genuinely has no CustomData, which is the expected state
    // on a map that hasn't published any yet.
    const customData = venue.getPOICustomData(poi)
    customDataEntries.value = Object.entries(customData)
  } finally {
    customDataLoading.value = false
  }
}

function clearCustomData() {
  customDataPlaceId.value = ''
  customDataNotFound.value = false
  customDataEntries.value = null
}

// Category highlight: no dedicated "highlight by category" SDK method exists
// — built from primitives. venue.categories (Category[], { readonly id }) is
// the venue's full category list; a POI can carry several of its own
// (poi.categories). Matching POIs are found with a plain filter, then each
// of their surfaces gets venue.updateSurface(surface, { color }) — exactly
// the same call as occupancy-simulated/clickable-surface, just applied to a
// whole category's worth of POIs at once instead of a single Place ID. See
// docs/features/category-highlight.md.
const CATEGORY_HIGHLIGHT_COLOR = '#FF6B00'
// category.id is a raw internal identifier (a numeric string on the shared
// demo map, e.g. "1".."11"), not itself human-readable — confirmed live. The
// display name comes from venue.translator.translateCategory(). id is still
// what filtering/highlighting uses; label is for display only.
const categories = computed(() => {
  const venue = venueRef.value
  if (!venue) return []
  return venue.categories.map((category) => ({
    id: category.id,
    label: venue.translator.translateCategory(category, venue.currentLocale).name || category.id,
  }))
})
const selectedCategoryId = ref(null)
// The POIs actually recolored by the current selection — kept so Clear (or
// picking a different category) can revert exactly those, same pattern as
// highlightedPoi/clickableSurfacePoi above.
let highlightedCategoryPois = []

function poisInCategory(categoryId) {
  const venue = venueRef.value
  if (!venue) return []
  return venue.pois.filter((poi) => (poi.categories ?? []).some((category) => category.id === categoryId))
}

function selectCategory(category) {
  if (!venueRef.value) return

  // Clicking the already-selected category again just clears it.
  if (selectedCategoryId.value === category.id) {
    clearCategoryHighlight()
    return
  }

  // Only one category highlighted at a time — revert the previous one first.
  clearCategoryHighlight()

  // Not every POI has surfaces (some are point/marker-only) — those simply
  // don't visually change here, which is expected, not a bug.
  const pois = poisInCategory(category.id)
  pois.forEach((poi) => poi.surfaces.forEach((surface) => venueRef.value.updateSurface(surface, { color: CATEGORY_HIGHLIGHT_COLOR })))

  highlightedCategoryPois = pois
  selectedCategoryId.value = category.id
}

function clearCategoryHighlight() {
  const venue = venueRef.value
  if (venue) {
    // 'initial' is the SDK's documented sentinel to restore a surface's
    // bundle-defined color (SurfaceUpdateOptions) — not the same as
    // `undefined`/omitting the key.
    highlightedCategoryPois.forEach((poi) =>
      poi.surfaces.forEach((surface) => venue.updateSurface(surface, { color: 'initial' })),
    )
  }
  highlightedCategoryPois = []
  selectedCategoryId.value = null
}

// Dynamic POI CRUD: venue.createPOI() makes a bare POI — a purely logical
// id/floor/categories container, with no visual representation of its own
// (readonly images/labels/lines/surfaces/markers all start empty) — so a
// Label is attached right after via venue.createLabel() to make it visible,
// at a position copied from an existing "anchor" POI (no map-tap UI in this
// demo). venue.updatePOI() can only ever change categories, never anything
// visual, so "editing" this POI's content here means venue.updateLabel()-ing
// its attached label's text instead. venue.removePOI() cascades: it also
// removes the attached Label from the view, no separate removeLabel call
// needed. Only one dynamic POI tracked at a time, simplest demo state. See
// docs/features/dynamic-poi-crud.md.
const DEFAULT_LABEL_WIDTH = 2

const newPoiId = ref('')
const anchorPoiId = ref('')
const labelText = ref('')
const dynamicPoiErrorKey = ref('')
// The actual POI/Label SDK instances currently tracked are kept as
// module-locals, not refs — same split as highlightedPoi/clickableSurfacePoi
// above — while their id/text are mirrored into refs purely for the template
// to read.
let trackedPoi = null
let trackedLabel = null
const trackedPoiId = ref('')
const trackedLabelText = ref('')

function resolveAnchorPosition(anchor) {
  // Whichever visual element exists first — a label or a marker — carries a
  // Position in the same WGS84 shape createLabel expects.
  return anchor.labels?.[0]?.position ?? anchor.markers?.[0]?.position ?? null
}

function createDynamicPoi() {
  const venue = venueRef.value
  if (!venue || trackedPoi) return

  dynamicPoiErrorKey.value = ''

  const id = newPoiId.value.trim()
  const anchorId = anchorPoiId.value.trim()
  if (!id || !anchorId) return

  const anchor = venue.pois.find((p) => p.id === anchorId)
  if (!anchor) {
    dynamicPoiErrorKey.value = 'features.dynamicPoiCrud.anchorNotFound'
    return
  }

  const position = resolveAnchorPosition(anchor)
  if (!position) {
    dynamicPoiErrorKey.value = 'features.dynamicPoiCrud.anchorNoPosition'
    return
  }

  let poi
  try {
    poi = venue.createPOI({ id })
  } catch (error) {
    // POIAlreadyExistsError (see Venue/Errors/POIAlreadyExistsError in the
    // SDK typings) — a normal outcome for a duplicate ID, not a crash.
    console.warn('createPOI failed:', error)
    dynamicPoiErrorKey.value = 'features.dynamicPoiCrud.alreadyExists'
    return
  }

  const text = labelText.value.trim() || id
  const label = venue.createLabel({ poi, position, width: DEFAULT_LABEL_WIDTH, text })

  trackedPoi = poi
  trackedLabel = label
  trackedPoiId.value = poi.id
  trackedLabelText.value = label.text
}

function updateDynamicPoiText() {
  const venue = venueRef.value
  if (!venue || !trackedLabel) return

  const text = labelText.value.trim() || trackedPoiId.value
  venue.updateLabel(trackedLabel, { text })
  trackedLabelText.value = text
}

function removeDynamicPoi() {
  const venue = venueRef.value
  if (!venue || !trackedPoi) return

  // Cascades: the attached Label is removed from the view too, no separate
  // removeLabel call needed.
  venue.removePOI(trackedPoi)
  trackedPoi = null
  trackedLabel = null
  trackedPoiId.value = ''
  trackedLabelText.value = ''
  dynamicPoiErrorKey.value = ''
}

// Runtime locale: venue.currentLocale (readonly) reflects the venue's
// currently displayed language for POI/label text and the current UI/
// Navigation; venue.setCurrentLocale(locale) changes it and returns a
// Promise — per its own TSDoc the SDK re-renders everything itself once it
// resolves, so there is nothing to manually re-fetch here. `currentLocale`
// isn't a Vue ref on the SDK side, so its value is mirrored into
// `currentLocaleId` on load (initRuntimeLocale, called from handleReady) and
// after every switch, same split as trackedPoiId/highlightedPoi above. See
// docs/features/runtime-locale.md.
//
// This demo only offers the two locales below, not the full
// venue.translator.allLocales list: on the shared demo map that list is
// ['default', 'en', 'fr'], and 'default' is a byte-identical duplicate of
// 'fr' (both French) — confirmed against the published map payload — so
// presenting it as a third option would just be a second, indistinguishable
// "French".
const RUNTIME_LOCALES = ['en', 'fr']
const currentLocaleId = ref(null)
const switchingLocale = ref(false)

function initRuntimeLocale() {
  const venue = venueRef.value
  if (!venue) return
  currentLocaleId.value = venue.currentLocale
}

// 'default' == 'fr' content-wise on this demo map (see above) — treated as
// "fr is active" here so the panel still highlights a choice on first load
// instead of leaving both options unmarked.
const activeLocaleId = computed(() => (currentLocaleId.value === 'default' ? 'fr' : currentLocaleId.value))

async function selectLocale(localeId) {
  const venue = venueRef.value
  if (!venue || switchingLocale.value || localeId === activeLocaleId.value) return
  switchingLocale.value = true
  try {
    await venue.setCurrentLocale(localeId)
    currentLocaleId.value = venue.currentLocale
  } finally {
    switchingLocale.value = false
  }
}

// Native UI replacement: reuses floor-selector's own native picker
// (buildings/floors/selectedBuildingId/currentFloorId/selectBuilding/
// selectFloor/initFloorSelector above — same functions, not a copy) as the
// app's white-label replacement for the SDK's own floor-selector widget.
// view.setUIPartVisible('floorSelector', false) hides that SDK widget on
// load — the app's native picker is the only floor control visible/
// functional by default. The toggle below flips the SDK widget back on
// (default OFF) purely so a visitor can see both driving the same floor
// state live; it never affects the app's own picker, which stays wired to
// view.goToFloor()/view.goToBuilding() regardless of this toggle. See
// docs/features/native-ui-replacement.md.
const sdkFloorSelectorVisible = ref(false)

function initNativeUiReplacement() {
  const view = viewRef.value
  if (!view) return
  initFloorSelector()
  view.setUIPartVisible('floorSelector', sdkFloorSelectorVisible.value)
}

function toggleSdkFloorSelector() {
  const view = viewRef.value
  if (!view) return
  sdkFloorSelectorVisible.value = !sdkFloorSelectorVisible.value
  view.setUIPartVisible('floorSelector', sdkFloorSelectorVisible.value)
}

// Add locale: venue.translator.addLocale(locale, resources) registers a
// brand-new locale at runtime — one never authored for this map in
// VisioMapEditor — backed by a generic i18next resource bundle that is
// entirely separate from the venue's own POI/floor/building/category
// translation data (parsed once at load from the published map's own JSON,
// exposed via translatePOI/translateFloor/etc.). It can therefore never make
// a POI/label name appear translated; it only affects (a) the SDK's own
// predefined UI/Navigation strings, if a key from that list is included, and
// (b) any other, app-defined key — a fully generic key/value store. See
// docs/features/add-locale.md.
//
// One predefined SDK UI key ('search-for-anything') plus one custom,
// app-only key ('welcome-message', meaningless to the SDK itself) are added
// together to demonstrate both uses in the same call.
const ADD_LOCALE_ID = 'es'
const ADD_LOCALE_RESOURCES = {
  'search-for-anything': 'Buscar cualquier cosa',
  'welcome-message': 'Bienvenido al mapa',
}
const ADD_LOCALE_KEYS = Object.keys(ADD_LOCALE_RESOURCES)

const localeAdded = ref(false)
// key -> value read back via translator.translate() right after addLocale —
// this readback, not the SDK's own visible UI, is the primary proof the
// round trip worked.
const addLocaleTranslations = ref({})
const switchingToSpanish = ref(false)
const switchedToSpanish = ref(false)

function addSpanishLocale() {
  const venue = venueRef.value
  if (!venue || localeAdded.value) return

  venue.translator.addLocale(ADD_LOCALE_ID, ADD_LOCALE_RESOURCES)
  addLocaleTranslations.value = Object.fromEntries(
    ADD_LOCALE_KEYS.map((key) => [key, venue.translator.translate(key, ADD_LOCALE_ID)]),
  )
  localeAdded.value = true
}

// Secondary, optional proof: reuses runtime-locale's exact
// venue.setCurrentLocale() call so that, if any of the SDK's own default UI
// parts are visible, they pick up the newly-added 'es' strings live too. POI/
// label names would NOT change — this map only has default/en/fr authored,
// see docs/features/runtime-locale.md.
async function switchToSpanish() {
  const venue = venueRef.value
  if (!venue || !localeAdded.value || switchingToSpanish.value) return
  switchingToSpanish.value = true
  try {
    await venue.setCurrentLocale(ADD_LOCALE_ID)
    switchedToSpanish.value = true
  } finally {
    switchingToSpanish.value = false
  }
}
</script>

<template>
  <main class="feature">
    <VisioOneMap
      :hash="mapHash"
      :base-url="visioOneBaseURL"
      :authorization-token="visioOneAuthToken"
      @ready="handleReady"
      @error="handleError"
      @poi-click="handlePOIClick"
    />

    <div class="top-bar">
      <router-link to="/" class="back-link">&larr; {{ t('home.back') }}</router-link>
      <span v-if="currentFeature" class="top-bar__title">{{ t(currentFeature.titleKey) }}</span>
    </div>

    <div
      v-if="props.slug === 'poi-click' && !controlsOpen && clickedPois.length === 0"
      class="poi-hint"
    >
      {{ t('features.poiClick.hint') }}
    </div>

    <button
      v-if="
        (props.slug === 'reset-view' && viewRef) ||
        props.slug === 'occupancy-simulated' ||
        props.slug === 'goto-poi' ||
        props.slug === 'floor-selector' ||
        props.slug === 'explore-mode' ||
        props.slug === 'compute-navigation' ||
        props.slug === 'ui-part-visibility' ||
        props.slug === 'simulated-position' ||
        props.slug === 'camera-lock-on-position' ||
        props.slug === 'clickable-surface' ||
        props.slug === 'custom-data' ||
        props.slug === 'category-highlight' ||
        props.slug === 'dynamic-poi-crud' ||
        props.slug === 'runtime-locale' ||
        props.slug === 'native-ui-replacement' ||
        props.slug === 'add-locale'
      "
      class="fab"
      :aria-label="t('home.openControls')"
      @click="controlsOpen = true"
    >
      ⚙
    </button>

    <BottomSheet :visible="controlsOpen" @close="controlsOpen = false">
      <button v-if="props.slug === 'reset-view'" class="reset-view-button" @click="resetView">
        {{ t('features.resetView.title') }}
      </button>

      <div v-else-if="props.slug === 'occupancy-simulated'" class="occupancy-panel">
        <input
          v-model="placeId"
          class="occupancy-panel__input"
          :placeholder="t('features.occupancySimulated.placeholder')"
        />
        <button class="occupancy-panel__button" @click="toggleOccupancySimulation">
          {{ simulatingOccupancy ? t('features.occupancySimulated.stop') : t('features.occupancySimulated.start') }}
        </button>
      </div>

      <div v-else-if="props.slug === 'poi-click'" class="poi-panel">
        <h2 class="poi-panel__title">{{ t('features.poiClick.panelTitle') }}</h2>
        <div v-for="poi in clickedPois" :key="poi.id" class="poi-panel__entry">
          <div class="poi-panel__name">{{ poiName(poi) }}</div>
          <div class="poi-panel__meta">{{ t('features.poiClick.idLabel') }}: {{ poi.id }}</div>
          <div v-if="poi.floor" class="poi-panel__meta">
            {{ t('features.poiClick.floorLabel') }}: {{ poi.floor.id }}
          </div>
          <div v-if="poi.categories?.length" class="poi-panel__meta">
            {{ t('features.poiClick.categoriesLabel') }}: {{ poiCategories(poi) }}
          </div>
        </div>
      </div>

      <div v-else-if="props.slug === 'goto-poi'" class="goto-poi-panel">
        <input
          v-model="goToPoiId"
          class="goto-poi-panel__input"
          :placeholder="t('features.gotoPoi.placeholder')"
          @keyup.enter="goToPoi"
        />
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button" @click="goToPoi">
            {{ t('features.gotoPoi.go') }}
          </button>
          <button class="goto-poi-panel__button goto-poi-panel__button--secondary" @click="clearGoToPoi">
            {{ t('features.gotoPoi.clear') }}
          </button>
        </div>
        <div v-if="goToPoiNotFound" class="goto-poi-panel__error">
          {{ t('features.gotoPoi.notFound') }}
        </div>
      </div>

      <div v-else-if="props.slug === 'floor-selector'" class="floor-panel">
        <h2 class="floor-panel__title">{{ t('features.floorSelector.panelTitle') }}</h2>

        <div v-if="buildings.length > 1" class="floor-panel__buildings">
          <span class="floor-panel__buildings-label">{{ t('features.floorSelector.buildingLabel') }}</span>
          <button
            v-for="building in buildings"
            :key="building.id"
            class="floor-panel__building-button"
            :class="{ 'floor-panel__building-button--active': building.id === selectedBuildingId }"
            @click="selectBuilding(building)"
          >
            {{ building.id }}
          </button>
        </div>

        <div class="floor-panel__floors">
          <button
            v-for="floor in floorsForSelectedBuilding"
            :key="floor.id"
            class="floor-panel__floor-button"
            :class="{ 'floor-panel__floor-button--active': floor.id === currentFloorId }"
            @click="selectFloor(floor)"
          >
            <span class="floor-panel__floor-id">{{ floor.id }}</span>
            <span v-if="floor.id === currentFloorId" class="floor-panel__floor-badge">
              {{ t('features.floorSelector.currentBadge') }}
            </span>
          </button>
        </div>
      </div>

      <div v-else-if="props.slug === 'explore-mode'" class="explore-mode-panel">
        <h2 class="explore-mode-panel__title">{{ t('features.exploreMode.panelTitle') }}</h2>
        <div class="explore-mode-panel__segmented">
          <button
            v-for="mode in EXPLORE_MODES"
            :key="mode"
            type="button"
            class="explore-mode-panel__option"
            :class="{ 'explore-mode-panel__option--active': mode === currentExploreMode }"
            @click="selectExploreMode(mode)"
          >
            {{ t(`features.exploreMode.modes.${mode}`) }}
          </button>
        </div>
      </div>

      <div v-else-if="props.slug === 'compute-navigation'" class="itinerary-panel">
        <h2 class="itinerary-panel__title">{{ t('features.computeNavigation.panelTitle') }}</h2>
        <input
          v-model="itineraryOriginId"
          class="itinerary-panel__input"
          :placeholder="t('features.computeNavigation.fromPlaceholder')"
        />
        <input
          v-model="itineraryDestinationId"
          class="itinerary-panel__input"
          :placeholder="t('features.computeNavigation.toPlaceholder')"
          @keyup.enter="computeItinerary"
        />
        <div class="itinerary-panel__actions">
          <button class="itinerary-panel__button" @click="computeItinerary">
            {{ t('features.computeNavigation.go') }}
          </button>
          <button class="itinerary-panel__button itinerary-panel__button--secondary" @click="clearItineraryFields">
            {{ t('features.computeNavigation.clear') }}
          </button>
        </div>
        <div v-if="itineraryError" class="itinerary-panel__error">
          {{ itineraryError }}
        </div>
      </div>

      <div v-else-if="props.slug === 'ui-part-visibility'" class="ui-part-panel">
        <h2 class="ui-part-panel__title">{{ t('features.uiPartVisibility.panelTitle') }}</h2>
        <label v-for="part in UI_PARTS" :key="part" class="ui-part-panel__row">
          <span class="ui-part-panel__label">{{ t(`features.uiPartVisibility.parts.${part}`) }}</span>
          <input
            type="checkbox"
            class="ui-part-panel__switch"
            :checked="uiPartVisibility[part]"
            @change="toggleUIPart(part)"
          />
        </label>
      </div>

      <div v-else-if="props.slug === 'simulated-position'" class="position-panel">
        <h2 class="position-panel__title">{{ t('features.simulatedPosition.panelTitle') }}</h2>
        <input
          v-model="originPoiId"
          class="position-panel__input"
          :placeholder="t('features.simulatedPosition.fromPlaceholder')"
        />
        <input
          v-model="destinationPoiId"
          class="position-panel__input"
          :placeholder="t('features.simulatedPosition.toPlaceholder')"
        />
        <label class="position-panel__radius">
          <span>{{ t('features.simulatedPosition.radiusLabel') }}: {{ accuracyRadius }} m</span>
          <input
            v-model.number="accuracyRadius"
            type="range"
            min="1"
            max="20"
            step="1"
            class="position-panel__slider"
          />
        </label>
        <button class="position-panel__button" @click="toggleSimulatedPosition">
          {{ simulatingPosition ? t('features.simulatedPosition.stop') : t('features.simulatedPosition.start') }}
        </button>
        <div v-if="positionError" class="position-panel__error">
          {{ positionError }}
        </div>
      </div>

      <div v-else-if="props.slug === 'camera-lock-on-position'" class="position-panel">
        <h2 class="position-panel__title">{{ t('features.cameraLockOnPosition.panelTitle') }}</h2>
        <input
          v-model="originPoiId"
          class="position-panel__input"
          :placeholder="t('features.simulatedPosition.fromPlaceholder')"
        />
        <input
          v-model="destinationPoiId"
          class="position-panel__input"
          :placeholder="t('features.simulatedPosition.toPlaceholder')"
        />
        <label class="position-panel__radius">
          <span>{{ t('features.simulatedPosition.radiusLabel') }}: {{ accuracyRadius }} m</span>
          <input
            v-model.number="accuracyRadius"
            type="range"
            min="1"
            max="20"
            step="1"
            class="position-panel__slider"
          />
        </label>
        <button class="position-panel__button" @click="toggleSimulatedPosition">
          {{ simulatingPosition ? t('features.simulatedPosition.stop') : t('features.simulatedPosition.start') }}
        </button>
        <div v-if="positionError" class="position-panel__error">
          {{ positionError }}
        </div>
        <label
          class="ui-part-panel__row camera-lock-panel__row"
          :class="{ 'camera-lock-panel__row--disabled': !simulatingPosition }"
        >
          <span class="ui-part-panel__label">{{ t('features.cameraLockOnPosition.toggleLabel') }}</span>
          <input
            type="checkbox"
            class="ui-part-panel__switch"
            :checked="lockCameraOnPosition"
            :disabled="!simulatingPosition"
            @change="toggleCameraLock"
          />
        </label>
      </div>

      <div v-else-if="props.slug === 'clickable-surface'" class="goto-poi-panel">
        <input
          v-model="clickableSurfacePlaceId"
          class="goto-poi-panel__input"
          :placeholder="t('features.clickableSurface.placeholder')"
          @keyup.enter="enableClickableSurface"
        />
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button" @click="enableClickableSurface">
            {{ t('features.clickableSurface.enable') }}
          </button>
          <button class="goto-poi-panel__button goto-poi-panel__button--secondary" @click="disableClickableSurface">
            {{ t('features.clickableSurface.disable') }}
          </button>
        </div>
        <div v-if="clickableSurfaceNotFound" class="goto-poi-panel__error">
          {{ t('features.clickableSurface.notFound') }}
        </div>
      </div>

      <div v-else-if="props.slug === 'custom-data'" class="goto-poi-panel">
        <div class="custom-data-panel__samples">
          <span class="custom-data-panel__samples-label">{{ t('features.customData.samplesLabel') }}</span>
          <button
            v-for="sampleId in CUSTOM_DATA_SAMPLE_POI_IDS"
            :key="sampleId"
            type="button"
            class="custom-data-panel__chip"
            :disabled="customDataLoading"
            @click="loadCustomDataSample(sampleId)"
          >
            {{ sampleId }}
          </button>
        </div>
        <input
          v-model="customDataPlaceId"
          class="goto-poi-panel__input"
          :placeholder="t('features.customData.placeholder')"
          @keyup.enter="loadCustomData"
        />
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button" :disabled="customDataLoading" @click="loadCustomData">
            {{ customDataLoading ? t('features.customData.loading') : t('features.customData.load') }}
          </button>
          <button class="goto-poi-panel__button goto-poi-panel__button--secondary" @click="clearCustomData">
            {{ t('features.customData.clear') }}
          </button>
        </div>
        <div v-if="customDataNotFound" class="goto-poi-panel__error">
          {{ t('features.customData.notFound') }}
        </div>
        <div v-else-if="customDataEntries && customDataEntries.length === 0" class="custom-data-panel__empty">
          {{ t('features.customData.empty') }}
        </div>
        <div v-else-if="customDataEntries" class="custom-data-panel__list">
          <div v-for="[key, value] in customDataEntries" :key="key" class="custom-data-panel__entry">
            <span class="custom-data-panel__key">{{ key }}</span>
            <span class="custom-data-panel__value">{{ value }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="props.slug === 'category-highlight'" class="category-panel">
        <h2 class="category-panel__title">{{ t('features.categoryHighlight.panelTitle') }}</h2>
        <div v-if="categories.length === 0" class="category-panel__empty">
          {{ t('features.categoryHighlight.empty') }}
        </div>
        <div v-else class="category-panel__chips">
          <button
            v-for="category in categories"
            :key="category.id"
            type="button"
            class="category-panel__chip"
            :class="{ 'category-panel__chip--active': category.id === selectedCategoryId }"
            @click="selectCategory(category)"
          >
            {{ category.label }}
          </button>
        </div>
        <button
          class="goto-poi-panel__button goto-poi-panel__button--secondary category-panel__clear"
          :disabled="!selectedCategoryId"
          @click="clearCategoryHighlight"
        >
          {{ t('features.categoryHighlight.clear') }}
        </button>
      </div>

      <div v-else-if="props.slug === 'dynamic-poi-crud'" class="goto-poi-panel">
        <h2 class="poi-panel__title">{{ t('features.dynamicPoiCrud.panelTitle') }}</h2>
        <input
          v-model="newPoiId"
          class="goto-poi-panel__input"
          :disabled="!!trackedPoiId"
          :placeholder="t('features.dynamicPoiCrud.newIdPlaceholder')"
        />
        <input
          v-model="anchorPoiId"
          class="goto-poi-panel__input"
          :disabled="!!trackedPoiId"
          :placeholder="t('features.dynamicPoiCrud.anchorIdPlaceholder')"
        />
        <input
          v-model="labelText"
          class="goto-poi-panel__input"
          :placeholder="t('features.dynamicPoiCrud.textPlaceholder')"
          @keyup.enter="trackedPoiId ? updateDynamicPoiText() : createDynamicPoi()"
        />
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button" :disabled="!!trackedPoiId" @click="createDynamicPoi">
            {{ t('features.dynamicPoiCrud.create') }}
          </button>
          <button class="goto-poi-panel__button" :disabled="!trackedPoiId" @click="updateDynamicPoiText">
            {{ t('features.dynamicPoiCrud.updateText') }}
          </button>
          <button
            class="goto-poi-panel__button goto-poi-panel__button--secondary"
            :disabled="!trackedPoiId"
            @click="removeDynamicPoi"
          >
            {{ t('features.dynamicPoiCrud.remove') }}
          </button>
        </div>
        <div v-if="dynamicPoiErrorKey" class="goto-poi-panel__error">
          {{ t(dynamicPoiErrorKey) }}
        </div>
        <div v-else-if="trackedPoiId" class="poi-panel__entry dynamic-poi-panel__status">
          {{ t('features.dynamicPoiCrud.createdLabel') }}: <strong>{{ trackedPoiId }}</strong> — "{{ trackedLabelText }}"
        </div>
        <div v-else class="custom-data-panel__empty">
          {{ t('features.dynamicPoiCrud.none') }}
        </div>
      </div>

      <div v-else-if="props.slug === 'runtime-locale'" class="floor-panel">
        <h2 class="floor-panel__title">{{ t('features.runtimeLocale.panelTitle') }}</h2>
        <div class="floor-panel__floors">
          <button
            v-for="locale in RUNTIME_LOCALES"
            :key="locale"
            type="button"
            class="floor-panel__floor-button"
            :class="{ 'floor-panel__floor-button--active': locale === activeLocaleId }"
            :disabled="switchingLocale"
            @click="selectLocale(locale)"
          >
            <span class="floor-panel__floor-id">{{ t(`features.runtimeLocale.locales.${locale}`) }}</span>
            <span v-if="locale === activeLocaleId" class="floor-panel__floor-badge">
              {{ t('features.runtimeLocale.currentBadge') }}
            </span>
          </button>
        </div>
      </div>

      <div v-else-if="props.slug === 'native-ui-replacement'" class="floor-panel">
        <h2 class="floor-panel__title">{{ t('features.nativeUiReplacement.panelTitle') }}</h2>

        <div v-if="buildings.length > 1" class="floor-panel__buildings">
          <span class="floor-panel__buildings-label">{{ t('features.floorSelector.buildingLabel') }}</span>
          <button
            v-for="building in buildings"
            :key="building.id"
            class="floor-panel__building-button"
            :class="{ 'floor-panel__building-button--active': building.id === selectedBuildingId }"
            @click="selectBuilding(building)"
          >
            {{ building.id }}
          </button>
        </div>

        <div class="floor-panel__floors">
          <button
            v-for="floor in floorsForSelectedBuilding"
            :key="floor.id"
            class="floor-panel__floor-button"
            :class="{ 'floor-panel__floor-button--active': floor.id === currentFloorId }"
            @click="selectFloor(floor)"
          >
            <span class="floor-panel__floor-id">{{ floor.id }}</span>
            <span v-if="floor.id === currentFloorId" class="floor-panel__floor-badge">
              {{ t('features.floorSelector.currentBadge') }}
            </span>
          </button>
        </div>

        <label class="ui-part-panel__row camera-lock-panel__row">
          <span class="ui-part-panel__label">{{ t('features.nativeUiReplacement.toggleLabel') }}</span>
          <input
            type="checkbox"
            class="ui-part-panel__switch"
            :checked="sdkFloorSelectorVisible"
            @change="toggleSdkFloorSelector"
          />
        </label>
      </div>

      <div v-else-if="props.slug === 'add-locale'" class="add-locale-panel">
        <h2 class="floor-panel__title">{{ t('features.addLocale.panelTitle') }}</h2>
        <div class="custom-data-panel__list">
          <div v-for="key in ADD_LOCALE_KEYS" :key="key" class="custom-data-panel__entry">
            <span class="custom-data-panel__key">{{ key }}</span>
            <span class="custom-data-panel__value">
              {{ localeAdded ? addLocaleTranslations[key] : t('features.addLocale.notAddedYet') }}
            </span>
          </div>
        </div>
        <div class="goto-poi-panel__actions add-locale-panel__actions">
          <button class="goto-poi-panel__button" :disabled="localeAdded" @click="addSpanishLocale">
            {{ t('features.addLocale.addButton') }}
          </button>
          <button
            class="goto-poi-panel__button goto-poi-panel__button--secondary"
            :disabled="!localeAdded || switchingToSpanish"
            @click="switchToSpanish"
          >
            {{ switchedToSpanish ? t('features.addLocale.switchedButton') : t('features.addLocale.switchButton') }}
          </button>
        </div>
      </div>
    </BottomSheet>
  </main>
</template>

<style scoped>
.feature {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.top-bar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
}

.back-link {
  border-radius: 6px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.top-bar__title {
  border-radius: 6px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poi-hint {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 20px;
  margin: 0 auto;
  max-width: 320px;
  border-radius: 6px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  text-align: center;
  z-index: 10;
}

.fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: #057dbc;
  color: #fff;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  z-index: 15;
}

.occupancy-panel {
  display: flex;
  gap: 8px;
}

.occupancy-panel__input {
  flex: 1;
  border-radius: 6px;
  border: none;
  padding: 8px 10px;
  background: #222;
  color: #fff;
}

.occupancy-panel__button {
  border-radius: 6px;
  border: none;
  padding: 8px 14px;
  background: #057dbc;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.reset-view-button {
  width: 100%;
  border-radius: 6px;
  border: none;
  padding: 8px 14px;
  background: #057dbc;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.poi-panel__title {
  margin: 0 0 12px;
  font-size: 1.1em;
}

.poi-panel__entry {
  border-radius: 6px;
  padding: 10px 12px;
  background: #222;
  margin-bottom: 8px;
}

.poi-panel__entry:last-child {
  margin-bottom: 0;
}

.poi-panel__name {
  font-weight: 600;
  margin-bottom: 4px;
}

.poi-panel__meta {
  font-size: 0.9em;
  opacity: 0.8;
}

.goto-poi-panel__input {
  width: 100%;
  box-sizing: border-box;
  border-radius: 6px;
  border: none;
  padding: 8px 10px;
  background: #222;
  color: #fff;
  margin-bottom: 10px;
}

.goto-poi-panel__actions {
  display: flex;
  gap: 8px;
}

.goto-poi-panel__button {
  flex: 1;
  border-radius: 6px;
  border: none;
  padding: 8px 14px;
  background: #057dbc;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.goto-poi-panel__button--secondary {
  background: #333;
}

.goto-poi-panel__error {
  margin-top: 10px;
  font-size: 0.9em;
  color: #ff6b6b;
}

.goto-poi-panel__button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.custom-data-panel__samples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.custom-data-panel__samples-label {
  font-size: 0.85em;
  opacity: 0.7;
  margin-right: 2px;
}

.custom-data-panel__chip {
  border-radius: 999px;
  border: 1px solid #057dbc;
  padding: 4px 10px;
  background: transparent;
  color: #fff;
  font-size: 0.85em;
  cursor: pointer;
}

.custom-data-panel__chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.custom-data-panel__empty {
  margin-top: 10px;
  font-size: 0.9em;
  opacity: 0.8;
}

.custom-data-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  max-height: 40vh;
  overflow-y: auto;
}

.custom-data-panel__entry {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  border-radius: 6px;
  padding: 8px 12px;
  background: #222;
}

.custom-data-panel__key {
  font-weight: 600;
  opacity: 0.8;
}

.custom-data-panel__value {
  text-align: right;
  overflow-wrap: anywhere;
}

.floor-panel__title {
  margin: 0 0 12px;
  font-size: 1.1em;
}

.floor-panel__buildings {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.floor-panel__buildings-label {
  font-size: 0.85em;
  opacity: 0.7;
  margin-right: 4px;
}

.floor-panel__building-button {
  border-radius: 6px;
  border: none;
  padding: 6px 12px;
  background: #333;
  color: #fff;
  cursor: pointer;
}

.floor-panel__building-button--active {
  background: #057dbc;
  font-weight: 600;
}

.floor-panel__floors {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 40vh;
  overflow-y: auto;
}

.floor-panel__floor-button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 6px;
  border: none;
  padding: 10px 14px;
  background: #222;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

.floor-panel__floor-button--active {
  background: #057dbc;
}

.floor-panel__floor-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.floor-panel__floor-badge {
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.85;
}

.explore-mode-panel__title {
  margin: 0 0 12px;
  font-size: 1.1em;
}

.explore-mode-panel__segmented {
  display: flex;
  gap: 8px;
}

.explore-mode-panel__option {
  flex: 1;
  border-radius: 6px;
  border: none;
  padding: 12px 10px;
  background: #222;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.explore-mode-panel__option--active {
  background: #057dbc;
}

.itinerary-panel__title {
  margin: 0 0 12px;
  font-size: 1.1em;
}

.itinerary-panel__input {
  width: 100%;
  box-sizing: border-box;
  border-radius: 6px;
  border: none;
  padding: 8px 10px;
  background: #222;
  color: #fff;
  margin-bottom: 10px;
}

.itinerary-panel__actions {
  display: flex;
  gap: 8px;
}

.itinerary-panel__button {
  flex: 1;
  border-radius: 6px;
  border: none;
  padding: 8px 14px;
  background: #057dbc;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.itinerary-panel__button--secondary {
  background: #333;
}

.itinerary-panel__error {
  margin-top: 10px;
  font-size: 0.9em;
  color: #ff6b6b;
}

.ui-part-panel__title {
  margin: 0 0 12px;
  font-size: 1.1em;
}

.ui-part-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 6px;
  padding: 10px 12px;
  background: #222;
  margin-bottom: 8px;
  cursor: pointer;
}

.ui-part-panel__row:last-child {
  margin-bottom: 0;
}

.ui-part-panel__label {
  font-weight: 600;
}

.ui-part-panel__switch {
  appearance: none;
  position: relative;
  flex-shrink: 0;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: #444;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.ui-part-panel__switch::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s ease;
}

.ui-part-panel__switch:checked {
  background: #057dbc;
}

.ui-part-panel__switch:checked::before {
  transform: translateX(20px);
}

.position-panel__title {
  margin: 0 0 12px;
  font-size: 1.1em;
}

.position-panel__input {
  width: 100%;
  box-sizing: border-box;
  border-radius: 6px;
  border: none;
  padding: 8px 10px;
  background: #222;
  color: #fff;
  margin-bottom: 10px;
}

.position-panel__radius {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 0.9em;
}

.position-panel__slider {
  width: 100%;
}

.position-panel__button {
  width: 100%;
  border-radius: 6px;
  border: none;
  padding: 8px 14px;
  background: #057dbc;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.position-panel__error {
  margin-top: 10px;
  font-size: 0.9em;
  color: #ff6b6b;
}

.camera-lock-panel__row {
  margin-top: 14px;
}

.camera-lock-panel__row--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-part-panel__switch:disabled {
  cursor: not-allowed;
}

.category-panel__title {
  margin: 0 0 12px;
  font-size: 1.1em;
}

.category-panel__empty {
  font-size: 0.9em;
  opacity: 0.8;
}

.category-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 40vh;
  overflow-y: auto;
  margin-bottom: 14px;
}

.category-panel__chip {
  border-radius: 999px;
  border: 1px solid #057dbc;
  padding: 6px 14px;
  background: transparent;
  color: #fff;
  font-size: 0.9em;
  cursor: pointer;
}

.category-panel__chip--active {
  background: #ff6b00;
  border-color: #ff6b00;
  font-weight: 600;
}

.category-panel__clear {
  width: 100%;
}

.add-locale-panel__actions {
  margin-top: 14px;
}
</style>
