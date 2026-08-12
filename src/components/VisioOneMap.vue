<script setup>
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import { createVisioOne } from '@visioglobe/visioone'

const props = defineProps({
  hash: { type: String, required: true },
  baseURL: { type: String, default: undefined },
  authorizationToken: { type: String, default: undefined },
  viewOptions: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['ready', 'error', 'poi-click'])

const loaderContainer = ref(null)
const viewContainer = ref(null)

const visioOne = shallowRef(null)
const venue = shallowRef(null)
const view = shallowRef(null)
const isLoading = ref(true)

function handlePOIClick(event) {
  emit('poi-click', event)
}

onMounted(async () => {
  visioOne.value = createVisioOne()

  try {
    venue.value = await visioOne.value.loadVenue(
      {
        hash: props.hash,
        baseURL: props.baseURL,
        authorizationToken: props.authorizationToken,
      },
      loaderContainer.value,
    )

    view.value = await visioOne.value.createView(viewContainer.value, venue.value, props.viewOptions)
    view.value.addEventListener('poiclick', handlePOIClick)
    isLoading.value = false

    emit('ready', { visioOne: visioOne.value, venue: venue.value, view: view.value })
  } catch (error) {
    visioOne.value.showError(error, loaderContainer.value)
    emit('error', error)
  }
})

onBeforeUnmount(async () => {
  if (view.value) {
    view.value.removeEventListener('poiclick', handlePOIClick)
    await visioOne.value.destroyView(view.value)
  }
  if (venue.value) {
    await visioOne.value.unloadVenue(venue.value)
  }
})

defineExpose({ visioOne, venue, view })
</script>

<template>
  <div class="visioone-map">
    <div ref="loaderContainer" class="visioone-map__loader" v-show="isLoading"></div>
    <div ref="viewContainer" class="visioone-map__view"></div>
  </div>
</template>

<style scoped>
.visioone-map {
  position: relative;
  width: 100%;
  height: 100%;
}

.visioone-map__loader,
.visioone-map__view {
  position: absolute;
  inset: 0;
}
</style>
