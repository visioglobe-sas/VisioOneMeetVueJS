<script setup>
// goto-poi: look a POI up by id, highlight its surfaces and frame it with
// view.goToPOI(). Deliberately not wired to map-click (that's poi-click's
// own screen). See docs/features/goto-poi.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import { PALETTE } from '../colors'
import { GOTO_POI_ID } from '../demoMap'
import { findPoi, focusCameraOnPoi } from '../sdk/pois'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

const poiId = ref(GOTO_POI_ID)
const notFound = ref(false)
// The POI currently highlighted by "Go" — kept so "Clear" can reset its
// surfaces even if the input has been edited since.
let highlightedPoi = null

function goToPoi() {
  const venue = venueRef.value
  const view = viewRef.value
  if (!venue || !view) return

  const targetId = poiId.value.trim()
  if (!targetId) return

  const poi = findPoi(venue, targetId)
  if (!poi) {
    notFound.value = true
    return
  }
  notFound.value = false

  clearHighlight()
  highlightedPoi = poi
  poi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: PALETTE.highlight }))
  focusCameraOnPoi(view, poi)
}

function clearHighlight() {
  if (!highlightedPoi) return
  const venue = venueRef.value
  if (venue) {
    // 'default' restores the view-wide selection color (SurfaceUpdateOptions).
    highlightedPoi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: 'default' }))
  }
  highlightedPoi = null
}

function clear() {
  clearHighlight()
  poiId.value = ''
  notFound.value = false
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <input v-model="poiId" class="panel-input" :placeholder="t('features.gotoPoi.placeholder')" @keyup.enter="goToPoi" />
    <div class="panel-actions">
      <button class="panel-button" @click="goToPoi">{{ t('features.gotoPoi.go') }}</button>
      <button class="panel-button panel-button--secondary" @click="clear">{{ t('features.gotoPoi.clear') }}</button>
    </div>
    <div v-if="notFound" class="panel-error">{{ t('features.gotoPoi.notFound') }}</div>
  </FeatureScreen>
</template>
