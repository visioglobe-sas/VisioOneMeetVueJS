<script setup>
// clickable-surface: venue.updateSurface(surface, { isInteractive: true, ... })
// makes a POI's surface(s) SDK-managed clickable — the SDK itself swaps the
// displayed color on hover/tap using hoverColor/selectionColor, with no
// click-handling code on this side. Base building block for any
// "availability" use case (a free/occupied room, a parking spot). See
// docs/features/clickable-surface.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import { PALETTE } from '../colors'
import { CLICKABLE_SURFACE_POI_ID } from '../demoMap'
import { findPoi } from '../sdk/pois'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)

function handleReady({ venue }) {
  venueRef.value = venue
}

const placeId = ref(CLICKABLE_SURFACE_POI_ID)
const notFound = ref(false)
// The POI actually toggled — captured at Enable, not re-read from the input
// on Disable.
let clickablePoi = null

function setInteractive(poi, interactive) {
  const venue = venueRef.value
  if (!venue) return
  poi.surfaces.forEach((surface) =>
    venue.updateSurface(
      surface,
      interactive
        ? { isInteractive: true, color: PALETTE.free, hoverColor: PALETTE.soonBusy, selectionColor: PALETTE.busy }
        : // 'initial' / 'default' restore the map color and the view-wide
          // hover/selection colors (SurfaceUpdateOptions).
          { isInteractive: false, color: 'initial', hoverColor: 'default', selectionColor: 'default' },
    ),
  )
}

function enable() {
  const venue = venueRef.value
  if (!venue) return

  const targetId = placeId.value.trim()
  if (!targetId) return

  const poi = findPoi(venue, targetId)
  if (!poi) {
    notFound.value = true
    return
  }
  notFound.value = false

  clickablePoi = poi
  setInteractive(poi, true)
}

function disable() {
  if (clickablePoi) setInteractive(clickablePoi, false)
  clickablePoi = null
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <input
      v-model="placeId"
      class="panel-input"
      :placeholder="t('features.clickableSurface.placeholder')"
      @keyup.enter="enable"
    />
    <div class="panel-actions">
      <button class="panel-button" @click="enable">{{ t('features.clickableSurface.enable') }}</button>
      <button class="panel-button panel-button--secondary" @click="disable">
        {{ t('features.clickableSurface.disable') }}
      </button>
    </div>
    <div v-if="notFound" class="panel-error">{{ t('features.clickableSurface.notFound') }}</div>
  </FeatureScreen>
</template>
