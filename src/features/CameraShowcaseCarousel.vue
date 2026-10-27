<script setup>
// camera-showcase-carousel: an endless camera tour (goToFloor then goToPOI,
// then a dwell) for kiosk/lobby screens. The loop lives here at screen
// level, not in the panel content, so closing the panel (needed to see the
// map) does not stop it and there is only ever one loop. Each Start/resume
// bumps `run`; a loop whose run id is stale, or whose awaited
// AnimationPromise reports isCanceled, exits. See
// docs/features/camera-showcase-carousel.md.
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'
import { CAROUSEL_STOP_IDS } from '../demoMap'
import { findPoi } from '../sdk/pois'

const { t } = useI18n()

// SDK instances: shallowRef, never ref() (see ResetView.vue).
const venueRef = shallowRef(null)
const viewRef = shallowRef(null)

function handleReady({ venue, view }) {
  venueRef.value = venue
  viewRef.value = view
}

const DWELL_MS = 3000
const RESUME_MS = 10000

const state = ref('stopped') // 'running' | 'paused' | 'stopped'
const stopIndex = ref(0)
let run = 0
let nextIndex = 0
let dwellTimer = null
let resumeTimer = null
// The AnimationPromise currently in flight (null between hops / while dwelling).
let animation = null

function stops() {
  const venue = venueRef.value
  if (!venue) return []
  return CAROUSEL_STOP_IDS.map((id) => findPoi(venue, id)).filter(Boolean)
}

function dwell(ms) {
  return new Promise((resolve) => {
    dwellTimer = setTimeout(resolve, ms)
  })
}

async function runCarousel(runId, startIndex) {
  const view = viewRef.value
  const pois = stops()
  if (!view || pois.length === 0) return
  const stillRunning = (current) => runId === run && !current?.isCanceled
  for (let index = startIndex % pois.length; ; index = (index + 1) % pois.length) {
    const poi = pois[index]
    stopIndex.value = index
    nextIndex = (index + 1) % pois.length
    // Documented order: bring the POI's floor up first, then frame the POI.
    if (poi.floor) {
      const floorAnimation = view.goToFloor(poi.floor, { duration: 800 })
      animation = floorAnimation
      await floorAnimation
      animation = null
      if (!stillRunning(floorAnimation)) return
    }
    const poiAnimation = view.goToPOI(poi, {
      duration: 2500,
      easing: 'easeInOutQuad',
      orientation: { heading: index * 90, pitch: 30 },
    })
    animation = poiAnimation
    await poiAnimation
    animation = null
    if (!stillRunning(poiAnimation)) return
    await dwell(DWELL_MS)
    if (runId !== run) return
  }
}

function start(startIndex = 0) {
  if (!viewRef.value || !venueRef.value) return
  clearTimeout(resumeTimer)
  clearTimeout(dwellTimer)
  state.value = 'running'
  runCarousel(++run, startIndex)
}

// Stop: just stop scheduling. The hop in flight (if any) is left to finish
// on its own and glides to its destination (cancel() would stop the camera
// where it is, mid-flight).
function stop() {
  run++
  clearTimeout(dwellTimer)
  clearTimeout(resumeTimer)
  state.value = 'stopped'
}

function toggle() {
  if (state.value === 'stopped') start(0)
  else stop()
}

// The SDK does not let a user drag interrupt its own camera animation, and
// fires no "camera moved by user" event, so the screen listens for
// pointerdown on the map itself (capture phase, forwarded by FeatureScreen
// as `map-pointerdown`) and pauses right away.
function handleMapPointerDown() {
  if (state.value === 'stopped') return
  const view = viewRef.value
  if (state.value === 'running') {
    run++
    clearTimeout(dwellTimer)
    state.value = 'paused'
    // Interrupt the in-flight animation in place: starting a new, zero-length
    // animation on the camera's current target/heading/pitch resolves the
    // running one with isCanceled = true and leaves the camera where it is.
    // (cancel() would also stop it in place; its public typing says it puts
    // the target in its final state, but measured live it does not.) Only
    // done while an animation is actually running — nothing to interrupt
    // during the dwell.
    if (view && animation) {
      const { camera } = view
      animation = null
      view.goToViewpoint(
        { positions: [camera.target] },
        { duration: 0, orientation: { heading: camera.heading, pitch: camera.pitch } },
      )
    }
  }
  // Every further touch while paused restarts the idle countdown.
  restartResumeTimer()
}

// Count the 10 s from the end of the gesture too, so a long drag is never
// cut short by the tour resuming under the user's finger.
function handleMapPointerUp() {
  if (state.value === 'paused') restartResumeTimer()
}

function restartResumeTimer() {
  clearTimeout(resumeTimer)
  resumeTimer = setTimeout(() => start(nextIndex), RESUME_MS)
}

const status = computed(() => {
  if (state.value === 'running') {
    return t('features.cameraShowcaseCarousel.running', {
      index: stopIndex.value + 1,
      total: CAROUSEL_STOP_IDS.length,
      id: CAROUSEL_STOP_IDS[stopIndex.value],
    })
  }
  if (state.value === 'paused') return t('features.cameraShowcaseCarousel.paused')
  return t('features.cameraShowcaseCarousel.stopped')
})

onBeforeUnmount(stop)
</script>

<template>
  <FeatureScreen @ready="handleReady" @map-pointerdown="handleMapPointerDown" @map-pointerup="handleMapPointerUp">
    <h2 class="panel-title">{{ t('features.cameraShowcaseCarousel.panelTitle') }}</h2>
    <div class="panel-actions">
      <button class="panel-button" @click="toggle">
        {{ state === 'stopped' ? t('features.cameraShowcaseCarousel.start') : t('features.cameraShowcaseCarousel.stop') }}
      </button>
    </div>
    <div class="panel-status">{{ status }}</div>
    <div class="panel-entry">{{ t('features.cameraShowcaseCarousel.hint') }}</div>
  </FeatureScreen>
</template>
