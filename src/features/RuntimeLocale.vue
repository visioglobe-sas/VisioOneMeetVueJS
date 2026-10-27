<script setup>
// runtime-locale: venue.currentLocale (readonly) is the venue's displayed
// language for POI/label text and the SDK's own UI/navigation;
// venue.setCurrentLocale(locale) changes it and returns a Promise — the SDK
// re-renders everything itself once it resolves. See
// docs/features/runtime-locale.md.
//
// Only two locales are offered, not the full venue.translator.allLocales: on
// the shared demo map that list is ['default', 'en', 'fr'], and 'default' is
// a byte-identical duplicate of 'fr'.
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)

const RUNTIME_LOCALES = ['en', 'fr']
// venue.currentLocale is not reactive: mirrored here on load and after each switch.
const currentLocaleId = ref(null)
const switching = ref(false)

function handleReady({ venue }) {
  venueRef.value = venue
  currentLocaleId.value = venue.currentLocale
}

// 'default' == 'fr' content-wise on this demo map (see above): treated as
// "fr is active" so the panel highlights a choice on first load.
const activeLocaleId = computed(() => (currentLocaleId.value === 'default' ? 'fr' : currentLocaleId.value))

async function selectLocale(localeId) {
  const venue = venueRef.value
  if (!venue || switching.value || localeId === activeLocaleId.value) return
  switching.value = true
  try {
    await venue.setCurrentLocale(localeId)
    currentLocaleId.value = venue.currentLocale
  } finally {
    switching.value = false
  }
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.runtimeLocale.panelTitle') }}</h2>
    <div class="panel-choices">
      <button
        v-for="locale in RUNTIME_LOCALES"
        :key="locale"
        type="button"
        class="panel-choice"
        :class="{ 'panel-choice--active': locale === activeLocaleId }"
        :disabled="switching"
        @click="selectLocale(locale)"
      >
        <span>{{ t(`features.runtimeLocale.locales.${locale}`) }}</span>
        <span v-if="locale === activeLocaleId" class="panel-choice__badge">
          {{ t('features.runtimeLocale.currentBadge') }}
        </span>
      </button>
    </div>
  </FeatureScreen>
</template>
