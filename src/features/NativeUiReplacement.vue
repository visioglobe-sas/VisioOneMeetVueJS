<script setup>
// native-ui-replacement: hide the SDK's own floor-selector widget with
// view.setUIPartVisible('floorSelector', false) and rely on the app's own
// picker instead (the same one as floor-selector, from
// src/composables/useFloorSelector.js). The toggle flips the SDK widget back
// on (default OFF) so both can be seen driving the same floor state; it
// never affects the app's own picker. See docs/features/native-ui-replacement.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import { useFloorSelector } from '../composables/useFloorSelector'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

const { buildings, floors, selectedBuildingId, currentFloorId, init, selectBuilding, selectFloor } =
  useFloorSelector(venueRef, viewRef)

const sdkFloorSelectorVisible = ref(false)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
  init()
  view.setUIPartVisible('floorSelector', sdkFloorSelectorVisible.value)
}

function toggleSdkFloorSelector() {
  const view = viewRef.value
  if (!view) return
  sdkFloorSelectorVisible.value = !sdkFloorSelectorVisible.value
  view.setUIPartVisible('floorSelector', sdkFloorSelectorVisible.value)
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.nativeUiReplacement.panelTitle') }}</h2>

    <!-- Building and floor buttons show the SDK's raw ids (map data). -->
    <div v-if="buildings.length > 1" class="floor-picker__buildings">
      <span class="floor-picker__buildings-label">{{ t('features.floorSelector.buildingLabel') }}</span>
      <button
        v-for="building in buildings"
        :key="building.id"
        class="floor-picker__building"
        :class="{ 'floor-picker__building--active': building.id === selectedBuildingId }"
        @click="selectBuilding(building)"
      >
        {{ building.id }}
      </button>
    </div>

    <div class="panel-choices">
      <button
        v-for="floor in floors"
        :key="floor.id"
        class="panel-choice"
        :class="{ 'panel-choice--active': floor.id === currentFloorId }"
        @click="selectFloor(floor)"
      >
        <span>{{ floor.id }}</span>
        <span v-if="floor.id === currentFloorId" class="panel-choice__badge">
          {{ t('features.floorSelector.currentBadge') }}
        </span>
      </button>
    </div>

    <label class="panel-row native-ui__toggle">
      <span class="panel-row__label">{{ t('features.nativeUiReplacement.toggleLabel') }}</span>
      <input type="checkbox" class="panel-switch" :checked="sdkFloorSelectorVisible" @change="toggleSdkFloorSelector" />
    </label>
  </FeatureScreen>
</template>

<style scoped>
.floor-picker__buildings {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.floor-picker__buildings-label {
  font-size: 0.85em;
  opacity: 0.7;
  margin-right: 4px;
}

.floor-picker__building {
  border-radius: 6px;
  border: none;
  padding: 6px 12px;
  background: #333;
  color: #fff;
  cursor: pointer;
}

.floor-picker__building--active {
  background: #057dbc;
  font-weight: 600;
}

.native-ui__toggle {
  margin-top: 14px;
}
</style>
