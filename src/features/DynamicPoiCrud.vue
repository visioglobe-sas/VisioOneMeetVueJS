<script setup>
// dynamic-poi-crud: venue.createPOI() makes a bare POI — a purely logical
// id/floor/categories container with no visual representation of its own —
// so a Label is attached right after via venue.createLabel(), at a position
// copied from an existing "anchor" POI. venue.updatePOI() can only change
// categories, so "editing" the POI's content means venue.updateLabel()-ing
// its label. venue.removePOI() cascades: it also removes the attached Label.
// Only one dynamic POI at a time. See docs/features/dynamic-poi-crud.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import { ANCHOR_POI_ID, NEW_POI_ID } from '../demoMap'
import { findPoi, poiDisplayPosition } from '../sdk/pois'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)

function handleReady({ venue }) {
  venueRef.value = venue
}

const DEFAULT_LABEL_WIDTH = 2

const newPoiId = ref(NEW_POI_ID)
const anchorPoiId = ref(ANCHOR_POI_ID)
const labelText = ref(t('features.dynamicPoiCrud.defaultText'))
const errorKey = ref('')
// The POI/Label SDK instances are plain locals, not refs; their id/text are
// mirrored into refs for the template.
let trackedPoi = null
let trackedLabel = null
const trackedPoiId = ref('')
const trackedLabelText = ref('')

function createDynamicPoi() {
  const venue = venueRef.value
  if (!venue || trackedPoi) return

  errorKey.value = ''

  const id = newPoiId.value.trim()
  const anchorId = anchorPoiId.value.trim()
  if (!id || !anchorId) return

  const anchor = findPoi(venue, anchorId)
  if (!anchor) {
    errorKey.value = 'features.dynamicPoiCrud.anchorNotFound'
    return
  }

  const position = poiDisplayPosition(anchor)
  if (!position) {
    errorKey.value = 'features.dynamicPoiCrud.anchorNoPosition'
    return
  }

  let poi
  try {
    poi = venue.createPOI({ id })
  } catch (error) {
    // POIAlreadyExistsError (see Venue/Errors/POIAlreadyExistsError in the
    // SDK typings) — a normal outcome for a duplicate ID, not a crash.
    console.warn('createPOI failed:', error)
    errorKey.value = 'features.dynamicPoiCrud.alreadyExists'
    return
  }

  const text = labelText.value.trim() || id
  const label = venue.createLabel({ poi, position, width: DEFAULT_LABEL_WIDTH, text })

  trackedPoi = poi
  trackedLabel = label
  trackedPoiId.value = poi.id
  trackedLabelText.value = label.text
}

function updateDynamicPoiText() {
  const venue = venueRef.value
  if (!venue || !trackedLabel) return

  const text = labelText.value.trim() || trackedPoiId.value
  venue.updateLabel(trackedLabel, { text })
  trackedLabelText.value = text
}

function removeDynamicPoi() {
  const venue = venueRef.value
  if (!venue || !trackedPoi) return

  // Cascades: the attached Label is removed from the view too.
  venue.removePOI(trackedPoi)
  trackedPoi = null
  trackedLabel = null
  trackedPoiId.value = ''
  trackedLabelText.value = ''
  errorKey.value = ''
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.dynamicPoiCrud.panelTitle') }}</h2>
    <input
      v-model="newPoiId"
      class="panel-input"
      :disabled="!!trackedPoiId"
      :placeholder="t('features.dynamicPoiCrud.newIdPlaceholder')"
    />
    <input
      v-model="anchorPoiId"
      class="panel-input"
      :disabled="!!trackedPoiId"
      :placeholder="t('features.dynamicPoiCrud.anchorIdPlaceholder')"
    />
    <input
      v-model="labelText"
      class="panel-input"
      :placeholder="t('features.dynamicPoiCrud.textPlaceholder')"
      @keyup.enter="trackedPoiId ? updateDynamicPoiText() : createDynamicPoi()"
    />
    <div class="panel-actions">
      <button class="panel-button" :disabled="!!trackedPoiId" @click="createDynamicPoi">
        {{ t('features.dynamicPoiCrud.create') }}
      </button>
      <button class="panel-button" :disabled="!trackedPoiId" @click="updateDynamicPoiText">
        {{ t('features.dynamicPoiCrud.updateText') }}
      </button>
      <button class="panel-button panel-button--secondary" :disabled="!trackedPoiId" @click="removeDynamicPoi">
        {{ t('features.dynamicPoiCrud.remove') }}
      </button>
    </div>
    <div v-if="errorKey" class="panel-error">{{ t(errorKey) }}</div>
    <div v-else-if="trackedPoiId" class="panel-entry">
      {{ t('features.dynamicPoiCrud.createdLabel') }}: <strong>{{ trackedPoiId }}</strong> — "{{ trackedLabelText }}"
    </div>
    <div v-else class="panel-note">{{ t('features.dynamicPoiCrud.none') }}</div>
  </FeatureScreen>
</template>
