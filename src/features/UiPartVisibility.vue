<script setup>
// ui-part-visibility: toggle one of the SDK's own default UI overlays with
// view.setUIPartVisible(uiPart, isVisible). The 5 UIPart values below are
// exact and case-sensitive (UIPart in the SDK typings, View.d.ts); no others
// exist. All start visible, the SDK's own default. See
// docs/features/ui-part-visibility.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const viewRef = shallowRef(null)

function handleReady({ view }) {
  viewRef.value = view
}

const UI_PARTS = ['floorSelector', 'navigation', 'poiDetails', 'search', 'userTracking']
const uiPartVisibility = ref(Object.fromEntries(UI_PARTS.map((part) => [part, true])))

function toggleUIPart(uiPart) {
  const view = viewRef.value
  if (!view) return
  const isVisible = !uiPartVisibility.value[uiPart]
  uiPartVisibility.value[uiPart] = isVisible
  view.setUIPartVisible(uiPart, isVisible)
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.uiPartVisibility.panelTitle') }}</h2>
    <label v-for="part in UI_PARTS" :key="part" class="panel-row">
      <span class="panel-row__label">{{ t(`features.uiPartVisibility.parts.${part}`) }}</span>
      <input type="checkbox" class="panel-switch" :checked="uiPartVisibility[part]" @change="toggleUIPart(part)" />
    </label>
  </FeatureScreen>
</template>
