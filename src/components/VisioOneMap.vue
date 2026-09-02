<script setup>
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'
import { createVisioOne } from '@visioglobe/visioone'

const props = defineProps({
  hash: { type: String, required: true },
  baseURL: { type: String, default: undefined },
  authorizationToken: { type: String, default: undefined },
  viewOptions: { type: Object, default: () => ({}) },
  // The SDK's own showError() renders at z-index 1000000 -- far above this
  // app's top-bar/FAB/BottomSheet, permanently blocking them. Fine (and
  // desired) for every other feature, where a load failure is never
  // expected. custom-base-url deliberately triggers real load failures as
  // part of its normal demo loop and needs to stay interactive afterwards,
  // so it opts out and relies on its own panel error message instead. See
  // docs/features/custom-base-url.md.
  showSdkError: { type: Boolean, default: true },
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
    if (props.showSdkError) {
      visioOne.value.showError(error, loaderContainer.value)
    } else {
      isLoading.value = false
    }
    emit('error', error)
  }
})

onBeforeUnmount(async () => {
  // The SDK's own unloadVenue() throws on every call in this SDK version --
  // it deletes the venue's internal private-state entry, then still reads
  // from that same entry one line later for a final stats-logging call.
  // The actual unload already completed correctly before that point; only
  // the trailing telemetry call fails. Harmless, but unmounting/remounting
  // VisioOneMap on every reload (as custom-base-url does via :key) would
  // otherwise spam this as an unhandled rejection on every reload. See
  // docs/features/custom-base-url.md.
  try {
    if (view.value) {
      view.value.removeEventListener('poiclick', handlePOIClick)
      await visioOne.value.destroyView(view.value)
    }
    if (venue.value) {
      await visioOne.value.unloadVenue(venue.value)
    }
  } catch (error) {
    console.warn('VisioOneMap teardown error (safe to ignore during a reload):', error)
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
