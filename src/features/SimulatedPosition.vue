<script setup>
// simulated-position: walk a tracked position (dot + accuracy circle) back
// and forth between two POI ids with view.allowTracking = true and
// view.injectTrackedPosition(). The loop lives in
// src/composables/useSimulatedPosition.js, shared with the three other
// tracking screens. See docs/features/simulated-position.md.
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import RouteFields from '../components/RouteFields.vue'
import { useSimulatedPosition } from '../composables/useSimulatedPosition'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

const tracking = useSimulatedPosition(venueRef, viewRef)
const { originId, destinationId, accuracyRadius, simulating, error } = tracking
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.simulatedPosition.panelTitle') }}</h2>
    <RouteFields v-model:from="originId" v-model:to="destinationId" />
    <label class="panel-slider">
      <span>{{ t('features.simulatedPosition.radiusLabel') }}: {{ accuracyRadius }} m</span>
      <input v-model.number="accuracyRadius" type="range" min="1" max="20" step="1" />
    </label>
    <button class="panel-button panel-button--block" @click="tracking.toggle">
      {{ simulating ? t('features.simulatedPosition.stop') : t('features.simulatedPosition.start') }}
    </button>
    <div v-if="error" class="panel-error">{{ error }}</div>
  </FeatureScreen>
</template>
