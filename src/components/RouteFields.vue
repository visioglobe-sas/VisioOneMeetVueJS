<script setup>
// Origin/destination POI id fields, shared by the itinerary and the
// tracked-position screens (styled by src/styles/panel.css). Enter in the
// destination field emits `submit`.
import { useI18n } from 'vue-i18n'

const from = defineModel('from', { type: String, default: '' })
const to = defineModel('to', { type: String, default: '' })
const emit = defineEmits(['submit'])

const { t } = useI18n()
</script>

<template>
  <input v-model="from" class="panel-input" :placeholder="t('common.fromPlaceholder')" />
  <input
    v-model="to"
    class="panel-input"
    :placeholder="t('common.toPlaceholder')"
    @keyup.enter="emit('submit')"
  />
</template>

