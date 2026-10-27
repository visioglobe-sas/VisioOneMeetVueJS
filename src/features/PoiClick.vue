<script setup>
// poi-click: show details for the POI(s) tapped on the map, from the view's
// 'poiclick' event (re-emitted as `poi-click` by VisioOneMap.vue). See
// docs/features/poi-click.md.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()

const panelOpen = ref(false)
// event.pois is an array because a single click can hit several overlapping
// POIs (e.g. a marker sitting on top of a surface) — see POIEvent in the SDK
// typings (@visioglobe/visioone/dist/src/VisioOne/View/Events/POIEvent.d.ts).
const clickedPois = ref([])

function poiName(poi) {
  return poi.labels?.[0]?.text || poi.id
}

function poiCategories(poi) {
  return (poi.categories ?? []).map((category) => category.id).join(', ')
}

function handlePOIClick(event) {
  clickedPois.value = event.pois ?? []
  panelOpen.value = true
}
</script>

<template>
  <!-- No FAB: the panel opens on a POI click. -->
  <FeatureScreen v-model:open="panelOpen" :has-controls="false" @poi-click="handlePOIClick">
    <template #overlay>
      <div v-if="!panelOpen && clickedPois.length === 0" class="poi-hint">
        {{ t('features.poiClick.hint') }}
      </div>
    </template>

    <h2 class="panel-title">{{ t('features.poiClick.panelTitle') }}</h2>
    <div v-for="poi in clickedPois" :key="poi.id" class="panel-entry">
      <div class="poi-click__name">{{ poiName(poi) }}</div>
      <div class="poi-click__meta">{{ t('features.poiClick.idLabel') }}: {{ poi.id }}</div>
      <div v-if="poi.floor" class="poi-click__meta">{{ t('features.poiClick.floorLabel') }}: {{ poi.floor.id }}</div>
      <div v-if="poi.categories?.length" class="poi-click__meta">
        {{ t('features.poiClick.categoriesLabel') }}: {{ poiCategories(poi) }}
      </div>
    </div>
  </FeatureScreen>
</template>

<style scoped>
.poi-hint {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 20px;
  margin: 0 auto;
  max-width: 320px;
  border-radius: 6px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  text-align: center;
  z-index: 10;
}

.poi-click__name {
  font-weight: 600;
  margin-bottom: 4px;
}

.poi-click__meta {
  font-size: 0.9em;
  opacity: 0.8;
}
</style>
