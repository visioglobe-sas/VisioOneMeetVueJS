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

async function loadCustomData() {
  const venue = venueRef.value
  if (!venue) return

  const targetId = customDataPlaceId.value.trim()
  if (!targetId) return

  customDataLoading.value = true
  customDataNotFound.value = false
  customDataEntries.value = null

  try {
    await venue.refreshCustomData()

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
</script>

<template>
  <main class="feature">
    <VisioOneMap
      :hash="visioOneHash"
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
        props.slug === 'compute-navigation' ||
        props.slug === 'ui-part-visibility' ||
        props.slug === 'simulated-position' ||
        props.slug === 'camera-lock-on-position' ||
        props.slug === 'clickable-surface' ||
        props.slug === 'custom-data'
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

.floor-panel__floor-badge {
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.85;
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
</style>
