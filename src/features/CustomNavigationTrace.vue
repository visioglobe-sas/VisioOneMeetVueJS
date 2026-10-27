<script setup>
// custom-navigation-trace: restyle a computed route with
// venue.updateNavigationTrace(trace, options). The route itself comes from
// src/composables/useItinerary.js (same as compute-navigation). Each preset
// is a full NavigationTraceUpdateOptions: the SDK has no "reset to default"
// call, so 'visioglobeBlue' re-states the Line defaults documented in the
// SDK typings (progressColor '#0094F0', previewColor '#C5C5C5'). See
// docs/features/custom-navigation-trace.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import ColorSwatches from '../components/ColorSwatches.vue'
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
const { originId, destinationId, error, currentTrace } = itinerary

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
const PRESET_SWATCHES = Object.entries(TRACE_PRESETS).map(([key, preset]) => ({ key, value: preset.progressColor }))
const selectedPreset = ref('visioglobeBlue')

// venue.updateNavigationTrace() throws internally (TypeError reading
// 'material' on one of the Line adapters — see
// docs/features/custom-navigation-trace.md) on a route that never crosses
// into a building, after applying every color correctly. Caught here so it
// doesn't surface as an uncaught error.
function updateTraceStyle(trace, preset) {
  try {
    venueRef.value.updateNavigationTrace(trace, preset)
  } catch (updateError) {
    console.warn('updateNavigationTrace threw (trace styling still applied):', updateError)
  }
}

function applyPreset(presetKey) {
  selectedPreset.value = presetKey
  if (currentTrace.value) updateTraceStyle(currentTrace.value, TRACE_PRESETS[presetKey])
}

function computeStyledItinerary() {
  itinerary.compute()
  if (currentTrace.value) updateTraceStyle(currentTrace.value, TRACE_PRESETS[selectedPreset.value])
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.customNavigationTrace.panelTitle') }}</h2>
    <RouteFields v-model:from="originId" v-model:to="destinationId" @submit="computeStyledItinerary" />
    <div class="panel-actions">
      <button class="panel-button" @click="computeStyledItinerary">{{ t('features.computeNavigation.go') }}</button>
      <button class="panel-button panel-button--secondary" @click="itinerary.clearFields">
        {{ t('features.computeNavigation.clear') }}
      </button>
    </div>
    <div v-if="error" class="panel-error">{{ error }}</div>

    <h2 class="panel-title trace-style__title">{{ t('features.customNavigationTrace.styleTitle') }}</h2>
    <ColorSwatches
      :colors="PRESET_SWATCHES"
      :selected="TRACE_PRESETS[selectedPreset].progressColor"
      label-prefix="features.customNavigationTrace.presets"
      show-selected-label
      @select="applyPreset($event.key)"
    />
  </FeatureScreen>
</template>

<style scoped>
.trace-style__title {
  margin-top: 16px;
}
</style>
