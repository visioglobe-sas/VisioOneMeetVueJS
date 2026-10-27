<script setup>
// explore-mode: drives the SDK's 3 building-exploration modes via the
// settable view.currentExploreMode property ('global' | 'building' |
// 'floor'). 'building' (opened buildings' floors shown as an exploded
// carousel) only has something to show once a building is open
// (view.currentBuilding defined). The active button follows the
// 'exploremodechanged' event, which also fires on the SDK's own
// auto-transition out of "building" mode on a map click. See
// docs/features/explore-mode.md.
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

const EXPLORE_MODES = ['global', 'building', 'floor']
const currentExploreMode = ref(null)

function handleExploreModeChanged(event) {
  currentExploreMode.value = event.currentExploreMode
}

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
  currentExploreMode.value = view.currentExploreMode
  view.addEventListener('exploremodechanged', handleExploreModeChanged)
}

async function selectExploreMode(mode) {
  const view = viewRef.value
  const venue = venueRef.value
  if (!view || mode === currentExploreMode.value) return

  // "building" mode has nothing to show if no building is open yet — open
  // the first one so the carousel effect is always one tap away.
  if (mode === 'building' && !view.currentBuilding) {
    const firstBuilding = venue?.venueLayout.buildings[0]
    if (firstBuilding) await view.goToBuilding(firstBuilding)
  }

  view.currentExploreMode = mode
}

onBeforeUnmount(() => viewRef.value?.removeEventListener('exploremodechanged', handleExploreModeChanged))
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.exploreMode.panelTitle') }}</h2>
    <div class="panel-segmented">
      <button
        v-for="mode in EXPLORE_MODES"
        :key="mode"
        type="button"
        class="panel-option"
        :class="{ 'panel-option--active': mode === currentExploreMode }"
        @click="selectExploreMode(mode)"
      >
        {{ t(`features.exploreMode.modes.${mode}`) }}
      </button>
    </div>
  </FeatureScreen>
</template>
