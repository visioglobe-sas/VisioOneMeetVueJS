<script setup>
// geofencing: the SDK has no point-in-polygon/geofence primitive. A POI's
// surfaces[].positions (its boundary, WGS84 vertices, the same coordinate
// space injectTrackedPosition expects) is public, so containment is computed
// here with a plain ray-casting test on every tick of the simulated position
// (src/composables/useSimulatedPosition.js, onTick hook; there's no
// trackedpositionchanged event to listen to instead). Entering the zone
// recolors its surface(s) via venue.updateSurface(); leaving reverts it. See
// docs/features/geofencing.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import RouteFields from '../components/RouteFields.vue'
import { PALETTE } from '../colors'
import { useSimulatedPosition } from '../composables/useSimulatedPosition'
import { GEOFENCE_ZONE_ID } from '../demoMap'
import { findPoi } from '../sdk/pois'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

const ALERT_COLOR = PALETTE.busy
const zonePoiId = ref(GEOFENCE_ZONE_ID)
const zoneNotFound = ref(false)
const zoneNoSurface = ref(false)
const insideZone = ref(false)
// The zone POI's surfaces actually recolored: captured at Start, not re-read
// from the input on Stop.
let zoneSurfaces = null

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

// Called after each injected position (onTick).
function checkGeofence(position) {
  if (!zoneSurfaces) return
  const venue = venueRef.value
  if (!venue) return

  const isInside = zoneSurfaces.some((surface) => pointInPolygon(position, surface.positions))
  if (isInside === insideZone.value) return
  insideZone.value = isInside
  zoneSurfaces.forEach((surface) => venue.updateSurface(surface, { color: isInside ? ALERT_COLOR : 'initial' }))
}

const tracking = useSimulatedPosition(venueRef, viewRef, { onTick: checkGeofence })
const { originId, destinationId, accuracyRadius, simulating, error } = tracking

function startGeofencing() {
  const venue = venueRef.value
  if (!venue) return

  const targetId = zonePoiId.value.trim()
  if (!targetId) return

  const poi = findPoi(venue, targetId)
  if (!poi) {
    zoneNotFound.value = true
    zoneNoSurface.value = false
    return
  }
  if (!poi.surfaces || poi.surfaces.length === 0) {
    zoneNotFound.value = false
    zoneNoSurface.value = true
    return
  }
  zoneNotFound.value = false
  zoneNoSurface.value = false
  // Armed before Start (its first tick already checks the zone), disarmed
  // again if the simulation could not start (unknown From/To).
  zoneSurfaces = poi.surfaces
  insideZone.value = false
  if (!tracking.start()) zoneSurfaces = null
}

function stopGeofencing() {
  tracking.stop()
  if (zoneSurfaces) {
    const venue = venueRef.value
    if (venue) zoneSurfaces.forEach((surface) => venue.updateSurface(surface, { color: 'initial' }))
  }
  zoneSurfaces = null
  insideZone.value = false
}

function toggleGeofencing() {
  if (simulating.value) stopGeofencing()
  else startGeofencing()
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.geofencing.panelTitle') }}</h2>
    <input v-model="zonePoiId" class="panel-input" :placeholder="t('features.geofencing.zonePlaceholder')" />
    <RouteFields v-model:from="originId" v-model:to="destinationId" />
    <label class="panel-slider">
      <span>{{ t('features.simulatedPosition.radiusLabel') }}: {{ accuracyRadius }} m</span>
      <input v-model.number="accuracyRadius" type="range" min="1" max="20" step="1" />
    </label>
    <button class="panel-button panel-button--block" @click="toggleGeofencing">
      {{ simulating ? t('features.simulatedPosition.stop') : t('features.simulatedPosition.start') }}
    </button>
    <div v-if="simulating" class="panel-status">
      {{ insideZone ? t('features.geofencing.inside') : t('features.geofencing.outside') }}
    </div>
    <div v-if="zoneNotFound" class="panel-error">{{ t('features.geofencing.zoneNotFound') }}</div>
    <div v-else-if="zoneNoSurface" class="panel-error">{{ t('features.geofencing.zoneNoSurface') }}</div>
    <div v-if="error" class="panel-error">{{ error }}</div>
  </FeatureScreen>
</template>
