<script setup>
import { onBeforeUnmount, ref } from 'vue'
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

const venueRef = ref(null)
const viewRef = ref(null)
const controlsOpen = ref(false)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
  console.log('VisioOne venue loaded:', venue)
  console.log('VisioOne view created:', view)
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

onBeforeUnmount(() => clearInterval(occupancyTimer))

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
        props.slug === 'goto-poi'
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
</style>
