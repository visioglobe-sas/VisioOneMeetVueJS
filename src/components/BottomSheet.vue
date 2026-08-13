<script setup>
import { ref, watch } from 'vue'
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
</script>

<template>
  <div v-if="shouldRender" class="modal">
    <div class="modal__scrim" :class="{ 'modal__scrim--visible': visible }" @click="emit('close')"></div>
    <div class="modal__panel" :class="{ 'modal__panel--visible': visible }" @transitionend="onTransitionEnd">
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
}

.modal__panel--visible {
  transform: translateY(0);
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
