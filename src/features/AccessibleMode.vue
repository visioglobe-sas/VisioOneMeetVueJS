<script setup>
// accessible-mode: the same itinerary as compute-navigation
// (src/composables/useItinerary.js), passing NavigationRequest.isAccessible
// through to venue.computeNavigation(). isAccessible: true makes the routing
// only use "accessible" segments; which segments count is map data, defined
// per venue in VisioMapEditor (no public getter). The toggle only affects
// the *next* "Itinerary" press. See docs/features/accessible-mode.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import RouteFields from '../components/RouteFields.vue'
import { useItinerary } from '../composables/useItinerary'
import { ACCESSIBLE_FROM, ACCESSIBLE_TO } from '../demoMap'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

// On the demo map this route takes stairs by default, the lift with
// isAccessible: true.
const itinerary = useItinerary(venueRef, viewRef, { from: ACCESSIBLE_FROM, to: ACCESSIBLE_TO })
const { originId, destinationId, error } = itinerary

const accessibleMode = ref(false)

function compute() {
  itinerary.compute(accessibleMode.value ? { isAccessible: true } : {})
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.accessibleMode.panelTitle') }}</h2>
    <RouteFields v-model:from="originId" v-model:to="destinationId" @submit="compute" />
    <label class="panel-row itinerary-toggle">
      <span class="panel-row__label">{{ t('features.accessibleMode.toggleLabel') }}</span>
      <input type="checkbox" class="panel-switch" :checked="accessibleMode" @change="accessibleMode = !accessibleMode" />
    </label>
    <div class="panel-actions">
      <button class="panel-button" @click="compute">{{ t('features.computeNavigation.go') }}</button>
      <button class="panel-button panel-button--secondary" @click="itinerary.clearFields">
        {{ t('features.computeNavigation.clear') }}
      </button>
    </div>
    <div v-if="error" class="panel-error">{{ error }}</div>
  </FeatureScreen>
</template>

<style scoped>
.itinerary-toggle {
  margin-top: 4px;
  margin-bottom: 14px;
}
</style>
