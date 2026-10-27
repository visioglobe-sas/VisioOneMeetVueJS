<script setup>
// category-highlight: no dedicated "highlight by category" SDK method exists
// — built from primitives. venue.categories is the venue's full category
// list; a POI can carry several (poi.categories). Matching POIs are found
// with a plain filter, then each of their surfaces gets
// venue.updateSurface(surface, { color }). See docs/features/category-highlight.md.
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)

function handleReady({ venue }) {
  venueRef.value = venue
}

const HIGHLIGHT_COLOR = '#FF6B00'

// category.id is a raw internal identifier (a numeric string on the shared
// demo map, e.g. "1".."11"), not human-readable. The display name comes from
// venue.translator.translateCategory(); id is still what filtering uses.
const categories = computed(() => {
  const venue = venueRef.value
  if (!venue) return []
  return venue.categories.map((category) => ({
    id: category.id,
    label: venue.translator.translateCategory(category, venue.currentLocale).name || category.id,
  }))
})
const selectedCategoryId = ref(null)
// The POIs actually recolored by the current selection, so Clear (or
// picking a different category) reverts exactly those.
let highlightedPois = []

function poisInCategory(categoryId) {
  const venue = venueRef.value
  if (!venue) return []
  return venue.pois.filter((poi) => (poi.categories ?? []).some((category) => category.id === categoryId))
}

function selectCategory(category) {
  const venue = venueRef.value
  if (!venue) return

  // Clicking the already-selected category again just clears it.
  if (selectedCategoryId.value === category.id) {
    clearHighlight()
    return
  }

  // Only one category highlighted at a time — revert the previous one first.
  clearHighlight()

  // Not every POI has surfaces (some are point/marker-only) — those simply
  // don't visually change, which is expected.
  const pois = poisInCategory(category.id)
  pois.forEach((poi) => poi.surfaces.forEach((surface) => venue.updateSurface(surface, { color: HIGHLIGHT_COLOR })))

  highlightedPois = pois
  selectedCategoryId.value = category.id
}

function clearHighlight() {
  const venue = venueRef.value
  if (venue) {
    // 'initial' is the SDK's documented sentinel to restore a surface's
    // bundle-defined color (SurfaceUpdateOptions) — not the same as
    // `undefined`/omitting the key.
    highlightedPois.forEach((poi) => poi.surfaces.forEach((surface) => venue.updateSurface(surface, { color: 'initial' })))
  }
  highlightedPois = []
  selectedCategoryId.value = null
}
</script>

<template>
  <FeatureScreen @ready="handleReady">
    <h2 class="panel-title">{{ t('features.categoryHighlight.panelTitle') }}</h2>
    <div v-if="categories.length === 0" class="category-highlight__empty">
      {{ t('features.categoryHighlight.empty') }}
    </div>
    <div v-else class="category-highlight__chips">
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        class="category-highlight__chip"
        :class="{ 'category-highlight__chip--active': category.id === selectedCategoryId }"
        @click="selectCategory(category)"
      >
        {{ category.label }}
      </button>
    </div>
    <button
      class="panel-button panel-button--secondary panel-button--block"
      :disabled="!selectedCategoryId"
      @click="clearHighlight"
    >
      {{ t('features.categoryHighlight.clear') }}
    </button>
  </FeatureScreen>
</template>

<style scoped>
.category-highlight__empty {
  font-size: 0.9em;
  opacity: 0.8;
}

.category-highlight__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 40vh;
  overflow-y: auto;
  margin-bottom: 14px;
}

.category-highlight__chip {
  border-radius: 999px;
  border: 1px solid #057dbc;
  padding: 6px 14px;
  background: transparent;
  color: #fff;
  font-size: 0.9em;
  cursor: pointer;
}

.category-highlight__chip--active {
  background: #ff6b00;
  border-color: #ff6b00;
  font-weight: 600;
}
</style>
