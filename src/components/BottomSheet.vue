<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  visible: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const { t } = useI18n()

const shouldRender = ref(props.visible)

watch(
  () => props.visible,
  (value) => {
    if (value) shouldRender.value = true
  },
)

function onTransitionEnd(event) {
  if (event.propertyName === 'transform' && !props.visible) {
    shouldRender.value = false
  }
}

// Swipe down to dismiss: dragging the panel down by more than
// DISMISS_DISTANCE_PX (or flicking it down fast) closes it; a shorter drag
// snaps back. Drags start anywhere on the panel except on form controls, so
// sliders, inputs and buttons keep working normally.
const DISMISS_DISTANCE_PX = 80
const DISMISS_VELOCITY_PX_PER_MS = 0.5
const INTERACTIVE_SELECTOR = 'input, button, select, textarea, a, label'

const dragOffset = ref(0)
const dragging = ref(false)
let dragStartY = 0
let dragStartTime = 0
let dragPointerId = null

function onPointerDown(event) {
  if (event.button !== 0 || event.target.closest(INTERACTIVE_SELECTOR)) return
  dragging.value = true
  dragPointerId = event.pointerId
  dragStartY = event.clientY
  dragStartTime = event.timeStamp
  dragOffset.value = 0
  event.currentTarget.setPointerCapture(event.pointerId)
}

function onPointerMove(event) {
  if (!dragging.value || event.pointerId !== dragPointerId) return
  dragOffset.value = Math.max(0, event.clientY - dragStartY)
}

function onPointerUp(event) {
  if (!dragging.value || event.pointerId !== dragPointerId) return
  const elapsed = Math.max(1, event.timeStamp - dragStartTime)
  const shouldDismiss =
    dragOffset.value > DISMISS_DISTANCE_PX || dragOffset.value / elapsed > DISMISS_VELOCITY_PX_PER_MS
  dragging.value = false
  dragPointerId = null
  if (shouldDismiss) emit('close')
  // The panel animates from where it was dropped: back up, or down and out.
  dragOffset.value = 0
}

function onPointerCancel() {
  dragging.value = false
  dragPointerId = null
  dragOffset.value = 0
}

// Escape closes the sheet too.
function onKeyDown(event) {
  if (event.key === 'Escape' && props.visible) emit('close')
}
window.addEventListener('keydown', onKeyDown)
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div v-if="shouldRender" class="modal">
    <div class="modal__scrim" :class="{ 'modal__scrim--visible': visible }" @click="emit('close')"></div>
    <div
      class="modal__panel"
      :class="{ 'modal__panel--visible': visible, 'modal__panel--dragging': dragging }"
      :style="dragOffset ? { transform: `translateY(${dragOffset}px)` } : null"
      @transitionend="onTransitionEnd"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <div class="modal__handle" aria-hidden="true"></div>
      <button class="modal__close" :aria-label="t('home.closeControls')" @click="emit('close')">&times;</button>
      <div class="modal__content">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.modal__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.modal__scrim--visible {
  opacity: 1;
}

.modal__panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #1c1c1e;
  border-radius: 12px 12px 0 0;
  padding: 16px;
  transform: translateY(100%);
  transition: transform 0.25s ease;
  /* Vertical drags on the panel belong to swipe-to-dismiss, not page scroll. */
  touch-action: none;
}

.modal__panel--visible {
  transform: translateY(0);
}

.modal__panel--dragging {
  transition: none;
}

.modal__handle {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 36px;
  height: 4px;
  margin-left: -18px;
  border-radius: 2px;
  background: #5a5a5e;
}

.modal__close {
  position: absolute;
  top: 8px;
  right: 12px;
  border: none;
  background: none;
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.modal__content {
  padding-top: 20px;
}
</style>
