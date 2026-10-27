<script setup>
// custom-data: free business key/value strings (price, opening hours,
// product reference) attached to a POI in VisioMapEditor, read via
// venue.getPOICustomData(poi). The venue's CustomData cache starts empty
// ({}) and is never refreshed automatically on load: venue.refreshCustomData()
// must be awaited at least once first. "Load" does both in sequence. See
// docs/features/custom-data.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import { CUSTOM_DATA_MAP_HASH, CUSTOM_DATA_POI_ID, CUSTOM_DATA_SAMPLE_POI_IDS } from '../demoMap'
import { findPoi } from '../sdk/pois'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)

function handleReady({ venue }) {
  venueRef.value = venue
}

// This screen needs a map that actually has CustomData published: the shared
// demo map pointed at by VITE_VISIOONE_HASH has none. So, only here, the map
// hash is overridden with a dedicated map (CUSTOM_DATA_MAP_HASH, demoMap.js).

const placeId = ref(CUSTOM_DATA_POI_ID)
const loading = ref(false)
const notFound = ref(false)
// null = nothing loaded yet; [] = POI found but its CustomData is {}; a
// non-empty array otherwise.
const entries = ref(null)

// CUSTOM_DATA_SAMPLE_POI_IDS carry real, non-empty CustomData: offered as
// one-tap shortcuts.
function loadSample(id) {
  placeId.value = id
  loadCustomData()
}

async function loadCustomData() {
  const venue = venueRef.value
  if (!venue) return

  const targetId = placeId.value.trim()
  if (!targetId) return

  loading.value = true
  notFound.value = false
  entries.value = null

  try {
    // refreshCustomData() rejects (rather than resolving) when the venue has
    // no CustomData published yet — e.g. a 404 on its customData.json. That's
    // a normal "nothing to load yet" outcome, so it's swallowed and the
    // lookup proceeds against whatever the (possibly still-empty) cache holds.
    try {
      await venue.refreshCustomData()
    } catch (error) {
      console.warn('refreshCustomData failed (likely no CustomData published for this venue):', error)
    }

    const poi = findPoi(venue, targetId)
    if (!poi) {
      notFound.value = true
      return
    }

    // Synchronous, always returns {} (never null/undefined) — including
    // when the POI genuinely has no CustomData.
    const customData = venue.getPOICustomData(poi)
    entries.value = Object.entries(customData)
  } finally {
    loading.value = false
  }
}

function clear() {
  placeId.value = ''
  notFound.value = false
  entries.value = null
}
</script>

<template>
  <FeatureScreen :hash="CUSTOM_DATA_MAP_HASH" @ready="handleReady">
    <div class="custom-data__samples">
      <span class="custom-data__samples-label">{{ t('features.customData.samplesLabel') }}</span>
      <button
        v-for="sampleId in CUSTOM_DATA_SAMPLE_POI_IDS"
        :key="sampleId"
        type="button"
        class="custom-data__chip"
        :disabled="loading"
        @click="loadSample(sampleId)"
      >
        {{ sampleId }}
      </button>
    </div>
    <input
      v-model="placeId"
      class="panel-input"
      :placeholder="t('features.customData.placeholder')"
      @keyup.enter="loadCustomData"
    />
    <div class="panel-actions">
      <button class="panel-button" :disabled="loading" @click="loadCustomData">
        {{ loading ? t('features.customData.loading') : t('features.customData.load') }}
      </button>
      <button class="panel-button panel-button--secondary" @click="clear">{{ t('features.customData.clear') }}</button>
    </div>
    <div v-if="notFound" class="panel-error">{{ t('features.customData.notFound') }}</div>
    <div v-else-if="entries && entries.length === 0" class="panel-note">{{ t('features.customData.empty') }}</div>
    <div v-else-if="entries" class="panel-list">
      <div v-for="[key, value] in entries" :key="key" class="panel-list__entry">
        <span class="panel-list__key">{{ key }}</span>
        <span class="panel-list__value">{{ value }}</span>
      </div>
    </div>
  </FeatureScreen>
</template>

<style scoped>
.custom-data__samples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.custom-data__samples-label {
  font-size: 0.85em;
  opacity: 0.7;
  margin-right: 2px;
}

.custom-data__chip {
  border-radius: 999px;
  border: 1px solid #057dbc;
  padding: 4px 10px;
  background: transparent;
  color: #fff;
  font-size: 0.85em;
  cursor: pointer;
}

.custom-data__chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
