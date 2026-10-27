<script setup>
// custom-text-label: venue.createLabel() places free text (opening hours,
// price, zone name...) owned by an existing POI (the "anchor", no createPOI
// needed), at the anchor's position (poiDisplayPosition) nudged ~4 m so it
// doesn't overlap the map's own label. Color and size are restyled live with
// venue.updateLabel() — width AND height always sent together, since width
// alone also resets height to width. `rotation` is only part of
// LabelCreateOptions, not LabelUpdateOptions, so changing it removes the
// label and recreates it. Only one label at a time. See
// docs/features/custom-text-label.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import ColorSwatches from '../components/ColorSwatches.vue'
import FeatureScreen from '../components/FeatureScreen.vue'
import { PALETTE } from '../colors'
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
const LABEL_COLORS = [
  { key: 'red', value: PALETTE.red },
  { key: 'green', value: PALETTE.green },
  { key: 'blue', value: PALETTE.blue },
  { key: 'dark', value: PALETTE.dark },
]
const LABEL_SIZES = {
  small: { width: 10, height: 2 },
  medium: { width: 16, height: 3 },
  large: { width: 22, height: 4 },
}
const LABEL_SIZE_KEYS = Object.keys(LABEL_SIZES)
const LABEL_ROTATIONS = [0, 45, 90]

const anchorPoiId = ref(ANCHOR_POI_ID)
const text = ref(t('features.customTextLabel.defaultText'))
const color = ref(LABEL_COLORS[0].value)
const size = ref('medium')
const rotation = ref(0)
const errorKey = ref('')
// The SDK Label instance is a plain local; its owner POI id is mirrored into
// a ref for the template.
let placedLabel = null
const placedLabelPoiId = ref('')

function removeLabel() {
  const venue = venueRef.value
  // removeLabel throws "Provided label is not registered" on a second call:
  // only call it while we still hold a reference.
  if (venue && placedLabel) venue.removeLabel(placedLabel)
  placedLabel = null
  placedLabelPoiId.value = ''
}

function placeLabel() {
  const venue = venueRef.value
  if (!venue) return

  errorKey.value = ''
  // Empty text would make createLabel throw "Cannot create Label, text is required".
  const labelText = text.value.trim()
  if (!labelText) {
    errorKey.value = 'features.customTextLabel.textRequired'
    return
  }

  const anchor = findPoi(venue, anchorPoiId.value.trim())
  if (!anchor) {
    errorKey.value = 'features.customTextLabel.poiNotFound'
    return
  }

  // Ignore our own current label, so re-placing doesn't stack the offset.
  const anchorPosition = poiDisplayPosition(anchor, [placedLabel])
  if (!anchorPosition) {
    errorKey.value = 'features.customTextLabel.poiNoPosition'
    return
  }

  removeLabel()
  const position = {
    ...anchorPosition,
    latitude: anchorPosition.latitude + ANCHOR_OFFSET_DEGREES,
    longitude: anchorPosition.longitude + ANCHOR_OFFSET_DEGREES,
  }
  const { width, height } = LABEL_SIZES[size.value]
  placedLabel = venue.createLabel({
    poi: anchor,
    position,
    width,
    height,
    text: labelText,
    color: color.value,
    rotation: rotation.value,
  })
  placedLabelPoiId.value = anchor.id
  // A label only renders while its POI's floor is shown.
  focusCameraOnPoi(viewRef.value, anchor)
}

function selectColor(value) {
  color.value = value
  const venue = venueRef.value
  if (venue && placedLabel) venue.updateLabel(placedLabel, { color: value })
}

function selectSize(sizeKey) {
  size.value = sizeKey
  const venue = venueRef.value
  if (venue && placedLabel) venue.updateLabel(placedLabel, { ...LABEL_SIZES[sizeKey] })
}

function updateText() {
  const venue = venueRef.value
  if (!venue || !placedLabel) return

  const labelText = text.value.trim()
  if (!labelText) {
    errorKey.value = 'features.customTextLabel.textRequired'
    return
  }
  errorKey.value = ''
  venue.updateLabel(placedLabel, { text: labelText })
}

function selectRotation(value) {
  rotation.value = value
  const venue = venueRef.value
  if (!venue || !placedLabel) return

  // Not in LabelUpdateOptions: recreate with the same values + new rotation.
  const { poi, position, width, height, text: labelText, color: labelColor } = placedLabel
  venue.removeLabel(placedLabel)
  placedLabel = venue.createLabel({ poi, position, width, height, text: labelText, color: labelColor, rotation: value })
}

function handleRemove() {
  removeLabel()
  errorKey.value = ''
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.customTextLabel.panelTitle') }}</h2>
    <input v-model="anchorPoiId" class="panel-input" :placeholder="t('features.customTextLabel.anchorIdPlaceholder')" />
    <input
      v-model="text"
      class="panel-input"
      :placeholder="t('features.customTextLabel.textPlaceholder')"
      @keyup.enter="placedLabelPoiId ? updateText() : placeLabel()"
    />
    <div class="panel-title">{{ t('features.customTextLabel.colorLabel') }}</div>
    <ColorSwatches
      :colors="LABEL_COLORS"
      :selected="color"
      label-prefix="features.customTextLabel.colors"
      @select="selectColor($event.value)"
    />
    <div class="panel-title">{{ t('features.customTextLabel.sizeLabel') }}</div>
    <div class="panel-segmented text-label__options">
      <button
        v-for="sizeKey in LABEL_SIZE_KEYS"
        :key="sizeKey"
        type="button"
        class="panel-option"
        :class="{ 'panel-option--active': sizeKey === size }"
        @click="selectSize(sizeKey)"
      >
        {{ t(`features.customTextLabel.sizes.${sizeKey}`) }}
      </button>
    </div>
    <div class="panel-title">{{ t('features.customTextLabel.rotationLabel') }}</div>
    <div class="panel-segmented text-label__options">
      <button
        v-for="value in LABEL_ROTATIONS"
        :key="value"
        type="button"
        class="panel-option"
        :class="{ 'panel-option--active': value === rotation }"
        @click="selectRotation(value)"
      >
        {{ value }}°
      </button>
    </div>
    <div class="panel-actions">
      <button class="panel-button" @click="placeLabel">{{ t('features.customTextLabel.place') }}</button>
      <button class="panel-button" :disabled="!placedLabelPoiId" @click="updateText">
        {{ t('features.customTextLabel.updateText') }}
      </button>
      <button class="panel-button panel-button--secondary" :disabled="!placedLabelPoiId" @click="handleRemove">
        {{ t('features.customTextLabel.remove') }}
      </button>
    </div>
    <div v-if="errorKey" class="panel-error">{{ t(errorKey) }}</div>
    <div v-else-if="placedLabelPoiId" class="panel-entry">
      {{ t('features.customTextLabel.placedOn', { id: placedLabelPoiId }) }}
    </div>
    <div v-else class="panel-entry">{{ t('features.customTextLabel.none') }}</div>
  </FeatureScreen>
</template>

<style scoped>
.text-label__options {
  margin-bottom: 8px;
}
</style>
