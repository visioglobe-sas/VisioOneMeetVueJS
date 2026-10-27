// Simulated tracked position, shared by simulated-position,
// camera-lock-on-position, accuracy-circle-style and geofencing: walks a dot
// + accuracy circle back and forth between two POI ids via
// view.injectTrackedPosition(). A POI has no lat/lng field of its own:
// poiDisplayPosition (src/sdk/pois.js) reads it off the POI's label, image,
// marker or surface. See docs/features/simulated-position.md.
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { TRACKING_FROM, TRACKING_TO } from '../demoMap'
import { findPoi, poiDisplayPosition } from '../sdk/pois'

const POSITION_INTERVAL_MS = 150
// Fraction of the origin->destination segment advanced per tick (~150ms *
// 1/0.02 ticks = ~7.5s one-way, then back), not a real speed/time model.
const POSITION_STEP = 0.02

function lerpPosition(from, to, progress) {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * progress,
    longitude: from.longitude + (to.longitude - from.longitude) * progress,
    altitude: (from.altitude ?? 0) + ((to.altitude ?? 0) - (from.altitude ?? 0)) * progress,
  }
}

// Hooks:
//   onStart()        after allowTracking, before the first inject (e.g. to
//                    (re)apply the accuracy circle style).
//   onTick(position) after each inject, before the position advances (e.g.
//                    a geofence check).
export function useSimulatedPosition(venueRef, viewRef, { radius = 5, onStart, onTick } = {}) {
  const { t } = useI18n()

  const originId = ref(TRACKING_FROM)
  const destinationId = ref(TRACKING_TO)
  const error = ref('')
  const accuracyRadius = ref(radius)
  const simulating = ref(false)

  let timer = null
  // Resolved at Start, not re-read from the input fields on every tick.
  let origin = null
  let destination = null
  let progress = 0
  let direction = 1

  function tick() {
    const view = viewRef.value
    if (!view || !origin || !destination) return

    const position = lerpPosition(origin, destination, progress)
    view.injectTrackedPosition({
      position,
      // Re-read live on every tick: moving the slider while the simulation
      // runs changes the radius on the next tick, no restart needed.
      precisionCircleRadius: accuracyRadius.value,
    })
    onTick?.(position)

    progress += POSITION_STEP * direction
    if (progress >= 1) {
      progress = 1
      direction = -1
    } else if (progress <= 0) {
      progress = 0
      direction = 1
    }
  }

  // Returns whether the simulation actually started.
  function start() {
    const view = viewRef.value
    if (!view) return false

    const fromId = originId.value.trim()
    const toId = destinationId.value.trim()
    if (!fromId || !toId) return false

    const from = poiDisplayPosition(findPoi(venueRef.value, fromId))
    const to = poiDisplayPosition(findPoi(venueRef.value, toId))
    if (!from || !to) {
      error.value = t('features.simulatedPosition.notFound')
      return false
    }
    error.value = ''

    origin = from
    destination = to
    progress = 0
    direction = 1

    // Mandatory before the first injectTrackedPosition call, or it throws —
    // see PositionTrackerOptions/View.allowTracking in the SDK typings. Set
    // once per run, never per tick: every `allowTracking = true` also forces
    // lockCameraPositionOnTracking back to true (re-locking the camera).
    if (!view.allowTracking) view.allowTracking = true
    onStart?.()
    simulating.value = true
    tick()
    timer = setInterval(tick, POSITION_INTERVAL_MS)
    return true
  }

  function stop() {
    clearInterval(timer)
    timer = null
    origin = null
    destination = null
    // No dedicated "stop tracking" call in the SDK — allowTracking = false is
    // what removes the marker/accuracy circle from the map. It also forces the
    // camera lock off and fires 'trackingoff'.
    if (viewRef.value) viewRef.value.allowTracking = false
    simulating.value = false
  }

  function toggle() {
    if (simulating.value) stop()
    else start()
  }

  onBeforeUnmount(() => clearInterval(timer))

  return { originId, destinationId, error, accuracyRadius, simulating, start, stop, toggle }
}
