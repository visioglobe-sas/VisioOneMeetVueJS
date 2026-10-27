<script setup>
// occupancy-simulated: stand-in for a real occupancy sensor feed — cycles a
// POI's surface through availability colors on a timer with
// venue.updateSurface(). See docs/features/occupancy-simulated.md.
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import { PALETTE } from '../colors'
import { OCCUPANCY_POI_ID } from '../demoMap'
import { findPoi } from '../sdk/pois'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

const OCCUPANCY_COLORS = [PALETTE.free, PALETTE.soonBusy, PALETTE.busy]
const OCCUPANCY_INTERVAL_MS = 2500

const placeId = ref(OCCUPANCY_POI_ID)
const simulating = ref(false)
const notFound = ref(false)
let timer = null
let colorIndex = 0
// The place ID actually targeted by the running timer — captured at start,
// deliberately not re-read from `placeId` on stop (see stopSimulation).
let simulatingPlaceId = null

function updateOccupancy(targetPlaceId, color) {
  const venue = venueRef.value
  if (!venue) return
  const poi = findPoi(venue, targetPlaceId)
  if (!poi) return
  poi.surfaces.forEach((surface) => venue.updateSurface(surface, { color }))
}

function startSimulation() {
  const targetPlaceId = placeId.value.trim()
  if (!targetPlaceId) return
  notFound.value = !findPoi(venueRef.value, targetPlaceId)
  if (notFound.value) return

  simulating.value = true
  simulatingPlaceId = targetPlaceId
  colorIndex = 0
  updateOccupancy(targetPlaceId, OCCUPANCY_COLORS[colorIndex])
  timer = setInterval(() => {
    colorIndex = (colorIndex + 1) % OCCUPANCY_COLORS.length
    updateOccupancy(targetPlaceId, OCCUPANCY_COLORS[colorIndex])
  }, OCCUPANCY_INTERVAL_MS)
}

function stopSimulation() {
  clearInterval(timer)
  timer = null
  // Reset the POI that was actually being simulated — not whatever `placeId`
  // currently holds, which may have been edited since simulation started.
  if (simulatingPlaceId) {
    // 'initial' is the SDK's sentinel that restores the surface's own map
    // color (SurfaceUpdateOptions.color); undefined would leave it as is.
    updateOccupancy(simulatingPlaceId, 'initial')
  }
  simulatingPlaceId = null
  simulating.value = false
}

function toggleSimulation() {
  if (simulating.value) stopSimulation()
  else startSimulation()
}

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <div class="occupancy-panel">
      <input v-model="placeId" class="occupancy-panel__input" :placeholder="t('features.occupancySimulated.placeholder')" />
      <button class="occupancy-panel__button" @click="toggleSimulation">
        {{ simulating ? t('features.occupancySimulated.stop') : t('features.occupancySimulated.start') }}
      </button>
      <div v-if="notFound" class="panel-error occupancy-panel__error">
        {{ t('features.occupancySimulated.notFound') }}
      </div>
    </div>
  </FeatureScreen>
</template>

<style scoped>
.occupancy-panel {
  display: flex;
  flex-wrap: wrap;
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

.occupancy-panel__error {
  flex-basis: 100%;
  margin-top: 2px;
}
</style>
