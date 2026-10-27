<script setup>
// html-overlay-marker: venue.createMarker() overlays a plain HTML element on
// the map at a WGS84 position, owned by an existing POI (the "anchor").
// Unlike a Label/Image it is not part of the 3D scene: it always faces the
// screen, is never hidden by 3D geometry and can receive clicks. Position:
// poiDisplayPosition (excluding our own badge, which gets appended to
// anchor.markers) plus a ~4 m offset. The SDK owns the element's
// position/transform/z-index and forces pointer-events:none at creation, so
// it's set back to 'auto' right after. Text updates are plain DOM edits
// (MarkerUpdateOptions only has position and isVisible). Only one badge at a
// time. See docs/features/html-overlay-marker.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import { ANCHOR_POI_ID } from '../demoMap'
import { findPoi, focusCameraOnPoi, poiDisplayPosition } from '../sdk/pois'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

// ~4 m in latitude and longitude.
const ANCHOR_OFFSET_DEGREES = 0.00004
const MARKER_STYLE =
  'background:#0B6BCB;color:#FFFFFF;font:600 14px sans-serif;padding:6px 12px;border-radius:14px;' +
  'white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer'

const anchorPoiId = ref(ANCHOR_POI_ID)
const text = ref(t('features.htmlOverlayMarker.defaultText'))
const markerVisible = ref(true)
const tapCount = ref(0)
// Single status line: { key, params, error } (error = shown in red).
const status = ref({ key: 'features.htmlOverlayMarker.none', params: {}, error: false })
// The SDK Marker instance is a plain local; its owner POI id is mirrored
// into a ref for the template.
let placedMarker = null
const placedMarkerPoiId = ref('')

function setStatus(key, params = {}, error = false) {
  status.value = { key, params, error }
}

function removeMarker() {
  const venue = venueRef.value
  // removeMarker throws "Provided marker is not registered" on a second call:
  // only call it while we still hold a reference. It also detaches the
  // element from the DOM.
  if (venue && placedMarker) venue.removeMarker(placedMarker)
  placedMarker = null
  placedMarkerPoiId.value = ''
  markerVisible.value = true
}

function handleMarkerClick(event) {
  // Don't let the tap fall through to the map (it would open the POI card of
  // whatever is underneath).
  event.stopPropagation()
  tapCount.value += 1
  setStatus('features.htmlOverlayMarker.tapped', { count: tapCount.value })
}

function placeMarker() {
  const venue = venueRef.value
  if (!venue) return

  const markerText = text.value.trim()
  if (!markerText) {
    setStatus('features.htmlOverlayMarker.textRequired', {}, true)
    return
  }

  const anchor = findPoi(venue, anchorPoiId.value.trim())
  if (!anchor) {
    setStatus('features.htmlOverlayMarker.poiNotFound', {}, true)
    return
  }

  // Ignore our own current badge, so re-placing doesn't stack the offset.
  const anchorPosition = poiDisplayPosition(anchor, [placedMarker])
  if (!anchorPosition) {
    setStatus('features.htmlOverlayMarker.poiNoPosition', {}, true)
    return
  }

  removeMarker()
  const position = {
    ...anchorPosition,
    latitude: anchorPosition.latitude + ANCHOR_OFFSET_DEGREES,
    longitude: anchorPosition.longitude + ANCHOR_OFFSET_DEGREES,
  }
  const element = document.createElement('div')
  element.textContent = markerText
  element.setAttribute('style', MARKER_STYLE)
  placedMarker = venue.createMarker({ poi: anchor, position, element })
  // The SDK forces pointer-events:none on the element at creation (and never
  // rewrites it afterwards): opt back in so the badge is clickable.
  element.style.pointerEvents = 'auto'
  element.addEventListener('click', handleMarkerClick)

  placedMarkerPoiId.value = anchor.id
  markerVisible.value = true
  tapCount.value = 0
  setStatus('features.htmlOverlayMarker.placedOn', { id: anchor.id })
  // A marker is only displayed while its POI's floor is shown.
  focusCameraOnPoi(viewRef.value, anchor)
}

function updateText() {
  if (!placedMarker) return

  const markerText = text.value.trim()
  if (!markerText) {
    setStatus('features.htmlOverlayMarker.textRequired', {}, true)
    return
  }
  // The marker's element is a live DOM node: no SDK call needed.
  placedMarker.element.textContent = markerText
  setStatus('features.htmlOverlayMarker.textUpdated')
}

function toggleVisibility() {
  const venue = venueRef.value
  if (!venue || !placedMarker) return

  const isVisible = !markerVisible.value
  venue.updateMarker(placedMarker, { isVisible })
  markerVisible.value = isVisible
  setStatus(isVisible ? 'features.htmlOverlayMarker.shown' : 'features.htmlOverlayMarker.hidden')
}

function handleRemove() {
  if (!placedMarker) return
  removeMarker()
  setStatus('features.htmlOverlayMarker.none')
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.htmlOverlayMarker.panelTitle') }}</h2>
    <input v-model="anchorPoiId" class="panel-input" :placeholder="t('features.htmlOverlayMarker.anchorIdPlaceholder')" />
    <input
      v-model="text"
      class="panel-input"
      :placeholder="t('features.htmlOverlayMarker.textPlaceholder')"
      @keyup.enter="placedMarkerPoiId ? updateText() : placeMarker()"
    />
    <div class="panel-actions">
      <button class="panel-button" @click="placeMarker">{{ t('features.htmlOverlayMarker.place') }}</button>
      <button class="panel-button" :disabled="!placedMarkerPoiId" @click="updateText">
        {{ t('features.htmlOverlayMarker.updateText') }}
      </button>
    </div>
    <div class="panel-actions">
      <button class="panel-button panel-button--secondary" :disabled="!placedMarkerPoiId" @click="toggleVisibility">
        {{ markerVisible ? t('features.htmlOverlayMarker.hide') : t('features.htmlOverlayMarker.show') }}
      </button>
      <button class="panel-button panel-button--secondary" :disabled="!placedMarkerPoiId" @click="handleRemove">
        {{ t('features.htmlOverlayMarker.remove') }}
      </button>
    </div>
    <div :class="status.error ? 'panel-error' : 'panel-entry'">{{ t(status.key, status.params) }}</div>
  </FeatureScreen>
</template>
