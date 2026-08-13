<script setup>
import { computed, onMounted, ref } from 'vue'

const HANDLE_HEIGHT = 28

const sheetRef = ref(null)
const sheetHeight = ref(0)
const expanded = ref(false)
const dragging = ref(false)
const dragOffset = ref(null)

let startY = 0
let startOffset = 0
let moved = false

const collapsedOffset = computed(() => Math.max(sheetHeight.value - HANDLE_HEIGHT, 0))

const currentOffset = computed(() => {
  if (dragOffset.value !== null) return dragOffset.value
  return expanded.value ? 0 : collapsedOffset.value
})

onMounted(() => {
  sheetHeight.value = sheetRef.value?.offsetHeight ?? 0
})

function onPointerDown(event) {
  dragging.value = true
  moved = false
  startY = event.clientY
  startOffset = expanded.value ? 0 : collapsedOffset.value
  dragOffset.value = startOffset
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event) {
  if (!dragging.value) return
  const delta = event.clientY - startY
  if (Math.abs(delta) > 3) moved = true
  dragOffset.value = Math.min(Math.max(startOffset + delta, 0), collapsedOffset.value)
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  expanded.value = moved ? (dragOffset.value ?? 0) < collapsedOffset.value / 2 : !expanded.value
  dragOffset.value = null
}
</script>

<template>
  <div
    ref="sheetRef"
    class="bottom-sheet"
    :class="{ 'bottom-sheet--dragging': dragging }"
    :style="{ transform: `translateY(${currentOffset}px)` }"
  >
    <div
      class="bottom-sheet__handle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <span class="bottom-sheet__grip"></span>
    </div>
    <div class="bottom-sheet__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.bottom-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #1c1c1e;
  border-radius: 12px 12px 0 0;
  transition: transform 0.25s ease;
  touch-action: none;
  z-index: 10;
}

.bottom-sheet--dragging {
  transition: none;
}

.bottom-sheet__handle {
  display: flex;
  justify-content: center;
  padding: 10px 0;
  cursor: grab;
  touch-action: none;
}

.bottom-sheet__grip {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.4);
}

.bottom-sheet__content {
  padding: 0 16px 20px;
}
</style>
