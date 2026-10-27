<script setup>
// reset-view: recenter the camera on the whole venue with view.goToGlobal().
// See docs/features/reset-view.md.
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()

// shallowRef, not ref: `venue`/`view` are VisioOne SDK class instances. A
// deep ref() would wrap every nested object (POIs, Surfaces, Floors...) in a
// Vue reactive Proxy, and the SDK checks object identity internally — a
// proxied Surface/Floor/POI passed back into updateSurface/goToFloor/
// computeNavigation is never === the real instance the SDK registered,
// causing SurfaceNotFoundError/FloorNotFoundError/POINotFoundError/
// BuildingNotFoundError. Every feature screen holds them the same way.
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

function resetView() {
  viewRef.value?.goToGlobal()
}
</script>

<template>
  <FeatureScreen :has-controls="!!viewRef" @ready="handleReady">
    <button class="panel-button panel-button--block" @click="resetView">
      {{ t('features.resetView.title') }}
    </button>
  </FeatureScreen>
</template>
