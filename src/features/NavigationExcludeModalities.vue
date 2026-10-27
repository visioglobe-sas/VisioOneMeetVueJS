<script setup>
// navigation-exclude-modalities: the same itinerary as compute-navigation
// (src/composables/useItinerary.js), passing
// NavigationRequest.excludedAttributes through to venue.computeNavigation().
// The SDK's JSDoc for excludedAttributes describes it as e.g. "elevator", but
// the attribute actually tagged on this venue's floor-transition segments is
// 'lift' (map data, set in VisioMapEditor). The toggle only affects the
// *next* "Itinerary" press. See docs/features/navigation-exclude-modalities.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import RouteFields from '../components/RouteFields.vue'
import { useItinerary } from '../composables/useItinerary'
import { EXCLUDE_MODALITIES_FROM, EXCLUDE_MODALITIES_TO } from '../demoMap'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

// A route that uses an elevator by default.
const itinerary = useItinerary(venueRef, viewRef, { from: EXCLUDE_MODALITIES_FROM, to: EXCLUDE_MODALITIES_TO })
const { originId, destinationId, error } = itinerary

const EXCLUDED_ELEVATOR_ATTRIBUTE = 'lift'
const excludeElevator = ref(false)

function compute() {
  itinerary.compute(excludeElevator.value ? { excludedAttributes: [EXCLUDED_ELEVATOR_ATTRIBUTE] } : {})
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.navigationExcludeModalities.panelTitle') }}</h2>
    <RouteFields v-model:from="originId" v-model:to="destinationId" @submit="compute" />
    <label class="panel-row itinerary-toggle">
      <span class="panel-row__label">{{ t('features.navigationExcludeModalities.toggleLabel') }}</span>
      <input type="checkbox" class="panel-switch" :checked="excludeElevator" @change="excludeElevator = !excludeElevator" />
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
