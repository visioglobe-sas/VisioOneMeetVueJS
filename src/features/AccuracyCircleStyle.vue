<script setup>
// accuracy-circle-style: recolor the tracked position's precision circle
// (not the center arrow) with view.updatePositionTrackerGraphicOptions({
// color, opacity }). That call only stores the options: they take effect on
// the next injectTrackedPosition, which the ~150 ms simulation loop
// (src/composables/useSimulatedPosition.js) makes look live. There is no
// getter, so the selection is tracked here. See
// docs/features/accuracy-circle-style.md.
import { ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ColorSwatches from '../components/ColorSwatches.vue'
import FeatureScreen from '../components/FeatureScreen.vue'
import RouteFields from '../components/RouteFields.vue'
import { PALETTE } from '../colors'
import { useSimulatedPosition } from '../composables/useSimulatedPosition'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

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

function applyTrackerStyle() {
  viewRef.value?.updatePositionTrackerGraphicOptions({
    color: trackerColor.value,
    opacity: trackerOpacity.value,
  })
}

watch(trackerOpacity, applyTrackerStyle)

function selectTrackerColor(color) {
  trackerColor.value = color
  applyTrackerStyle()
}

// The SDK resets the precision circle's color+opacity to its defaults
// whenever tracking stops, so the style is re-applied on every Start, before
// the first inject (onStart). A slightly larger radius makes the recolored
// circle easy to see.
const tracking = useSimulatedPosition(venueRef, viewRef, { radius: 6, onStart: applyTrackerStyle })
const { originId, destinationId, accuracyRadius, simulating, error } = tracking
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.accuracyCircleStyle.panelTitle') }}</h2>
    <RouteFields v-model:from="originId" v-model:to="destinationId" />
    <label class="panel-slider">
      <span>{{ t('features.simulatedPosition.radiusLabel') }}: {{ accuracyRadius }} m</span>
      <input v-model.number="accuracyRadius" type="range" min="1" max="20" step="1" />
    </label>
    <div class="panel-title">{{ t('features.accuracyCircleStyle.colorLabel') }}</div>
    <ColorSwatches
      :colors="TRACKER_COLORS"
      :selected="trackerColor"
      label-prefix="features.accuracyCircleStyle.colors"
      show-selected-label
      @select="selectTrackerColor($event.value)"
    />
    <label class="panel-slider">
      <span>{{ t('features.accuracyCircleStyle.opacityLabel') }}: {{ trackerOpacity.toFixed(1) }}</span>
      <input v-model.number="trackerOpacity" type="range" min="0.1" max="1" step="0.1" />
    </label>
    <button class="panel-button panel-button--block" @click="tracking.toggle">
      {{ simulating ? t('features.simulatedPosition.stop') : t('features.simulatedPosition.start') }}
    </button>
    <div v-if="error" class="panel-error">{{ error }}</div>
  </FeatureScreen>
</template>
