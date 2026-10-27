<script setup>
// 3d-icon-marker: venue.createImage() places an Image — a picture sized in
// meters, living in the 3D scene — owned by an existing POI (the "anchor",
// no createPOI needed) at that POI's own position (poiDisplayPosition).
// orientationType picks how it behaves relative to the camera: 'fixed' (flat
// on the ground, fixed heading), 'flat' (flat on the ground, turning to face
// the camera) or 'facing' (always camera-facing billboard). Changing it
// while an image is placed goes through venue.updateImage() live. Only one
// image at a time: placing again removes the previous one first. See
// docs/features/3d-icon-marker.md.
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

// 96x96 PNG (blue disc + white star), inlined as a data URL.
const ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAACBklEQVR42u3dWW4CMRBFUVbLarOn5JsIqRlsv6FuSfmE0O+IwS7bfbtR1GXdf34/+qMOhg2KcehgGIU+HsMt+DEQ7sHXQqQFXwWRHn4sQkvwkRCt4dsjtAdvDTEtfCuEqeFbIAgv/H/NQzAKfx6CYfhzEIzD70cQf+FFAGxFAEAIEBJ+J4LB7+04gKUIAAgBTEackQBfI4SG34MAgBDAaMIrHuAjBACEAGZTvhUAbyEAIAQwbHrUALyEAAAAcwGMe68V4V8iHAjJHeAI7mqAb0oNcOK1vwYgCP+di1E/334EMcDVRSmewx5gd60COPk6K94Bzy7u1OP4CAqrNQCCQdJ4gAcE0Uh1dPgrASYirB0Ri+dsRoa/A6AdYt+ckNksZn3wpwDSIc7NiprP69cFrwJwBdH3BUo6YLlN+qI2ZGZ7EgAA+AgqD99/ueKA8K0Q0veAxSMk7v+tQnABULQrvQZhQgBVv9gCQb00cXVoUQgOa0MBEALsCitvFlSEMBpAvT9gd0g5TRgATAGMe8Ru/ydul+TJULIBNiGMBlDvlFcE4rkGSISgCsICwOG0FGUIuQDCdaM121ydTs1S/wrJDP8gQN3pu44nJzo1RXLC56h6Ts4FAAROUCd8ELiLBuGDwJ2UCB8E7qhH8BMR4orgQZgdfjJEbRE8ELODd8KgBBjUQRSKuqo/fm7G7BpJ/VcAAAAASUVORK5CYII='
const ICON_SIZE_METERS = 6
const ICON_ORIENTATIONS = ['fixed', 'flat', 'facing']

const anchorPoiId = ref(ANCHOR_POI_ID)
const orientation = ref('facing')
const errorKey = ref('')
// The SDK Image instance is a plain local; its owner POI id is mirrored into
// a ref for the template.
let placedIcon = null
const placedIconPoiId = ref('')

function removeIcon() {
  const venue = venueRef.value
  if (venue && placedIcon) venue.removeImage(placedIcon)
  placedIcon = null
  placedIconPoiId.value = ''
}

function placeIcon() {
  const venue = venueRef.value
  if (!venue) return

  errorKey.value = ''
  const anchor = findPoi(venue, anchorPoiId.value.trim())
  if (!anchor) {
    errorKey.value = 'features.iconMarker3d.poiNotFound'
    return
  }

  // Ignore our own current image, if any (it sits at the same spot anyway).
  const position = poiDisplayPosition(anchor, [placedIcon])
  if (!position) {
    errorKey.value = 'features.iconMarker3d.poiNoPosition'
    return
  }

  removeIcon()
  placedIcon = venue.createImage({
    poi: anchor,
    position,
    width: ICON_SIZE_METERS,
    height: ICON_SIZE_METERS,
    url: ICON_DATA_URL,
    orientationType: orientation.value,
  })
  placedIconPoiId.value = anchor.id
  // An image on an indoor POI only renders while that POI's floor is shown,
  // which isn't the case in the default global view.
  focusCameraOnPoi(viewRef.value, anchor)
}

function selectOrientation(orientationType) {
  orientation.value = orientationType
  const venue = venueRef.value
  if (venue && placedIcon) venue.updateImage(placedIcon, { orientationType })
}

function handleRemove() {
  removeIcon()
  errorKey.value = ''
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.iconMarker3d.panelTitle') }}</h2>
    <input
      v-model="anchorPoiId"
      class="panel-input"
      :placeholder="t('features.iconMarker3d.anchorIdPlaceholder')"
      @keyup.enter="placeIcon"
    />
    <div class="panel-title">{{ t('features.iconMarker3d.orientationLabel') }}</div>
    <div class="panel-segmented icon-marker__orientations">
      <button
        v-for="option in ICON_ORIENTATIONS"
        :key="option"
        type="button"
        class="panel-option"
        :class="{ 'panel-option--active': option === orientation }"
        @click="selectOrientation(option)"
      >
        {{ t(`features.iconMarker3d.orientations.${option}`) }}
      </button>
    </div>
    <div class="panel-actions">
      <button class="panel-button" @click="placeIcon">{{ t('features.iconMarker3d.place') }}</button>
      <button class="panel-button panel-button--secondary" :disabled="!placedIconPoiId" @click="handleRemove">
        {{ t('features.iconMarker3d.remove') }}
      </button>
    </div>
    <div v-if="errorKey" class="panel-error">{{ t(errorKey) }}</div>
    <div v-else-if="placedIconPoiId" class="panel-entry">
      {{ t('features.iconMarker3d.placedOn', { id: placedIconPoiId }) }}
    </div>
    <div v-else class="panel-entry">{{ t('features.iconMarker3d.none') }}</div>
  </FeatureScreen>
</template>

<style scoped>
.icon-marker__orientations {
  margin-bottom: 8px;
}
</style>
