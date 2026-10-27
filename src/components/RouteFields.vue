<script setup>
// Origin/destination POI id fields, shared by the itinerary and the
// tracked-position screens. Enter in the destination field emits `submit`.
import { useI18n } from 'vue-i18n'

const from = defineModel('from', { type: String, default: '' })
const to = defineModel('to', { type: String, default: '' })
const emit = defineEmits(['submit'])

const { t } = useI18n()
</script>

<template>
  <input v-model="from" class="route-fields__input" :placeholder="t('common.fromPlaceholder')" />
  <input
    v-model="to"
    class="route-fields__input"
    :placeholder="t('common.toPlaceholder')"
    @keyup.enter="emit('submit')"
  />
</template>

<style scoped>
.route-fields__input {
  width: 100%;
  box-sizing: border-box;
  border-radius: 6px;
  border: none;
  padding: 8px 10px;
  background: #222;
  color: #fff;
  margin-bottom: 10px;
}
</style>
