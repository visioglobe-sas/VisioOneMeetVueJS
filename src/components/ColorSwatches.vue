<script setup>
// Row of round color chips. `colors` is [{ key, value }], `selected` the
// active color value; each chip's accessible name is t(`${labelPrefix}.${key}`).
import { useI18n } from 'vue-i18n'

import { colorLuminance } from '../colors'

const props = defineProps({
  colors: { type: Array, required: true },
  selected: { type: String, default: null },
  labelPrefix: { type: String, required: true },
  showSelectedLabel: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const { t } = useI18n()

const isSelected = (color) => color.value.toLowerCase() === props.selected?.toLowerCase()
const selectedColor = () => props.colors.find(isSelected)
</script>

<template>
  <div class="color-swatches">
    <button
      v-for="color in colors"
      :key="color.key"
      type="button"
      class="color-swatches__chip"
      :class="{
        'color-swatches__chip--active': isSelected(color),
        'color-swatches__chip--dark': colorLuminance(color.value) < 0.05,
        'color-swatches__chip--light': colorLuminance(color.value) > 0.8,
      }"
      :style="{ background: color.value }"
      :aria-label="t(`${labelPrefix}.${color.key}`)"
      :aria-pressed="isSelected(color)"
      @click="emit('select', color)"
    />
  </div>
  <div v-if="showSelectedLabel && selectedColor()" class="color-swatches__label">
    {{ t(`${labelPrefix}.${selectedColor().key}`) }}
  </div>
</template>

<style scoped>
.color-swatches {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}

.color-swatches__chip {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 2px solid transparent;
  cursor: pointer;
}

.color-swatches__chip--active {
  border-color: #fff;
}

/* A near-black chip would be invisible on the dark panel without an outline. */
.color-swatches__chip--dark:not(.color-swatches__chip--active) {
  border-color: #666;
}

/* The active ring is white too, so a selected white chip gets an outer ring. */
.color-swatches__chip--light.color-swatches__chip--active {
  box-shadow: 0 0 0 2px #0094f0;
}

.color-swatches__label {
  font-size: 0.9em;
  opacity: 0.8;
  margin-bottom: 8px;
}
</style>
