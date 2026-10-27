<script setup>
// camera-projection-toggle: cameraProjection is a createView() option only
// (view.cameraProjection is read-only, there is no runtime setter). And
// destroyView + createView on the SAME venue fails in SDK 1.1.0 ("Cannot
// fetch model", createView never resolves). So switching projection changes
// the map key: FeatureScreen remounts VisioOneMap (destroyView +
// unloadVenue, then a fresh loadVenue + createView with the new
// cameraProjection). See docs/features/camera-projection-toggle.md.
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const viewRef = shallowRef(null)

const CAMERA_PROJECTIONS = ['perspective', 'orthographic']
const requestedProjection = ref('perspective')
const reportedProjection = ref(null)
const reloading = ref(true)

const viewOptions = computed(() => ({ cameraProjection: requestedProjection.value }))

function handleReady({ view }) {
  viewRef.value = view
  // Mirror what the SDK actually created, not what was requested.
  reportedProjection.value = view.cameraProjection
  reloading.value = false
}

function handleError() {
  reloading.value = false
}

function selectProjection(projection) {
  if (reloading.value || projection === reportedProjection.value) return
  reloading.value = true
  // The old view/venue are being torn down: drop every reference to them so
  // nothing keeps calling into a destroyed view until the new one is ready.
  viewRef.value = null
  requestedProjection.value = projection
}
</script>

<template>
  <FeatureScreen :view-options="viewOptions" :map-key="requestedProjection" @ready="handleReady" @error="handleError">
    <h2 class="panel-title">{{ t('features.cameraProjectionToggle.panelTitle') }}</h2>
    <div class="panel-segmented">
      <button
        v-for="projection in CAMERA_PROJECTIONS"
        :key="projection"
        type="button"
        class="panel-option"
        :class="{ 'panel-option--active': projection === reportedProjection }"
        :disabled="reloading"
        @click="selectProjection(projection)"
      >
        {{ t(`features.cameraProjectionToggle.projections.${projection}`) }}
      </button>
    </div>
    <div class="panel-entry">
      {{ reloading ? t('features.cameraProjectionToggle.reloading') : t('features.cameraProjectionToggle.hint') }}
    </div>
  </FeatureScreen>
</template>
