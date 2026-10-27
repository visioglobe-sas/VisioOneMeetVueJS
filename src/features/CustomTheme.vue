<script setup>
// custom-theme: view.themes lists the registered 3D scene themes (read at
// runtime, never hardcoded) and view.setTheme(id) applies one — lighting
// only. view.accentColor / view.textAccentColor are plain settable
// properties that recolor the SDK's own UI buttons (POI card "Go", "Add a
// step"...) live; both are readable, so their initial values are read from
// the view on load. The SDK has no current-theme getter, so the selected
// theme is tracked here. See docs/features/custom-theme.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import ColorSwatches from '../components/ColorSwatches.vue'
import FeatureScreen from '../components/FeatureScreen.vue'
import { PALETTE } from '../colors'

const { t } = useI18n()

// view.setTheme() only changes the 3D scene lights, which are only rendered
// when the view is created with enableShadows: true — without it every theme
// is pixel-identical. Shadows are expensive, so only this screen opts in.
const VIEW_OPTIONS = { enableShadows: true }

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const viewRef = shallowRef(null)

const DEFAULT_THEME = 'day'
const ACCENT_COLORS = [
  { key: 'blue', value: PALETTE.blue },
  { key: 'red', value: PALETTE.red },
  { key: 'green', value: PALETTE.green },
  { key: 'purple', value: PALETTE.purple },
]
const TEXT_ACCENT_COLORS = [
  { key: 'white', value: PALETTE.white },
  { key: 'yellow', value: PALETTE.yellow },
  { key: 'black', value: PALETTE.dark },
]

const availableThemes = ref([])
const currentTheme = ref(DEFAULT_THEME)
const accentColor = ref(ACCENT_COLORS[0].value)
const textAccentColor = ref(TEXT_ACCENT_COLORS[0].value)
// The view's own accent colors at load, restored by Reset.
let initialAccentColor = ACCENT_COLORS[0].value
let initialTextAccentColor = TEXT_ACCENT_COLORS[0].value

function handleReady({ view }) {
  viewRef.value = view
  availableThemes.value = [...view.themes]
  initialAccentColor = view.accentColor || initialAccentColor
  initialTextAccentColor = view.textAccentColor || initialTextAccentColor
  accentColor.value = initialAccentColor
  textAccentColor.value = initialTextAccentColor
}

function selectTheme(themeId) {
  const view = viewRef.value
  if (!view) return
  // setTheme throws for an id that isn't in view.themes; only those are offered.
  view.setTheme(themeId)
  currentTheme.value = themeId
}

function selectAccentColor(value) {
  const view = viewRef.value
  if (!view) return
  view.accentColor = value
  accentColor.value = value
}

function selectTextAccentColor(value) {
  const view = viewRef.value
  if (!view) return
  view.textAccentColor = value
  textAccentColor.value = value
}

function reset() {
  selectTheme(DEFAULT_THEME)
  selectAccentColor(initialAccentColor)
  selectTextAccentColor(initialTextAccentColor)
}
</script>

<template>
  <FeatureScreen :view-options="VIEW_OPTIONS" :has-controls="!!viewRef" @ready="handleReady">
    <h2 class="panel-title">{{ t('features.customTheme.panelTitle') }}</h2>
    <!-- Theme buttons show the SDK's raw ids (map data). -->
    <div class="panel-title">{{ t('features.customTheme.themeLabel') }}</div>
    <div class="panel-segmented">
      <button
        v-for="themeId in availableThemes"
        :key="themeId"
        type="button"
        class="panel-option"
        :class="{ 'panel-option--active': themeId === currentTheme }"
        @click="selectTheme(themeId)"
      >
        {{ themeId }}
      </button>
    </div>
    <div class="panel-title">{{ t('features.customTheme.accentLabel') }}</div>
    <ColorSwatches
      :colors="ACCENT_COLORS"
      :selected="accentColor"
      label-prefix="features.customTheme.colors"
      @select="selectAccentColor($event.value)"
    />
    <div class="panel-title">{{ t('features.customTheme.textAccentLabel') }}</div>
    <ColorSwatches
      :colors="TEXT_ACCENT_COLORS"
      :selected="textAccentColor"
      label-prefix="features.customTheme.colors"
      @select="selectTextAccentColor($event.value)"
    />
    <div class="panel-actions">
      <button class="panel-button panel-button--secondary" @click="reset">{{ t('features.customTheme.reset') }}</button>
    </div>
    <div class="panel-entry">{{ t('features.customTheme.hint') }}</div>
  </FeatureScreen>
</template>
