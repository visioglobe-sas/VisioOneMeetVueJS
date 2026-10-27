<script setup>
// compute-navigation: route between two POI ids with venue.computeNavigation()
// + venue.createNavigationTrace() + view.setCurrentNavigationTrace(). The
// SDK calls live in src/composables/useItinerary.js, shared with the three
// other itinerary screens. See docs/features/compute-navigation.md.
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import RouteFields from '../components/RouteFields.vue'
import { useItinerary } from '../composables/useItinerary'
import { ITINERARY_FROM, ITINERARY_TO } from '../demoMap'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

const itinerary = useItinerary(venueRef, viewRef, { from: ITINERARY_FROM, to: ITINERARY_TO })
const { originId, destinationId, error } = itinerary
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.computeNavigation.panelTitle') }}</h2>
    <RouteFields v-model:from="originId" v-model:to="destinationId" @submit="itinerary.compute()" />
    <div class="panel-actions">
      <button class="panel-button" @click="itinerary.compute()">{{ t('features.computeNavigation.go') }}</button>
      <button class="panel-button panel-button--secondary" @click="itinerary.clearFields">
        {{ t('features.computeNavigation.clear') }}
      </button>
    </div>
    <div v-if="error" class="panel-error">{{ error }}</div>
  </FeatureScreen>
</template>
