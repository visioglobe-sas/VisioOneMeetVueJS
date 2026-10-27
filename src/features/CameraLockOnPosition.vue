<script setup>
// camera-lock-on-position: view.lockCameraPositionOnTracking, a plain
// boolean on the view, keeps the camera on the tracked position. It only has
// a visible effect while tracking is on (the simulated position from
// src/composables/useSimulatedPosition.js); setting it beforehand is a
// documented no-op, not an exception.
//
// The SDK owns this state: allowTracking = true turns the lock on by itself,
// allowTracking = false turns it off, and a user pan/drag turns it off too.
// So the toggle mirrors view.lockCameraPositionOnTracking, re-read on
// 'trackingon'/'trackingoff'/'trackingchanged' (the events carry no value).
// See docs/features/camera-lock-on-position.md.
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import RouteFields from '../components/RouteFields.vue'
import { useSimulatedPosition } from '../composables/useSimulatedPosition'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

const CAMERA_LOCK_EVENTS = ['trackingon', 'trackingoff', 'trackingchanged']
const lockCameraOnPosition = ref(false)

function syncCameraLock() {
  lockCameraOnPosition.value = !!viewRef.value?.lockCameraPositionOnTracking
}

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
  for (const type of CAMERA_LOCK_EVENTS) view.addEventListener(type, syncCameraLock)
  syncCameraLock()
}

function toggleCameraLock(event) {
  const view = viewRef.value
  if (!view) return
  view.lockCameraPositionOnTracking = !view.lockCameraPositionOnTracking
  // The UI follows the 'trackingchanged' event; re-sync anyway (and force the
  // native checkbox back) so it never drifts if the setter was a no-op.
  syncCameraLock()
  if (event?.target) event.target.checked = lockCameraOnPosition.value
}

onBeforeUnmount(() => {
  for (const type of CAMERA_LOCK_EVENTS) viewRef.value?.removeEventListener(type, syncCameraLock)
})

const tracking = useSimulatedPosition(venueRef, viewRef)
const { originId, destinationId, accuracyRadius, simulating, error } = tracking
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.cameraLockOnPosition.panelTitle') }}</h2>
    <RouteFields v-model:from="originId" v-model:to="destinationId" />
    <label class="panel-slider">
      <span>{{ t('features.simulatedPosition.radiusLabel') }}: {{ accuracyRadius }} m</span>
      <input v-model.number="accuracyRadius" type="range" min="1" max="20" step="1" />
    </label>
    <button class="panel-button panel-button--block" @click="tracking.toggle">
      {{ simulating ? t('features.simulatedPosition.stop') : t('features.simulatedPosition.start') }}
    </button>
    <div v-if="error" class="panel-error">{{ error }}</div>
    <label class="panel-row camera-lock__row" :class="{ 'panel-row--disabled': !simulating }">
      <span class="panel-row__label">{{ t('features.cameraLockOnPosition.toggleLabel') }}</span>
      <input
        type="checkbox"
        class="panel-switch"
        :checked="lockCameraOnPosition"
        :disabled="!simulating"
        @change="toggleCameraLock"
      />
    </label>
  </FeatureScreen>
</template>

<style scoped>
.camera-lock__row {
  margin-top: 14px;
}
</style>
