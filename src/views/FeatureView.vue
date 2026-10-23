<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BottomSheet from '../components/BottomSheet.vue'
import ColorSwatches from '../components/ColorSwatches.vue'
import RouteFields from '../components/RouteFields.vue'
import VisioOneMap from '../components/VisioOneMap.vue'
import { PALETTE } from '../colors'
import {
  ACCESSIBLE_FROM,
  ACCESSIBLE_TO,
  ANCHOR_POI_ID,
  CAROUSEL_STOP_IDS,
  CLICKABLE_SURFACE_POI_ID,
  CUSTOM_DATA_MAP_HASH,
  CUSTOM_DATA_POI_ID,
  CUSTOM_DATA_SAMPLE_POI_IDS,
  EXCLUDE_MODALITIES_FROM,
  EXCLUDE_MODALITIES_TO,
  GEOFENCE_ZONE_ID,
  GOTO_POI_ID,
  ITINERARY_FROM,
  ITINERARY_TO,
  NEW_POI_ID,
  OCCUPANCY_POI_ID,
  TRACKING_FROM,
  TRACKING_TO,
} from '../demoMap'
import { features } from '../features'
import { findPoi, poiDisplayPosition } from '../sdk/pois'

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
// Every other slug uses visioOneHash. CUSTOM_DATA_MAP_HASH is in demoMap.js.
const mapHash = computed(() => (props.slug === 'custom-data' ? CUSTOM_DATA_MAP_HASH : visioOneHash))

// custom-base-url: LoadOptions.baseURL is only read once, inside
// VisioOneMap's onMounted -- it cannot be changed on an already-loaded
// venue/view. So "Reload" here doesn't call any SDK setter; it changes
// `appliedBaseURL`, which is bound to VisioOneMap's :key, forcing Vue to
// fully unmount (teardown: destroyView + unloadVenue) and remount
// (loadVenue + createView again) with the new value. See
// docs/features/custom-base-url.md.
const CUSTOM_BASE_URL_DEFAULT = 'https://mapserver.visioglobe.com/'
const baseURLInput = ref(visioOneBaseURL || CUSTOM_BASE_URL_DEFAULT)
const appliedBaseURL = ref(baseURLInput.value)
// Bumped on every Reload so the map remounts even when the URL is unchanged.
const baseURLReloadCount = ref(0)
const baseURLError = ref(null)

const effectiveBaseURL = computed(() =>
  props.slug === 'custom-base-url' ? appliedBaseURL.value : visioOneBaseURL,
)
// custom-theme: view.setTheme() only changes the 3D scene lights, which are
// only rendered when the view is created with enableShadows: true — without
// it every theme is pixel-identical. Shadows are expensive, so only this
// screen opts in; every other screen keeps the SDK's default view options.
// See docs/features/custom-theme.md.
//
// camera-projection-toggle: cameraProjection is a createView() option only
// (view.cameraProjection is read-only, there is no runtime setter). And
// destroyView + createView on the SAME venue fails in SDK 1.1.0 ("Cannot
// fetch model", createView never resolves). So switching projection binds
// the requested value to VisioOneMap's :key: Vue unmounts it (destroyView +
// unloadVenue) and remounts it (fresh loadVenue + createView with the new
// cameraProjection). See docs/features/camera-projection-toggle.md.
const CAMERA_PROJECTIONS = ['perspective', 'orthographic']
const requestedProjection = ref('perspective')
const reportedProjection = ref(null)
const projectionReloading = ref(true)

const mapViewOptions = computed(() => {
  if (props.slug === 'custom-theme') return { enableShadows: true }
  if (props.slug === 'camera-projection-toggle') return { cameraProjection: requestedProjection.value }
  return {}
})

const mapKey = computed(() => {
  if (props.slug === 'custom-base-url') return `${appliedBaseURL.value}#${baseURLReloadCount.value}`
  if (props.slug === 'camera-projection-toggle') return requestedProjection.value
  return 'default'
})

function selectProjection(projection) {
  if (projectionReloading.value || projection === reportedProjection.value) return
  projectionReloading.value = true
  // The old view/venue are being torn down: drop every reference to them so
  // nothing keeps calling into a destroyed view until the new one is ready.
  viewRef.value = null
  venueRef.value = null
  requestedProjection.value = projection
}

function reloadWithBaseURL() {
  baseURLError.value = null
  // Same as selectProjection: the old view/venue are being torn down, so drop
  // every reference to them until the new map emits 'ready'.
  viewRef.value = null
  venueRef.value = null
  appliedBaseURL.value = baseURLInput.value.trim()
  baseURLReloadCount.value += 1
}

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
  if (props.slug === 'custom-base-url') baseURLError.value = null
  if (props.slug === 'floor-selector') initFloorSelector()
  if (props.slug === 'explore-mode') initExploreMode()
  if (props.slug === 'runtime-locale') initRuntimeLocale()
  if (props.slug === 'native-ui-replacement') initNativeUiReplacement()
  if (props.slug === 'custom-theme') initCustomTheme()
  if (props.slug === 'camera-projection-toggle') {
    // Mirror what the SDK actually created, not what was requested.
    reportedProjection.value = view.cameraProjection
    projectionReloading.value = false
  }
  // Subscribed on every screen (cheap, and the SDK fires these on any
  // tracking screen) so the camera-lock toggle always mirrors the SDK state.
  for (const type of CAMERA_LOCK_EVENTS) view.addEventListener(type, syncCameraLock)
  syncCameraLock()
}

function resetView() {
  viewRef.value?.goToGlobal()
}

function handleError(error) {
  console.error('VisioOne error:', error)
  if (props.slug === 'camera-projection-toggle') projectionReloading.value = false
  if (props.slug === 'custom-base-url') {
    baseURLError.value = error?.message || String(error)
  }
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
  if (props.slug !== 'poi-click') return
  clickedPois.value = event.pois ?? []
  controlsOpen.value = true
}

// Stand-in for a real occupancy sensor feed: cycles a POI's surface through
// these colors on a timer. See docs/features/occupancy-simulated.md.
const OCCUPANCY_COLORS = [PALETTE.free, PALETTE.soonBusy, PALETTE.busy]
const OCCUPANCY_INTERVAL_MS = 2500

const placeId = ref(OCCUPANCY_POI_ID)
const simulatingOccupancy = ref(false)
const occupancyNotFound = ref(false)
let occupancyTimer = null
let occupancyColorIndex = 0
// The place ID actually targeted by the running timer — captured at start,
// deliberately not re-read from `placeId` on stop (see stopOccupancySimulation).
let simulatingPlaceId = null

function updateOccupancy(targetPlaceId, color) {
  const venue = venueRef.value
  if (!venue) return
  const poi = findPoi(venue, targetPlaceId)
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
  occupancyNotFound.value = !findPoi(venueRef.value, targetPlaceId)
  if (occupancyNotFound.value) return

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
    // 'initial' is the SDK's sentinel that restores the surface's own map
    // color (SurfaceUpdateOptions.color); undefined would leave it as is.
    updateOccupancy(simulatingPlaceId, 'initial')
  }
  simulatingPlaceId = null
  simulatingOccupancy.value = false
}

onBeforeUnmount(() => {
  clearInterval(occupancyTimer)
  clearInterval(positionTimer)
  for (const type of CAMERA_LOCK_EVENTS) viewRef.value?.removeEventListener(type, syncCameraLock)
  viewRef.value?.removeEventListener('currentfloorchanged', handleCurrentFloorChanged)
  viewRef.value?.removeEventListener('exploremodechanged', handleExploreModeChanged)
})

// Dedicated Place ID field + Go/Clear buttons — deliberately not wired to
// map-click (that's the poi-click feature's own panel, see handlePOIClick
// above). See docs/features/goto-poi.md for why the two aren't merged.
const goToPoiId = ref(GOTO_POI_ID)
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

  const poi = findPoi(venue, targetId)
  if (!poi) {
    goToPoiNotFound.value = true
    return
  }
  goToPoiNotFound.value = false

  clearGoToPoiHighlight()
  highlightedPoi = poi
  poi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: PALETTE.highlight }))
  focusCameraOnPoi(poi)
}

// Shared camera move: also used by 3d-icon-marker to bring the anchor POI's
// floor into view after placing an image on it.
function focusCameraOnPoi(poi) {
  viewRef.value?.goToPOI(poi, {
    orientation: { pitch: 20 },
    padding: { top: 100, bottom: 100, left: 100, right: 100 },
  })
}

function clearGoToPoiHighlight() {
  if (!highlightedPoi) return
  const venue = venueRef.value
  if (venue) {
    // 'default' restores the view-wide selection color (SurfaceUpdateOptions).
    highlightedPoi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: 'default' }))
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
// NavigationTrace made current on the view. Both POIs are resolved with
// findPoi (no venue.getPOIById in the SDK) so a typo surfaces as an explicit
// "not found" message rather than a silent no-op. See docs/features/compute-navigation.md.
// The From/To fields are shared by 4 screens; each opens prefilled with a
// pair that returns a route on the demo map (see demoMap.js).
const ITINERARY_DEFAULTS = {
  'navigation-exclude-modalities': [EXCLUDE_MODALITIES_FROM, EXCLUDE_MODALITIES_TO],
  'accessible-mode': [ACCESSIBLE_FROM, ACCESSIBLE_TO],
}
const [itineraryDefaultFrom, itineraryDefaultTo] = ITINERARY_DEFAULTS[props.slug] ?? [
  ITINERARY_FROM,
  ITINERARY_TO,
]
const itineraryOriginId = ref(itineraryDefaultFrom)
const itineraryDestinationId = ref(itineraryDefaultTo)
const itineraryError = ref('')
// The NavigationTrace currently displayed, if any — kept outside any ref
// since it's only ever read by clearItinerary/computeItinerary, same pattern
// as highlightedPoi for goto-poi.
let currentNavigationTrace = null

function computeItinerary(navigationOptions = {}) {
  const venue = venueRef.value
  const view = viewRef.value
  if (!venue || !view) return

  const originId = itineraryOriginId.value.trim()
  const destinationId = itineraryDestinationId.value.trim()
  if (!originId || !destinationId) return

  const originPoi = findPoi(venue, originId)
  const destinationPoi = findPoi(venue, destinationId)
  if (!originPoi || !destinationPoi) {
    itineraryError.value = t('features.computeNavigation.notFound')
    return
  }

  clearItinerary()

  try {
    // navigationOptions is {} for compute-navigation and
    // custom-navigation-trace. navigation-exclude-modalities passes
    // excludedAttributes and accessible-mode passes isAccessible, see below.
    const navigation = venue.computeNavigation({
      origin: originPoi,
      destination: destinationPoi,
      ...navigationOptions,
    })
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
  // removeCurrentNavigationTrace() also unregisters the trace from the venue:
  // calling venue.removeNavigationTrace() on it afterwards throws
  // "Cannot remove Navigation as it is unregistered". It throws too when no
  // trace is current, hence the guard.
  if (viewRef.value && currentNavigationTrace) {
    viewRef.value.removeCurrentNavigationTrace()
  }
  currentNavigationTrace = null
  itineraryError.value = ''
}

function clearItineraryFields() {
  clearItinerary()
  itineraryOriginId.value = ''
  itineraryDestinationId.value = ''
}

// custom-navigation-trace: reuses computeItinerary/clearItinerary/
// currentNavigationTrace above (same itinerary fields, same screen just adds
// a style layer) rather than duplicating the itinerary logic. Each preset is
// a full NavigationTraceUpdateOptions applied via venue.updateNavigationTrace()
// -- the SDK has no "reset to default" call, so 'visioglobeBlue' re-states the
// Line defaults documented in the SDK typings (progressColor '#0094F0',
// previewColor '#C5C5C5') as an explicit preset rather than a fake no-op. See
// docs/features/custom-navigation-trace.md.
const TRACE_PRESETS = {
  visioglobeBlue: {
    progressColor: '#0094F0',
    progressOutlineColor: '#FFFFFF',
    progressFutureColor: '#C5C5C5',
    previewColor: '#C5C5C5',
    previewOutlineColor: '#FFFFFF',
  },
  brandRed: {
    progressColor: '#E53935',
    progressOutlineColor: '#FFFFFF',
    progressFutureColor: '#F8C9C7',
    previewColor: '#F8C9C7',
    previewOutlineColor: '#FFFFFF',
  },
  brandGreen: {
    progressColor: '#2E7D32',
    progressOutlineColor: '#FFFFFF',
    progressFutureColor: '#C8E6C9',
    previewColor: '#C8E6C9',
    previewOutlineColor: '#FFFFFF',
  },
  brandPurple: {
    progressColor: '#6A1B9A',
    progressOutlineColor: '#FFFFFF',
    progressFutureColor: '#E1BEE7',
    previewColor: '#E1BEE7',
    previewOutlineColor: '#FFFFFF',
  },
}
// One chip per preset, shown in its progress color.
const TRACE_PRESET_SWATCHES = Object.entries(TRACE_PRESETS).map(([key, preset]) => ({
  key,
  value: preset.progressColor,
}))
const selectedTracePreset = ref('visioglobeBlue')

// venue.updateNavigationTrace() throws internally (TypeError reading
// 'material' on one of the Line adapters -- see docs/features/
// custom-navigation-trace.md) on a route that never crosses into a building,
// even though it still applies every color correctly before throwing. Not
// our bug to fix -- caught here so it doesn't surface as an uncaught Vue
// error, colors are already applied by the time it throws.
function updateTraceStyle(trace, preset) {
  try {
    venueRef.value.updateNavigationTrace(trace, preset)
  } catch (error) {
    console.warn('updateNavigationTrace threw (trace styling still applied):', error)
  }
}

function applyTracePreset(presetKey) {
  selectedTracePreset.value = presetKey
  if (currentNavigationTrace) {
    updateTraceStyle(currentNavigationTrace, TRACE_PRESETS[presetKey])
  }
}

function computeStyledItinerary() {
  computeItinerary()
  if (currentNavigationTrace) {
    updateTraceStyle(currentNavigationTrace, TRACE_PRESETS[selectedTracePreset.value])
  }
}

// navigation-exclude-modalities: reuses the exact same itinerary fields/
// Itinerary/Clear buttons/computeItinerary/clearItinerary as compute-navigation
// above (same idiom as custom-navigation-trace's computeStyledItinerary) —
// the only difference is the NavigationRequest.excludedAttributes passed
// through to venue.computeNavigation(). The SDK's own JSDoc for
// excludedAttributes describes it as e.g. "elevator", but the attribute
// actually tagged on this venue's floor-transition segments is 'lift' (it is
// map data, set in VisioMapEditor). See
// docs/features/navigation-exclude-modalities.md.
//
// The toggle only affects the *next* "Itinerary" press: flipping it does not
// recompute a route already displayed.
const EXCLUDED_ELEVATOR_ATTRIBUTE = 'lift'
const excludeElevator = ref(false)

function toggleExcludeElevator() {
  excludeElevator.value = !excludeElevator.value
}

function computeItineraryExcludingModalities() {
  computeItinerary(excludeElevator.value ? { excludedAttributes: [EXCLUDED_ELEVATOR_ATTRIBUTE] } : {})
}

// accessible-mode: reuses the exact same itinerary fields/Itinerary/Clear
// buttons/computeItinerary/clearItinerary as compute-navigation above (same
// idiom as navigation-exclude-modalities right above) -- the only difference
// is the NavigationRequest.isAccessible flag passed through to
// venue.computeNavigation(). Per the SDK's own JSDoc, isAccessible: true
// makes the routing algorithm only use "accessible" routes: which segments
// count as non-accessible is map data, defined per venue in VisioMapEditor
// (there is no public getter for it). On the demo map, the ACCESSIBLE_FROM ->
// ACCESSIBLE_TO route takes stairs by default and the lift with
// isAccessible: true. See docs/features/accessible-mode.md.
//
// The toggle only affects the *next* "Itinerary" press, same convention as
// excludeElevator above.
const accessibleMode = ref(false)

function toggleAccessibleMode() {
  accessibleMode.value = !accessibleMode.value
}

function computeItineraryAccessible() {
  computeItinerary(accessibleMode.value ? { isAccessible: true } : {})
}

// Selective UI masking: toggles one of the SDK's own default UI overlays via
// view.setUIPartVisible(uiPart, isVisible), called directly on the live
// `view` instance. The 5 UIPart values below are exact and case-sensitive
// (UIPart in the SDK typings, View.d.ts); no others exist. All default to
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
// between two Place IDs, via view.injectTrackedPosition(). A POI has no
// lat/lng field of its own: poiDisplayPosition (src/sdk/pois.js) reads it off
// the POI's label, image, marker or surface. See
// docs/features/simulated-position.md.
const POSITION_INTERVAL_MS = 150
// Fraction of the origin->destination segment advanced per tick (~150ms *
// 1/0.02 ticks = ~7.5s one-way, then back), not a real speed/time model.
const POSITION_STEP = 0.02

const isAccuracyCircleStyle = props.slug === 'accuracy-circle-style'
// The 4 tracking screens open prefilled with the same From/To pair (see
// demoMap.js); accuracy-circle-style uses a slightly larger radius so the
// recolored circle is easy to see.
const originPoiId = ref(TRACKING_FROM)
const destinationPoiId = ref(TRACKING_TO)
const positionError = ref('')
const accuracyRadius = ref(isAccuracyCircleStyle ? 6 : 5)
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

// Returns whether the simulation actually started.
function startSimulatedPosition() {
  const view = viewRef.value
  if (!view) return false

  const originId = originPoiId.value.trim()
  const destinationId = destinationPoiId.value.trim()
  if (!originId || !destinationId) return false

  const origin = poiDisplayPosition(findPoi(venueRef.value, originId))
  const destination = poiDisplayPosition(findPoi(venueRef.value, destinationId))
  if (!origin || !destination) {
    positionError.value = t('features.simulatedPosition.notFound')
    return false
  }
  positionError.value = ''

  positionOrigin = origin
  positionDestination = destination
  positionProgress = 0
  positionDirection = 1

  // Mandatory before the first injectTrackedPosition call, or it throws —
  // see PositionTrackerOptions/View.allowTracking in the SDK typings. Set
  // once per run, never per tick: every `allowTracking = true` also forces
  // lockCameraPositionOnTracking back to true (re-locking the camera).
  if (!view.allowTracking) view.allowTracking = true
  // No-op outside accuracy-circle-style. The SDK resets the precision circle's
  // color+opacity to its defaults whenever tracking stops, so the selected
  // style has to be re-applied on every Start, before the first inject.
  applyPositionTrackerStyle()
  simulatingPosition.value = true
  injectSimulatedPositionTick()
  positionTimer = setInterval(injectSimulatedPositionTick, POSITION_INTERVAL_MS)
  return true
}

function injectSimulatedPositionTick() {
  const view = viewRef.value
  if (!view || !positionOrigin || !positionDestination) return

  const position = lerpPosition(positionOrigin, positionDestination, positionProgress)
  view.injectTrackedPosition({
    position,
    // Re-read live on every tick: moving the slider while the simulation
    // runs changes the radius on the next tick, no restart needed.
    precisionCircleRadius: accuracyRadius.value,
  })
  // No-op unless a geofencing zone is active (geofenceZoneSurfaces is only
  // ever set by startGeofencing) — see below.
  checkGeofence(position)

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
  // what removes the marker/accuracy circle from the map. It also forces the
  // camera lock off and fires 'trackingoff', which syncCameraLock mirrors.
  if (viewRef.value) viewRef.value.allowTracking = false
  simulatingPosition.value = false
}

// Camera lock on the tracked position: view.lockCameraPositionOnTracking is a
// plain boolean toggled directly on the exposed `view` instance, same
// direct-SDK-call pattern as allowTracking/injectTrackedPosition above. Only
// has a visible effect once allowTracking is true (i.e. a simulation is
// running) — setting it beforehand is a documented no-op on the SDK side, not
// an exception (unlike injectTrackedPosition), so no extra guard is needed
// here beyond disabling the checkbox while nothing is being tracked.
//
// The SDK owns this state: allowTracking = true turns the lock on by itself,
// allowTracking = false turns it off, and a user pan/drag turns it off too.
// So the toggle is never an independent app-side value — it mirrors
// view.lockCameraPositionOnTracking, re-read on 'trackingon'/'trackingoff'/
// 'trackingchanged' (the events carry no value). See
// docs/features/camera-lock-on-position.md.
const CAMERA_LOCK_EVENTS = ['trackingon', 'trackingoff', 'trackingchanged']
const lockCameraOnPosition = ref(false)

function syncCameraLock() {
  lockCameraOnPosition.value = !!viewRef.value?.lockCameraPositionOnTracking
}

function toggleCameraLock(event) {
  const view = viewRef.value
  if (!view) return
  view.lockCameraPositionOnTracking = !view.lockCameraPositionOnTracking
  // The UI follows the 'trackingchanged' event; re-sync anyway (and force the
  // native checkbox back) so it never drifts if the setter was a no-op.
  syncCameraLock()
  if (event?.target) event.target.checked = lockCameraOnPosition.value
}

// Accuracy circle style: reuses the tracked-position simulation above and
// recolors its precision circle (not the center arrow) via
// view.updatePositionTrackerGraphicOptions({ color, opacity }). That call
// only stores the options — they take effect on the next
// injectTrackedPosition, which the ~150ms simulation loop makes look live.
// There is no getter, so the selection is tracked here. See
// docs/features/accuracy-circle-style.md.
const TRACKER_COLORS = [
  { key: 'default', value: PALETTE.blue },
  { key: 'red', value: PALETTE.red },
  { key: 'green', value: PALETTE.green },
  { key: 'purple', value: PALETTE.purple },
]
const DEFAULT_TRACKER_OPACITY = 0.3
const trackerColor = ref(TRACKER_COLORS[0].value)
// Slider minimum is 0.1, not 0: the SDK's opacity validation is a falsy
// check, so 0 would bypass it rather than mean "fully transparent".
const trackerOpacity = ref(DEFAULT_TRACKER_OPACITY)

function applyPositionTrackerStyle() {
  if (!isAccuracyCircleStyle) return
  viewRef.value?.updatePositionTrackerGraphicOptions({
    color: trackerColor.value,
    opacity: trackerOpacity.value,
  })
}

watch(trackerOpacity, applyPositionTrackerStyle)

function selectTrackerColor(color) {
  trackerColor.value = color
  applyPositionTrackerStyle()
}

// Geofencing: reuses the tracked-position simulation above (Origin/
// Destination POI ID + Start/Stop) and layers a "Zone POI ID" on top. The SDK
// has no point-in-polygon/geofence primitive of its own — a POI's
// surfaces[].positions (its boundary, WGS84 vertices, same coordinate space
// injectTrackedPosition expects) is public, so containment is computed here
// with a plain ray-casting test, piggybacked onto the existing simulation
// tick (there's no trackedpositionchanged event to listen to instead).
// Entering the zone recolors its surface(s) via venue.updateSurface(), same
// call as clickable-surface/category-highlight; leaving reverts it. See
// docs/features/geofencing.md.
const GEOFENCE_ALERT_COLOR = PALETTE.busy
const zonePoiId = ref(GEOFENCE_ZONE_ID)
const geofenceZoneNotFound = ref(false)
const geofenceNoSurface = ref(false)
const insideGeofence = ref(false)
// The zone POI's surfaces actually recolored: captured at Start, not re-read
// from the input on Stop (same pattern as highlightedPoi for goto-poi).
let geofenceZoneSurfaces = null

function pointInPolygon(point, positions) {
  // Ray-casting, longitude/latitude treated as planar x/y — accurate enough
  // at building scale, no map projection needed.
  let inside = false
  for (let i = 0, j = positions.length - 1; i < positions.length; j = i++) {
    const xi = positions[i].longitude
    const yi = positions[i].latitude
    const xj = positions[j].longitude
    const yj = positions[j].latitude
    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function checkGeofence(position) {
  if (!geofenceZoneSurfaces) return
  const venue = venueRef.value
  if (!venue) return

  const isInside = geofenceZoneSurfaces.some((surface) => pointInPolygon(position, surface.positions))
  if (isInside === insideGeofence.value) return
  insideGeofence.value = isInside
  geofenceZoneSurfaces.forEach((surface) =>
    venue.updateSurface(surface, { color: isInside ? GEOFENCE_ALERT_COLOR : 'initial' }),
  )
}

function startGeofencing() {
  const venue = venueRef.value
  if (!venue) return

  const targetId = zonePoiId.value.trim()
  if (!targetId) return

  const poi = findPoi(venue, targetId)
  if (!poi) {
    geofenceZoneNotFound.value = true
    geofenceNoSurface.value = false
    return
  }
  if (!poi.surfaces || poi.surfaces.length === 0) {
    geofenceZoneNotFound.value = false
    geofenceNoSurface.value = true
    return
  }
  geofenceZoneNotFound.value = false
  geofenceNoSurface.value = false
  // Armed before Start (its first tick already checks the zone), disarmed
  // again if the simulation could not start (unknown From/To).
  geofenceZoneSurfaces = poi.surfaces
  insideGeofence.value = false
  if (!startSimulatedPosition()) geofenceZoneSurfaces = null
}

function stopGeofencing() {
  stopSimulatedPosition()
  if (geofenceZoneSurfaces) {
    const venue = venueRef.value
    if (venue) geofenceZoneSurfaces.forEach((surface) => venue.updateSurface(surface, { color: 'initial' }))
  }
  geofenceZoneSurfaces = null
  insideGeofence.value = false
}

function toggleGeofencing() {
  if (simulatingPosition.value) {
    stopGeofencing()
  } else {
    startGeofencing()
  }
}

// Clickable surface: venue.updateSurface(surface, { isInteractive: true, ... })
// makes a POI's surface(s) SDK-managed clickable — once set, the SDK itself
// swaps the surface's displayed color on hover/tap using hoverColor/
// selectionColor below, with zero click-handling code on this side for the
// coloring itself. Base building block for any "availability" use case (a
// free/occupied room, a parking spot). See docs/features/clickable-surface.md.
const clickableSurfacePlaceId = ref(CLICKABLE_SURFACE_POI_ID)
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
        ? { isInteractive: true, color: PALETTE.free, hoverColor: PALETTE.soonBusy, selectionColor: PALETTE.busy }
        : // 'initial' / 'default' restore the map color and the view-wide
          // hover/selection colors (SurfaceUpdateOptions).
          { isInteractive: false, color: 'initial', hoverColor: 'default', selectionColor: 'default' },
    ),
  )
}

function enableClickableSurface() {
  const venue = venueRef.value
  if (!venue) return

  const targetId = clickableSurfacePlaceId.value.trim()
  if (!targetId) return

  const poi = findPoi(venue, targetId)
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
const customDataPlaceId = ref(CUSTOM_DATA_POI_ID)
const customDataLoading = ref(false)
const customDataNotFound = ref(false)
// null = nothing loaded yet; [] = POI found but its CustomData is {}; a
// non-empty array otherwise. Distinguishing null from [] is what lets the
// template tell "nothing attempted" from "attempted, found nothing".
const customDataEntries = ref(null)

// CUSTOM_DATA_SAMPLE_POI_IDS (demoMap.js) carry real, non-empty CustomData —
// offered as one-tap shortcuts so the feature shows actual key/value pairs
// without hunting for a valid id first.

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

    const poi = findPoi(venue, targetId)
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

const newPoiId = ref(NEW_POI_ID)
const anchorPoiId = ref(ANCHOR_POI_ID)
const labelText = ref(t('features.dynamicPoiCrud.defaultText'))
const dynamicPoiErrorKey = ref('')
// The actual POI/Label SDK instances currently tracked are kept as
// module-locals, not refs — same split as highlightedPoi/clickableSurfacePoi
// above — while their id/text are mirrored into refs purely for the template
// to read.
let trackedPoi = null
let trackedLabel = null
const trackedPoiId = ref('')
const trackedLabelText = ref('')

function createDynamicPoi() {
  const venue = venueRef.value
  if (!venue || trackedPoi) return

  dynamicPoiErrorKey.value = ''

  const id = newPoiId.value.trim()
  const anchorId = anchorPoiId.value.trim()
  if (!id || !anchorId) return

  const anchor = findPoi(venue, anchorId)
  if (!anchor) {
    dynamicPoiErrorKey.value = 'features.dynamicPoiCrud.anchorNotFound'
    return
  }

  const position = poiDisplayPosition(anchor)
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

// 3D icon marker: venue.createImage() places an Image — a picture sized in
// meters, living in the 3D scene — owned by an existing POI (the "anchor"
// itself, no createPOI needed) at that POI's own position (poiDisplayPosition,
// same as dynamic-poi-crud above). orientationType picks how it behaves relative to the camera:
// 'fixed' (flat on the ground, fixed heading), 'flat' (flat on the ground,
// turning to face the camera) or 'facing' (always camera-facing billboard).
// Changing it while an image is placed goes through venue.updateImage() live.
// Only one image at a time: placing again removes the previous one first.
// See docs/features/3d-icon-marker.md.
// 96x96 PNG (blue disc + white star), inlined as a data URL.
const ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAACBklEQVR42u3dWW4CMRBFUVbLarOn5JsIqRlsv6FuSfmE0O+IwS7bfbtR1GXdf34/+qMOhg2KcehgGIU+HsMt+DEQ7sHXQqQFXwWRHn4sQkvwkRCt4dsjtAdvDTEtfCuEqeFbIAgv/H/NQzAKfx6CYfhzEIzD70cQf+FFAGxFAEAIEBJ+J4LB7+04gKUIAAgBTEackQBfI4SG34MAgBDAaMIrHuAjBACEAGZTvhUAbyEAIAQwbHrUALyEAAAAcwGMe68V4V8iHAjJHeAI7mqAb0oNcOK1vwYgCP+di1E/334EMcDVRSmewx5gd60COPk6K94Bzy7u1OP4CAqrNQCCQdJ4gAcE0Uh1dPgrASYirB0Ri+dsRoa/A6AdYt+ckNksZn3wpwDSIc7NiprP69cFrwJwBdH3BUo6YLlN+qI2ZGZ7EgAA+AgqD99/ueKA8K0Q0veAxSMk7v+tQnABULQrvQZhQgBVv9gCQb00cXVoUQgOa0MBEALsCitvFlSEMBpAvT9gd0g5TRgATAGMe8Ru/ydul+TJULIBNiGMBlDvlFcE4rkGSISgCsICwOG0FGUIuQDCdaM121ydTs1S/wrJDP8gQN3pu44nJzo1RXLC56h6Ts4FAAROUCd8ELiLBuGDwJ2UCB8E7qhH8BMR4orgQZgdfjJEbRE8ELODd8KgBBjUQRSKuqo/fm7G7BpJ/VcAAAAASUVORK5CYII='
const ICON_SIZE_METERS = 6
const ICON_ORIENTATIONS = ['fixed', 'flat', 'facing']
// ANCHOR_POI_ID (demoMap.js) has a label, so a position to copy.
const iconAnchorPoiId = ref(ANCHOR_POI_ID)
const iconOrientation = ref('facing')
const iconErrorKey = ref('')
// Same split as trackedPoi/trackedPoiId above: the SDK Image instance is a
// module-local, its owner POI id mirrored into a ref for the template.
let placedIcon = null
const placedIconPoiId = ref('')

function removeIcon() {
  const venue = venueRef.value
  if (venue && placedIcon) venue.removeImage(placedIcon)
  placedIcon = null
  placedIconPoiId.value = ''
}

function placeIcon() {
  const venue = venueRef.value
  if (!venue) return

  iconErrorKey.value = ''
  const anchorId = iconAnchorPoiId.value.trim()
  const anchor = findPoi(venue, anchorId)
  if (!anchor) {
    iconErrorKey.value = 'features.iconMarker3d.poiNotFound'
    return
  }

  // Ignore our own current image, if any (it sits at the same spot anyway).
  const position = poiDisplayPosition(anchor, [placedIcon])
  if (!position) {
    iconErrorKey.value = 'features.iconMarker3d.poiNoPosition'
    return
  }

  removeIcon()
  placedIcon = venue.createImage({
    poi: anchor,
    position,
    width: ICON_SIZE_METERS,
    height: ICON_SIZE_METERS,
    url: ICON_DATA_URL,
    orientationType: iconOrientation.value,
  })
  placedIconPoiId.value = anchor.id
  // An image on an indoor POI only renders while that POI's floor is shown,
  // which isn't the case in the default global view: reuse goto-poi's
  // camera move to bring it into view.
  focusCameraOnPoi(anchor)
}

function selectIconOrientation(orientationType) {
  iconOrientation.value = orientationType
  const venue = venueRef.value
  if (venue && placedIcon) venue.updateImage(placedIcon, { orientationType })
}

function handleRemoveIcon() {
  removeIcon()
  iconErrorKey.value = ''
}

// Custom text label: venue.createLabel() places free text (opening hours,
// price, zone name...) owned by an existing POI (the "anchor", no createPOI
// needed), at the anchor's position (poiDisplayPosition, same as
// dynamic-poi-crud / 3d-icon-marker), then nudged ~4 m so it doesn't overlap the map's own label. Color and size are
// restyled live with venue.updateLabel() — width AND height always sent
// together, since width alone also resets height to width. `rotation` is
// only part of LabelCreateOptions, not LabelUpdateOptions, so changing it
// removes the label and recreates it. Only one label at a time. See
// docs/features/custom-text-label.md.
// ~4 m in latitude and longitude, also used by html-overlay-marker.
const ANCHOR_OFFSET_DEGREES = 0.00004
const TEXT_LABEL_COLORS = [
  { key: 'red', value: PALETTE.red },
  { key: 'green', value: PALETTE.green },
  { key: 'blue', value: PALETTE.blue },
  { key: 'dark', value: PALETTE.dark },
]
const TEXT_LABEL_SIZES = {
  small: { width: 10, height: 2 },
  medium: { width: 16, height: 3 },
  large: { width: 22, height: 4 },
}
const TEXT_LABEL_SIZE_KEYS = Object.keys(TEXT_LABEL_SIZES)
const TEXT_LABEL_ROTATIONS = [0, 45, 90]

const textLabelAnchorPoiId = ref(ANCHOR_POI_ID)
const textLabelText = ref(t('features.customTextLabel.defaultText'))
const textLabelColor = ref(TEXT_LABEL_COLORS[0].value)
const textLabelSize = ref('medium')
const textLabelRotation = ref(0)
const textLabelErrorKey = ref('')
// Same split as placedIcon/placedIconPoiId above: the SDK Label instance is
// a module-local, its owner POI id mirrored into a ref for the template.
let placedTextLabel = null
const placedTextLabelPoiId = ref('')

function removeTextLabel() {
  const venue = venueRef.value
  // removeLabel throws "Provided label is not registered" on a second call:
  // only call it while we still hold a reference.
  if (venue && placedTextLabel) venue.removeLabel(placedTextLabel)
  placedTextLabel = null
  placedTextLabelPoiId.value = ''
}

function placeTextLabel() {
  const venue = venueRef.value
  if (!venue) return

  textLabelErrorKey.value = ''
  // Empty text would make createLabel throw "Cannot create Label, text is required".
  const text = textLabelText.value.trim()
  if (!text) {
    textLabelErrorKey.value = 'features.customTextLabel.textRequired'
    return
  }

  const anchorId = textLabelAnchorPoiId.value.trim()
  const anchor = findPoi(venue, anchorId)
  if (!anchor) {
    textLabelErrorKey.value = 'features.customTextLabel.poiNotFound'
    return
  }

  // Ignore our own current label, so re-placing doesn't stack the offset.
  const anchorPosition = poiDisplayPosition(anchor, [placedTextLabel])
  if (!anchorPosition) {
    textLabelErrorKey.value = 'features.customTextLabel.poiNoPosition'
    return
  }

  removeTextLabel()
  const position = {
    ...anchorPosition,
    latitude: anchorPosition.latitude + ANCHOR_OFFSET_DEGREES,
    longitude: anchorPosition.longitude + ANCHOR_OFFSET_DEGREES,
  }
  const { width, height } = TEXT_LABEL_SIZES[textLabelSize.value]
  placedTextLabel = venue.createLabel({
    poi: anchor,
    position,
    width,
    height,
    text,
    color: textLabelColor.value,
    rotation: textLabelRotation.value,
  })
  placedTextLabelPoiId.value = anchor.id
  // Same as 3d-icon-marker: a label only renders while its POI's floor is
  // shown, so reuse goto-poi's camera move.
  focusCameraOnPoi(anchor)
}

function selectTextLabelColor(color) {
  textLabelColor.value = color
  const venue = venueRef.value
  if (venue && placedTextLabel) venue.updateLabel(placedTextLabel, { color })
}

function selectTextLabelSize(sizeKey) {
  textLabelSize.value = sizeKey
  const venue = venueRef.value
  if (venue && placedTextLabel) venue.updateLabel(placedTextLabel, { ...TEXT_LABEL_SIZES[sizeKey] })
}

function updateTextLabelText() {
  const venue = venueRef.value
  if (!venue || !placedTextLabel) return

  const text = textLabelText.value.trim()
  if (!text) {
    textLabelErrorKey.value = 'features.customTextLabel.textRequired'
    return
  }
  textLabelErrorKey.value = ''
  venue.updateLabel(placedTextLabel, { text })
}

function selectTextLabelRotation(rotation) {
  textLabelRotation.value = rotation
  const venue = venueRef.value
  if (!venue || !placedTextLabel) return

  // Not in LabelUpdateOptions: recreate with the same values + new rotation.
  const { poi, position, width, height, text, color } = placedTextLabel
  venue.removeLabel(placedTextLabel)
  placedTextLabel = venue.createLabel({ poi, position, width, height, text, color, rotation })
}

function handleRemoveTextLabel() {
  removeTextLabel()
  textLabelErrorKey.value = ''
}

// HTML overlay marker: venue.createMarker() overlays a plain HTML element on
// the map at a WGS84 position, owned by an existing POI (the "anchor"). Unlike
// a Label/Image it is not part of the 3D scene: it always faces the screen,
// is never hidden by 3D geometry, and — the point of this demo — can receive
// clicks. Position: poiDisplayPosition, same as custom-text-label (excluding
// our own badge, which gets appended to anchor.markers), same ~4 m offset. The SDK owns the element's position/transform/z-index and forces
// pointer-events:none at creation, so it's set back to 'auto' right after.
// Text updates are plain DOM edits (MarkerUpdateOptions only has position and
// isVisible). Only one badge at a time. See docs/features/html-overlay-marker.md.
const OVERLAY_MARKER_STYLE =
  'background:#0B6BCB;color:#FFFFFF;font:600 14px sans-serif;padding:6px 12px;border-radius:14px;' +
  'white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer'

const overlayMarkerAnchorPoiId = ref(ANCHOR_POI_ID)
const overlayMarkerText = ref(t('features.htmlOverlayMarker.defaultText'))
const overlayMarkerVisible = ref(true)
const overlayMarkerTapCount = ref(0)
// Single status line: { key, params, error } (error = shown in red).
const overlayMarkerStatus = ref({ key: 'features.htmlOverlayMarker.none', params: {}, error: false })
// Same split as placedTextLabel/placedTextLabelPoiId above: the SDK Marker
// instance is a module-local, its owner POI id mirrored into a ref.
let placedOverlayMarker = null
const placedOverlayMarkerPoiId = ref('')

function setOverlayMarkerStatus(key, params = {}, error = false) {
  overlayMarkerStatus.value = { key, params, error }
}

function removeOverlayMarker() {
  const venue = venueRef.value
  // removeMarker throws "Provided marker is not registered" on a second call:
  // only call it while we still hold a reference. It also detaches the
  // element from the DOM.
  if (venue && placedOverlayMarker) venue.removeMarker(placedOverlayMarker)
  placedOverlayMarker = null
  placedOverlayMarkerPoiId.value = ''
  overlayMarkerVisible.value = true
}

function handleOverlayMarkerClick(event) {
  // Don't let the tap fall through to the map (it would open the POI card of
  // whatever is underneath).
  event.stopPropagation()
  overlayMarkerTapCount.value += 1
  setOverlayMarkerStatus('features.htmlOverlayMarker.tapped', { count: overlayMarkerTapCount.value })
}

function placeOverlayMarker() {
  const venue = venueRef.value
  if (!venue) return

  const text = overlayMarkerText.value.trim()
  if (!text) {
    setOverlayMarkerStatus('features.htmlOverlayMarker.textRequired', {}, true)
    return
  }

  const anchorId = overlayMarkerAnchorPoiId.value.trim()
  const anchor = findPoi(venue, anchorId)
  if (!anchor) {
    setOverlayMarkerStatus('features.htmlOverlayMarker.poiNotFound', {}, true)
    return
  }

  // Ignore our own current badge, so re-placing doesn't stack the offset.
  const anchorPosition = poiDisplayPosition(anchor, [placedOverlayMarker])
  if (!anchorPosition) {
    setOverlayMarkerStatus('features.htmlOverlayMarker.poiNoPosition', {}, true)
    return
  }

  removeOverlayMarker()
  const position = {
    ...anchorPosition,
    latitude: anchorPosition.latitude + ANCHOR_OFFSET_DEGREES,
    longitude: anchorPosition.longitude + ANCHOR_OFFSET_DEGREES,
  }
  const element = document.createElement('div')
  element.textContent = text
  element.setAttribute('style', OVERLAY_MARKER_STYLE)
  placedOverlayMarker = venue.createMarker({ poi: anchor, position, element })
  // The SDK forces pointer-events:none on the element at creation (and never
  // rewrites it afterwards): opt back in so the badge is clickable.
  element.style.pointerEvents = 'auto'
  element.addEventListener('click', handleOverlayMarkerClick)

  placedOverlayMarkerPoiId.value = anchor.id
  overlayMarkerVisible.value = true
  overlayMarkerTapCount.value = 0
  setOverlayMarkerStatus('features.htmlOverlayMarker.placedOn', { id: anchor.id })
  // A marker is only displayed while its POI's floor is shown: reuse
  // goto-poi's camera move, same as custom-text-label.
  focusCameraOnPoi(anchor)
}

function updateOverlayMarkerText() {
  if (!placedOverlayMarker) return

  const text = overlayMarkerText.value.trim()
  if (!text) {
    setOverlayMarkerStatus('features.htmlOverlayMarker.textRequired', {}, true)
    return
  }
  // The marker's element is a live DOM node: no SDK call needed.
  placedOverlayMarker.element.textContent = text
  setOverlayMarkerStatus('features.htmlOverlayMarker.textUpdated')
}

function toggleOverlayMarkerVisibility() {
  const venue = venueRef.value
  if (!venue || !placedOverlayMarker) return

  const isVisible = !overlayMarkerVisible.value
  venue.updateMarker(placedOverlayMarker, { isVisible })
  overlayMarkerVisible.value = isVisible
  setOverlayMarkerStatus(isVisible ? 'features.htmlOverlayMarker.shown' : 'features.htmlOverlayMarker.hidden')
}

function handleRemoveOverlayMarker() {
  if (!placedOverlayMarker) return
  removeOverlayMarker()
  setOverlayMarkerStatus('features.htmlOverlayMarker.none')
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

// Custom theme: view.themes lists the registered 3D scene themes (read at
// runtime, never hardcoded) and view.setTheme(id) applies one — lighting
// only, visible because this screen's view is created with enableShadows
// (see mapViewOptions above). view.accentColor / view.textAccentColor are
// plain settable properties that recolor the SDK's own UI buttons (POI card
// "Go", "Add a step"...) live; both are also readable, so their initial
// values are read from the view on load. The SDK has no current-theme getter,
// so the selected theme is tracked here. See docs/features/custom-theme.md.
const DEFAULT_THEME = 'day'
const ACCENT_COLORS = [
  { key: 'blue', value: PALETTE.blue },
  { key: 'red', value: PALETTE.red },
  { key: 'green', value: PALETTE.green },
  { key: 'purple', value: PALETTE.purple },
]
const TEXT_ACCENT_COLORS = [
  { key: 'white', value: PALETTE.white },
  { key: 'yellow', value: PALETTE.yellow },
  { key: 'black', value: PALETTE.dark },
]

const availableThemes = ref([])
const currentTheme = ref(DEFAULT_THEME)
const accentColor = ref(ACCENT_COLORS[0].value)
const textAccentColor = ref(TEXT_ACCENT_COLORS[0].value)
// The view's own accent colors at load, restored by Reset.
let initialAccentColor = ACCENT_COLORS[0].value
let initialTextAccentColor = TEXT_ACCENT_COLORS[0].value

function initCustomTheme() {
  const view = viewRef.value
  if (!view) return
  availableThemes.value = [...view.themes]
  initialAccentColor = view.accentColor || initialAccentColor
  initialTextAccentColor = view.textAccentColor || initialTextAccentColor
  accentColor.value = initialAccentColor
  textAccentColor.value = initialTextAccentColor
}

function selectTheme(themeId) {
  const view = viewRef.value
  if (!view) return
  // setTheme throws for an id that isn't in view.themes; we only offer those.
  view.setTheme(themeId)
  currentTheme.value = themeId
}

function selectAccentColor(value) {
  const view = viewRef.value
  if (!view) return
  view.accentColor = value
  accentColor.value = value
}

function selectTextAccentColor(value) {
  const view = viewRef.value
  if (!view) return
  view.textAccentColor = value
  textAccentColor.value = value
}

function resetCustomTheme() {
  selectTheme(DEFAULT_THEME)
  selectAccentColor(initialAccentColor)
  selectTextAccentColor(initialTextAccentColor)
}

// camera-showcase-carousel: an endless camera tour (goToFloor then goToPOI,
// then a dwell) for kiosk/lobby screens. The loop and its state live here at
// screen level, not in the BottomSheet content, so closing the panel (needed
// to see the map) does not stop it and there is only ever one loop. Each
// Start/resume bumps `carouselRun`; a loop whose run id is stale, or whose
// awaited AnimationPromise reports isCanceled, exits. See
// docs/features/camera-showcase-carousel.md.
const CAROUSEL_DWELL_MS = 3000
const CAROUSEL_RESUME_MS = 10000

const carouselState = ref('stopped') // 'running' | 'paused' | 'stopped'
const carouselStopIndex = ref(0)
let carouselRun = 0
let carouselNextIndex = 0
let carouselDwellTimer = null
let carouselResumeTimer = null
// The AnimationPromise currently in flight (null between hops / while dwelling).
let carouselAnimation = null

function carouselStops() {
  const venue = venueRef.value
  if (!venue) return []
  return CAROUSEL_STOP_IDS.map((id) => findPoi(venue, id)).filter(Boolean)
}

function carouselDwell(ms) {
  return new Promise((resolve) => {
    carouselDwellTimer = setTimeout(resolve, ms)
  })
}

async function runCarousel(run, startIndex) {
  const view = viewRef.value
  const stops = carouselStops()
  if (!view || stops.length === 0) return
  const stillRunning = (animation) => run === carouselRun && !animation?.isCanceled
  for (let index = startIndex % stops.length; ; index = (index + 1) % stops.length) {
    const poi = stops[index]
    carouselStopIndex.value = index
    carouselNextIndex = (index + 1) % stops.length
    // Documented order: bring the POI's floor up first, then frame the POI.
    if (poi.floor) {
      const floorAnimation = view.goToFloor(poi.floor, { duration: 800 })
      carouselAnimation = floorAnimation
      await floorAnimation
      carouselAnimation = null
      if (!stillRunning(floorAnimation)) return
    }
    const poiAnimation = view.goToPOI(poi, {
      duration: 2500,
      easing: 'easeInOutQuad',
      orientation: { heading: index * 90, pitch: 30 },
    })
    carouselAnimation = poiAnimation
    await poiAnimation
    carouselAnimation = null
    if (!stillRunning(poiAnimation)) return
    await carouselDwell(CAROUSEL_DWELL_MS)
    if (run !== carouselRun) return
  }
}

function startCarousel(startIndex = 0) {
  if (!viewRef.value || !venueRef.value) return
  clearTimeout(carouselResumeTimer)
  clearTimeout(carouselDwellTimer)
  carouselState.value = 'running'
  runCarousel(++carouselRun, startIndex)
}

// Stop: just stop scheduling. The hop in flight (if any) is left to finish
// on its own and glides to its destination (cancel() would stop the camera
// where it is, mid-flight).
function stopCarousel() {
  carouselRun++
  clearTimeout(carouselDwellTimer)
  clearTimeout(carouselResumeTimer)
  carouselState.value = 'stopped'
}

function toggleCarousel() {
  if (carouselState.value === 'stopped') startCarousel(0)
  else stopCarousel()
}

// The SDK does not let a user drag interrupt its own camera animation, and
// fires no "camera moved by user" event, so the screen listens for
// pointerdown on the map itself (capture phase) and pauses right away.
function handleCarouselMapPointerDown() {
  if (props.slug !== 'camera-showcase-carousel' || carouselState.value === 'stopped') return
  const view = viewRef.value
  if (carouselState.value === 'running') {
    carouselRun++
    clearTimeout(carouselDwellTimer)
    carouselState.value = 'paused'
    // Interrupt the in-flight animation in place: starting a new, zero-length
    // animation on the camera's current target/heading/pitch resolves the
    // running one with isCanceled = true and leaves the camera where it is.
    // (cancel() would also stop it in place; its public typing says it puts
    // the target in its final state, but measured live it does not.) Only done while an animation is
    // actually running — nothing to interrupt during the dwell.
    if (view && carouselAnimation) {
      const { camera } = view
      carouselAnimation = null
      view.goToViewpoint(
        { positions: [camera.target] },
        { duration: 0, orientation: { heading: camera.heading, pitch: camera.pitch } },
      )
    }
  }
  // Every further touch while paused restarts the idle countdown.
  restartCarouselResumeTimer()
}

// Count the 10 s from the end of the gesture too, so a long drag is never
// cut short by the tour resuming under the user's finger.
function handleCarouselMapPointerUp() {
  if (carouselState.value === 'paused') restartCarouselResumeTimer()
}

function restartCarouselResumeTimer() {
  clearTimeout(carouselResumeTimer)
  carouselResumeTimer = setTimeout(() => startCarousel(carouselNextIndex), CAROUSEL_RESUME_MS)
}

const carouselStatus = computed(() => {
  if (carouselState.value === 'running') {
    return t('features.cameraShowcaseCarousel.running', {
      index: carouselStopIndex.value + 1,
      total: CAROUSEL_STOP_IDS.length,
      id: CAROUSEL_STOP_IDS[carouselStopIndex.value],
    })
  }
  if (carouselState.value === 'paused') return t('features.cameraShowcaseCarousel.paused')
  return t('features.cameraShowcaseCarousel.stopped')
})

onBeforeUnmount(stopCarousel)
</script>

<template>
  <main class="feature">
    <!-- auth-token is a code sample only (src/components/ProtectedVisioOneMap.vue):
         this demo has no protected map, so the screen loads no map at all. -->
    <div v-if="props.slug === 'auth-token'" class="auth-token-sample">
      <p>
        {{
          t('features.authToken.body', {
            file: 'src/components/ProtectedVisioOneMap.vue',
            doc: 'docs/features/auth-token.md',
          })
        }}
      </p>
    </div>
    <VisioOneMap
      v-else
      :key="mapKey"
      :hash="mapHash"
      :baseURL="effectiveBaseURL"
      :authorizationToken="visioOneAuthToken"
      :viewOptions="mapViewOptions"
      :showSdkError="props.slug !== 'custom-base-url'"
      @ready="handleReady"
      @error="handleError"
      @poi-click="handlePOIClick"
      @pointerdown.capture="handleCarouselMapPointerDown"
      @pointerup.capture="handleCarouselMapPointerUp"
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
        props.slug === 'accuracy-circle-style' ||
        props.slug === 'geofencing' ||
        props.slug === 'clickable-surface' ||
        props.slug === 'custom-data' ||
        props.slug === 'category-highlight' ||
        props.slug === 'dynamic-poi-crud' ||
        props.slug === 'runtime-locale' ||
        props.slug === 'native-ui-replacement' ||
        props.slug === 'add-locale' ||
        props.slug === 'custom-base-url' ||
        props.slug === 'custom-navigation-trace' ||
        props.slug === 'navigation-exclude-modalities' ||
        props.slug === 'accessible-mode' ||
        props.slug === '3d-icon-marker' ||
        props.slug === 'custom-text-label' ||
        props.slug === 'html-overlay-marker' ||
        (props.slug === 'custom-theme' && viewRef) ||
        props.slug === 'camera-projection-toggle' ||
        props.slug === 'camera-showcase-carousel'
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
        <div v-if="occupancyNotFound" class="goto-poi-panel__error">
          {{ t('features.occupancySimulated.notFound') }}
        </div>
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

      <!-- Building, floor and theme buttons show the SDK's raw ids (map data,
           not translatable app strings). -->
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
        <RouteFields
          v-model:from="itineraryOriginId"
          v-model:to="itineraryDestinationId"
          @submit="computeItinerary()"
        />
        <div class="itinerary-panel__actions">
          <button class="itinerary-panel__button" @click="computeItinerary()">
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

      <div v-else-if="props.slug === 'custom-navigation-trace'" class="itinerary-panel">
        <h2 class="itinerary-panel__title">{{ t('features.customNavigationTrace.panelTitle') }}</h2>
        <RouteFields
          v-model:from="itineraryOriginId"
          v-model:to="itineraryDestinationId"
          @submit="computeStyledItinerary"
        />
        <div class="itinerary-panel__actions">
          <button class="itinerary-panel__button" @click="computeStyledItinerary">
            {{ t('features.computeNavigation.go') }}
          </button>
          <button class="itinerary-panel__button itinerary-panel__button--secondary" @click="clearItineraryFields">
            {{ t('features.computeNavigation.clear') }}
          </button>
        </div>
        <div v-if="itineraryError" class="itinerary-panel__error">
          {{ itineraryError }}
        </div>

        <h2 class="itinerary-panel__title trace-style-panel__title">
          {{ t('features.customNavigationTrace.styleTitle') }}
        </h2>
        <ColorSwatches
          :colors="TRACE_PRESET_SWATCHES"
          :selected="TRACE_PRESETS[selectedTracePreset].progressColor"
          label-prefix="features.customNavigationTrace.presets"
          show-selected-label
          @select="applyTracePreset($event.key)"
        />
      </div>

      <div v-else-if="props.slug === 'navigation-exclude-modalities'" class="itinerary-panel">
        <h2 class="itinerary-panel__title">{{ t('features.navigationExcludeModalities.panelTitle') }}</h2>
        <RouteFields
          v-model:from="itineraryOriginId"
          v-model:to="itineraryDestinationId"
          @submit="computeItineraryExcludingModalities"
        />
        <label class="ui-part-panel__row navigation-exclude-modalities-panel__toggle">
          <span class="ui-part-panel__label">{{ t('features.navigationExcludeModalities.toggleLabel') }}</span>
          <input
            type="checkbox"
            class="ui-part-panel__switch"
            :checked="excludeElevator"
            @change="toggleExcludeElevator"
          />
        </label>
        <div class="itinerary-panel__actions">
          <button class="itinerary-panel__button" @click="computeItineraryExcludingModalities">
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

      <div v-else-if="props.slug === 'accessible-mode'" class="itinerary-panel">
        <h2 class="itinerary-panel__title">{{ t('features.accessibleMode.panelTitle') }}</h2>
        <RouteFields
          v-model:from="itineraryOriginId"
          v-model:to="itineraryDestinationId"
          @submit="computeItineraryAccessible"
        />
        <label class="ui-part-panel__row accessible-mode-panel__toggle">
          <span class="ui-part-panel__label">{{ t('features.accessibleMode.toggleLabel') }}</span>
          <input
            type="checkbox"
            class="ui-part-panel__switch"
            :checked="accessibleMode"
            @change="toggleAccessibleMode"
          />
        </label>
        <div class="itinerary-panel__actions">
          <button class="itinerary-panel__button" @click="computeItineraryAccessible">
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
        <RouteFields v-model:from="originPoiId" v-model:to="destinationPoiId" />
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
        <RouteFields v-model:from="originPoiId" v-model:to="destinationPoiId" />
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

      <div v-else-if="props.slug === 'accuracy-circle-style'" class="position-panel">
        <h2 class="position-panel__title">{{ t('features.accuracyCircleStyle.panelTitle') }}</h2>
        <RouteFields v-model:from="originPoiId" v-model:to="destinationPoiId" />
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
        <div class="explore-mode-panel__title">{{ t('features.accuracyCircleStyle.colorLabel') }}</div>
        <ColorSwatches
          :colors="TRACKER_COLORS"
          :selected="trackerColor"
          label-prefix="features.accuracyCircleStyle.colors"
          show-selected-label
          @select="selectTrackerColor($event.value)"
        />
        <label class="position-panel__radius">
          <span>{{ t('features.accuracyCircleStyle.opacityLabel') }}: {{ trackerOpacity.toFixed(1) }}</span>
          <input
            v-model.number="trackerOpacity"
            type="range"
            min="0.1"
            max="1"
            step="0.1"
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

      <div v-else-if="props.slug === 'geofencing'" class="position-panel">
        <h2 class="position-panel__title">{{ t('features.geofencing.panelTitle') }}</h2>
        <input
          v-model="zonePoiId"
          class="position-panel__input"
          :placeholder="t('features.geofencing.zonePlaceholder')"
        />
        <RouteFields v-model:from="originPoiId" v-model:to="destinationPoiId" />
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
        <button class="position-panel__button" @click="toggleGeofencing">
          {{ simulatingPosition ? t('features.simulatedPosition.stop') : t('features.simulatedPosition.start') }}
        </button>
        <div v-if="simulatingPosition" class="position-panel__status">
          {{ insideGeofence ? t('features.geofencing.inside') : t('features.geofencing.outside') }}
        </div>
        <div v-if="geofenceZoneNotFound" class="position-panel__error">
          {{ t('features.geofencing.zoneNotFound') }}
        </div>
        <div v-else-if="geofenceNoSurface" class="position-panel__error">
          {{ t('features.geofencing.zoneNoSurface') }}
        </div>
        <div v-if="positionError" class="position-panel__error">
          {{ positionError }}
        </div>
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

      <div v-else-if="props.slug === '3d-icon-marker'" class="goto-poi-panel">
        <h2 class="poi-panel__title">{{ t('features.iconMarker3d.panelTitle') }}</h2>
        <input
          v-model="iconAnchorPoiId"
          class="goto-poi-panel__input"
          :placeholder="t('features.iconMarker3d.anchorIdPlaceholder')"
          @keyup.enter="placeIcon"
        />
        <div class="explore-mode-panel__title">{{ t('features.iconMarker3d.orientationLabel') }}</div>
        <div class="explore-mode-panel__segmented icon-marker-panel__orientations">
          <button
            v-for="orientation in ICON_ORIENTATIONS"
            :key="orientation"
            type="button"
            class="explore-mode-panel__option"
            :class="{ 'explore-mode-panel__option--active': orientation === iconOrientation }"
            @click="selectIconOrientation(orientation)"
          >
            {{ t(`features.iconMarker3d.orientations.${orientation}`) }}
          </button>
        </div>
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button" @click="placeIcon">
            {{ t('features.iconMarker3d.place') }}
          </button>
          <button
            class="goto-poi-panel__button goto-poi-panel__button--secondary"
            :disabled="!placedIconPoiId"
            @click="handleRemoveIcon"
          >
            {{ t('features.iconMarker3d.remove') }}
          </button>
        </div>
        <div v-if="iconErrorKey" class="goto-poi-panel__error">
          {{ t(iconErrorKey) }}
        </div>
        <div v-else-if="placedIconPoiId" class="poi-panel__entry">
          {{ t('features.iconMarker3d.placedOn', { id: placedIconPoiId }) }}
        </div>
        <div v-else class="poi-panel__entry">
          {{ t('features.iconMarker3d.none') }}
        </div>
      </div>

      <div v-else-if="props.slug === 'custom-text-label'" class="goto-poi-panel">
        <h2 class="poi-panel__title">{{ t('features.customTextLabel.panelTitle') }}</h2>
        <input
          v-model="textLabelAnchorPoiId"
          class="goto-poi-panel__input"
          :placeholder="t('features.customTextLabel.anchorIdPlaceholder')"
        />
        <input
          v-model="textLabelText"
          class="goto-poi-panel__input"
          :placeholder="t('features.customTextLabel.textPlaceholder')"
          @keyup.enter="placedTextLabelPoiId ? updateTextLabelText() : placeTextLabel()"
        />
        <div class="explore-mode-panel__title">{{ t('features.customTextLabel.colorLabel') }}</div>
        <ColorSwatches
          :colors="TEXT_LABEL_COLORS"
          :selected="textLabelColor"
          label-prefix="features.customTextLabel.colors"
          @select="selectTextLabelColor($event.value)"
        />
        <div class="explore-mode-panel__title">{{ t('features.customTextLabel.sizeLabel') }}</div>
        <div class="explore-mode-panel__segmented icon-marker-panel__orientations">
          <button
            v-for="sizeKey in TEXT_LABEL_SIZE_KEYS"
            :key="sizeKey"
            type="button"
            class="explore-mode-panel__option"
            :class="{ 'explore-mode-panel__option--active': sizeKey === textLabelSize }"
            @click="selectTextLabelSize(sizeKey)"
          >
            {{ t(`features.customTextLabel.sizes.${sizeKey}`) }}
          </button>
        </div>
        <div class="explore-mode-panel__title">{{ t('features.customTextLabel.rotationLabel') }}</div>
        <div class="explore-mode-panel__segmented icon-marker-panel__orientations">
          <button
            v-for="rotation in TEXT_LABEL_ROTATIONS"
            :key="rotation"
            type="button"
            class="explore-mode-panel__option"
            :class="{ 'explore-mode-panel__option--active': rotation === textLabelRotation }"
            @click="selectTextLabelRotation(rotation)"
          >
            {{ rotation }}°
          </button>
        </div>
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button" @click="placeTextLabel">
            {{ t('features.customTextLabel.place') }}
          </button>
          <button class="goto-poi-panel__button" :disabled="!placedTextLabelPoiId" @click="updateTextLabelText">
            {{ t('features.customTextLabel.updateText') }}
          </button>
          <button
            class="goto-poi-panel__button goto-poi-panel__button--secondary"
            :disabled="!placedTextLabelPoiId"
            @click="handleRemoveTextLabel"
          >
            {{ t('features.customTextLabel.remove') }}
          </button>
        </div>
        <div v-if="textLabelErrorKey" class="goto-poi-panel__error">
          {{ t(textLabelErrorKey) }}
        </div>
        <div v-else-if="placedTextLabelPoiId" class="poi-panel__entry">
          {{ t('features.customTextLabel.placedOn', { id: placedTextLabelPoiId }) }}
        </div>
        <div v-else class="poi-panel__entry">
          {{ t('features.customTextLabel.none') }}
        </div>
      </div>

      <div v-else-if="props.slug === 'html-overlay-marker'" class="goto-poi-panel">
        <h2 class="poi-panel__title">{{ t('features.htmlOverlayMarker.panelTitle') }}</h2>
        <input
          v-model="overlayMarkerAnchorPoiId"
          class="goto-poi-panel__input"
          :placeholder="t('features.htmlOverlayMarker.anchorIdPlaceholder')"
        />
        <input
          v-model="overlayMarkerText"
          class="goto-poi-panel__input"
          :placeholder="t('features.htmlOverlayMarker.textPlaceholder')"
          @keyup.enter="placedOverlayMarkerPoiId ? updateOverlayMarkerText() : placeOverlayMarker()"
        />
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button" @click="placeOverlayMarker">
            {{ t('features.htmlOverlayMarker.place') }}
          </button>
          <button
            class="goto-poi-panel__button"
            :disabled="!placedOverlayMarkerPoiId"
            @click="updateOverlayMarkerText"
          >
            {{ t('features.htmlOverlayMarker.updateText') }}
          </button>
        </div>
        <div class="goto-poi-panel__actions">
          <button
            class="goto-poi-panel__button goto-poi-panel__button--secondary"
            :disabled="!placedOverlayMarkerPoiId"
            @click="toggleOverlayMarkerVisibility"
          >
            {{ overlayMarkerVisible ? t('features.htmlOverlayMarker.hide') : t('features.htmlOverlayMarker.show') }}
          </button>
          <button
            class="goto-poi-panel__button goto-poi-panel__button--secondary"
            :disabled="!placedOverlayMarkerPoiId"
            @click="handleRemoveOverlayMarker"
          >
            {{ t('features.htmlOverlayMarker.remove') }}
          </button>
        </div>
        <div :class="overlayMarkerStatus.error ? 'goto-poi-panel__error' : 'poi-panel__entry'">
          {{ t(overlayMarkerStatus.key, overlayMarkerStatus.params) }}
        </div>
      </div>

      <div v-else-if="props.slug === 'custom-theme'" class="goto-poi-panel">
        <h2 class="poi-panel__title">{{ t('features.customTheme.panelTitle') }}</h2>
        <div class="explore-mode-panel__title">{{ t('features.customTheme.themeLabel') }}</div>
        <div class="explore-mode-panel__segmented">
          <button
            v-for="themeId in availableThemes"
            :key="themeId"
            type="button"
            class="explore-mode-panel__option"
            :class="{ 'explore-mode-panel__option--active': themeId === currentTheme }"
            @click="selectTheme(themeId)"
          >
            {{ themeId }}
          </button>
        </div>
        <div class="explore-mode-panel__title">{{ t('features.customTheme.accentLabel') }}</div>
        <ColorSwatches
          :colors="ACCENT_COLORS"
          :selected="accentColor"
          label-prefix="features.customTheme.colors"
          @select="selectAccentColor($event.value)"
        />
        <div class="explore-mode-panel__title">{{ t('features.customTheme.textAccentLabel') }}</div>
        <ColorSwatches
          :colors="TEXT_ACCENT_COLORS"
          :selected="textAccentColor"
          label-prefix="features.customTheme.colors"
          @select="selectTextAccentColor($event.value)"
        />
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button goto-poi-panel__button--secondary" @click="resetCustomTheme">
            {{ t('features.customTheme.reset') }}
          </button>
        </div>
        <div class="poi-panel__entry">{{ t('features.customTheme.hint') }}</div>
      </div>

      <div v-else-if="props.slug === 'camera-projection-toggle'" class="goto-poi-panel">
        <h2 class="poi-panel__title">{{ t('features.cameraProjectionToggle.panelTitle') }}</h2>
        <div class="explore-mode-panel__segmented">
          <button
            v-for="projection in CAMERA_PROJECTIONS"
            :key="projection"
            type="button"
            class="explore-mode-panel__option"
            :class="{ 'explore-mode-panel__option--active': projection === reportedProjection }"
            :disabled="projectionReloading"
            @click="selectProjection(projection)"
          >
            {{ t(`features.cameraProjectionToggle.projections.${projection}`) }}
          </button>
        </div>
        <div class="poi-panel__entry">
          {{ projectionReloading ? t('features.cameraProjectionToggle.reloading') : t('features.cameraProjectionToggle.hint') }}
        </div>
      </div>

      <div v-else-if="props.slug === 'camera-showcase-carousel'" class="goto-poi-panel">
        <h2 class="poi-panel__title">{{ t('features.cameraShowcaseCarousel.panelTitle') }}</h2>
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button" @click="toggleCarousel">
            {{
              carouselState === 'stopped'
                ? t('features.cameraShowcaseCarousel.start')
                : t('features.cameraShowcaseCarousel.stop')
            }}
          </button>
        </div>
        <div class="position-panel__status">{{ carouselStatus }}</div>
        <div class="poi-panel__entry">{{ t('features.cameraShowcaseCarousel.hint') }}</div>
      </div>

      <div v-else-if="props.slug === 'custom-base-url'" class="goto-poi-panel">
        <input
          v-model="baseURLInput"
          class="goto-poi-panel__input"
          :placeholder="t('features.customBaseUrl.placeholder')"
          @keyup.enter="reloadWithBaseURL"
        />
        <div class="goto-poi-panel__actions">
          <button class="goto-poi-panel__button" @click="reloadWithBaseURL">
            {{ t('features.customBaseUrl.reload') }}
          </button>
        </div>
        <div v-if="baseURLError" class="goto-poi-panel__error">
          {{ t('features.customBaseUrl.error') }}: {{ baseURLError }}
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

.auth-token-sample {
  box-sizing: border-box;
  height: 100%;
  padding: 72px 20px 20px;
  overflow-y: auto;
  line-height: 1.5;
}

.auth-token-sample p {
  max-width: 640px;
  margin: 0 auto;
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
  flex-wrap: wrap;
  gap: 8px;
}

.occupancy-panel .goto-poi-panel__error {
  flex-basis: 100%;
  margin-top: 2px;
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

.icon-marker-panel__orientations {
  margin-bottom: 8px;
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

.explore-mode-panel__option:disabled {
  opacity: 0.5;
  cursor: default;
}

.itinerary-panel__title {
  margin: 0 0 12px;
  font-size: 1.1em;
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

.trace-style-panel__title {
  margin-top: 16px;
}

.navigation-exclude-modalities-panel__toggle {
  margin-top: 4px;
  margin-bottom: 14px;
}

.accessible-mode-panel__toggle {
  margin-top: 4px;
  margin-bottom: 14px;
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

.position-panel__status {
  margin-top: 10px;
  font-size: 0.9em;
  font-weight: 600;
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
