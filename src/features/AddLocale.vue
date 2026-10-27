<script setup>
// add-locale: venue.translator.addLocale(locale, resources) registers a
// brand-new locale at runtime, one never authored for this map in
// VisioMapEditor. Its resources are a generic i18next bundle, separate from
// the venue's own POI/floor/building/category translations: it can never
// make a POI/label name appear translated; it only affects the SDK's own
// predefined UI/navigation strings (if one of their keys is included) and
// any app-defined key. See docs/features/add-locale.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)

function handleReady({ venue }) {
  venueRef.value = venue
}

// One predefined SDK UI key ('search-for-anything') plus one app-only key
// ('welcome-message', meaningless to the SDK), added in the same call.
const ADD_LOCALE_ID = 'es'
const ADD_LOCALE_RESOURCES = {
  'search-for-anything': 'Buscar cualquier cosa',
  'welcome-message': 'Bienvenido al mapa',
}
const ADD_LOCALE_KEYS = Object.keys(ADD_LOCALE_RESOURCES)

const localeAdded = ref(false)
// key -> value read back via translator.translate() right after addLocale:
// the primary proof the round trip worked.
const translations = ref({})
const switching = ref(false)
const switched = ref(false)

function addSpanishLocale() {
  const venue = venueRef.value
  if (!venue || localeAdded.value) return

  venue.translator.addLocale(ADD_LOCALE_ID, ADD_LOCALE_RESOURCES)
  translations.value = Object.fromEntries(
    ADD_LOCALE_KEYS.map((key) => [key, venue.translator.translate(key, ADD_LOCALE_ID)]),
  )
  localeAdded.value = true
}

// Secondary proof: runtime-locale's venue.setCurrentLocale() call, so the
// SDK's own visible UI picks up the new 'es' strings. POI/label names do not
// change (this map only has default/en/fr authored).
async function switchToSpanish() {
  const venue = venueRef.value
  if (!venue || !localeAdded.value || switching.value) return
  switching.value = true
  try {
    await venue.setCurrentLocale(ADD_LOCALE_ID)
    switched.value = true
  } finally {
    switching.value = false
  }
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.addLocale.panelTitle') }}</h2>
    <div class="panel-list">
      <div v-for="key in ADD_LOCALE_KEYS" :key="key" class="panel-list__entry">
        <span class="panel-list__key">{{ key }}</span>
        <span class="panel-list__value">
          {{ localeAdded ? translations[key] : t('features.addLocale.notAddedYet') }}
        </span>
      </div>
    </div>
    <div class="panel-actions add-locale__actions">
      <button class="panel-button" :disabled="localeAdded" @click="addSpanishLocale">
        {{ t('features.addLocale.addButton') }}
      </button>
      <button class="panel-button panel-button--secondary" :disabled="!localeAdded || switching" @click="switchToSpanish">
        {{ switched ? t('features.addLocale.switchedButton') : t('features.addLocale.switchButton') }}
      </button>
    </div>
  </FeatureScreen>
</template>

<style scoped>
.add-locale__actions {
  margin-top: 14px;
}
</style>
