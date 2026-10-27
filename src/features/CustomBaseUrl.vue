<script setup>
// custom-base-url: LoadOptions.baseURL is only read once, by loadVenue() —
// it cannot be changed on an already-loaded venue/view. So "Reload" doesn't
// call any SDK setter: it changes the map key, which makes FeatureScreen
// remount VisioOneMap (teardown: destroyView + unloadVenue, then loadVenue +
// createView again with the new baseURL). See docs/features/custom-base-url.md.
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

const DEFAULT_BASE_URL = 'https://mapserver.visioglobe.com/'
const baseURLInput = ref(import.meta.env.VITE_VISIOONE_BASE_URL || DEFAULT_BASE_URL)
const appliedBaseURL = ref(baseURLInput.value)
// Bumped on every Reload so the map remounts even when the URL is unchanged.
const reloadCount = ref(0)
const mapKey = computed(() => `${appliedBaseURL.value}#${reloadCount.value}`)
const error = ref(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
  error.value = null
}

// This screen deliberately triggers real load failures, so it opts out of
// the SDK's own error screen (show-sdk-error false) and shows the message in
// its panel instead.
function handleError(loadError) {
  error.value = loadError?.message || String(loadError)
}

function reload() {
  error.value = null
  // The old view/venue are being torn down: drop every reference to them
  // until the new map emits 'ready'.
  viewRef.value = null
  venueRef.value = null
  appliedBaseURL.value = baseURLInput.value.trim()
  reloadCount.value += 1
}
</script>

<template>
  <FeatureScreen
    :baseURL="appliedBaseURL"
    :map-key="mapKey"
    :show-sdk-error="false"
    @ready="handleReady"
    @error="handleError"
  >
    <input
      v-model="baseURLInput"
      class="panel-input"
      :placeholder="t('features.customBaseUrl.placeholder')"
      @keyup.enter="reload"
    />
    <div class="panel-actions">
      <button class="panel-button" @click="reload">{{ t('features.customBaseUrl.reload') }}</button>
    </div>
    <div v-if="error" class="panel-error">{{ t('features.customBaseUrl.error') }}: {{ error }}</div>
  </FeatureScreen>
</template>
