# Camera Showcase

## Description

An endless, automatic camera tour of the map, meant for kiosks and lobby screens: the camera glides from one POI to the next (switching floor and building as needed), pauses a few seconds on each, and loops forever. Touching the map pauses the tour immediately so the visitor's gesture wins; it resumes on its own from the next stop after 10 s without any touch.

It is built only on the SDK's camera animation methods, which all return an `AnimationPromise` (a `Promise<void>` with an `isCanceled` flag and a `cancel()` method):

- `view.goToFloor(floor, animationOptions?)`
- `view.goToPOI(poi, animationOptions?)`
- `view.goToViewpoint({ positions, targetAltitude? }, animationOptions?)` — used only to interrupt a running animation in place (see below).

`AnimationOptions` accepts `duration` (ms), `easing` (an [animejs Penner function name](https://animejs.com/documentation/#pennerFunctions), e.g. `'easeInOutQuad'`), `padding`, and `orientation: { heading?, pitch? }` (degrees, or `'initial'` to keep the current value).

## SDK usage

The loop. A run id lets Stop/pause invalidate a running loop; after every `await`, the loop exits if its run is stale or if the animation it awaited was interrupted (`isCanceled`):

```js
const STOP_IDS = ['B4-UL00-ID0009', 'B1-LL01-ID0152', 'B3-UL00-ID0064', 'B4-UL03-ID0015']
let run = 0
let currentAnimation = null // the AnimationPromise in flight, if any
let dwellTimer = null

async function runTour(myRun, startIndex) {
  const stops = STOP_IDS.map((id) => venue.pois.find((poi) => poi.id === id)).filter(Boolean)
  const stillRunning = (animation) => myRun === run && !animation.isCanceled

  for (let index = startIndex % stops.length; ; index = (index + 1) % stops.length) {
    const poi = stops[index]

    // Documented order: show the POI's floor first, then frame the POI.
    if (poi.floor) {
      currentAnimation = view.goToFloor(poi.floor, { duration: 800 })
      await currentAnimation
      if (!stillRunning(currentAnimation)) return
    }

    currentAnimation = view.goToPOI(poi, {
      duration: 2500,
      easing: 'easeInOutQuad',
      orientation: { heading: index * 90, pitch: 30 },
    })
    await currentAnimation
    if (!stillRunning(currentAnimation)) return
    currentAnimation = null

    await new Promise((resolve) => (dwellTimer = setTimeout(resolve, 3000)))
    if (myRun !== run) return
  }
}

function start(fromIndex = 0) {
  runTour(++run, fromIndex)
}

// Stop: only stop scheduling; the hop in flight finishes gliding on its own.
function stop() {
  run++
  clearTimeout(dwellTimer)
}
```

Pausing on touch. The SDK gives no "camera moved by the user" event, so listen for `pointerdown` on the element that contains the map (capture phase, so it fires before the SDK handles the gesture), then interrupt the running animation **in place** by starting a zero-length one on the camera's current state:

```js
mapContainer.addEventListener('pointerdown', () => {
  run++ // the loop exits at its next await
  clearTimeout(dwellTimer)
  if (currentAnimation) {
    const { camera } = view
    view.goToViewpoint(
      { positions: [camera.target] },
      { duration: 0, orientation: { heading: camera.heading, pitch: camera.pitch } },
    )
    currentAnimation = null
  }
  clearTimeout(resumeTimer)
  resumeTimer = setTimeout(() => start(nextIndex), 10000) // resume from the next stop
}, { capture: true })
```

When leaving the screen, call `stop()` and clear the resume timer.

## Things to know

- **`cancel()` stops the camera where it is.** It resolves the promise immediately (`isCanceled === true`) and leaves the camera in the state it is in at the moment of the call. The public typing of `cancel()` says it "puts the animation target in its final state": that wording is wrong, as live measurements on 1.1.0 show. This demo pauses with a zero-length `goToViewpoint` instead (see below); both stop the camera in place.
- **A new camera animation interrupts the running one.** The running animation's promise resolves with `isCanceled === true`, and the camera continues from wherever it was (no jump). That is why a loop must check `isCanceled` after every `await`, and why a zero-length `goToViewpoint` on the current `camera.target` makes a good "stop right here": measured live, the target moved ~1–2 m and the heading stayed within ~1°.
- **Pass the current `camera.heading` / `camera.pitch` as numbers** in that interrupting `goToViewpoint`. With `orientation: { heading: 'initial', pitch: 'initial' }` it also worked in our tests, but numeric values are the safest way to keep the orientation unchanged.
- **A user drag does not interrupt an SDK camera animation.** The animation keeps running to its end and the user fights the camera. There is no event for "the user moved the camera" either, so detect touches yourself (`pointerdown` on the map container, capture phase). Note that this also catches touches on the SDK's own on-map UI (search bar, floor selector), which is usually what you want for a kiosk.
- **`goToFloor` before `goToPOI`.** The SDK docs say the caller is responsible for calling `goToFloor(poi.floor)` before `goToPOI(poi)` when the POI is on another floor (otherwise the current floor/building stays active). With SDK 1.1.0, `goToPOI` alone did switch floors in our tests, but follow the documented order. `poi.floor` is optional in the typings — guard for it.
- **`orientation`** sets the camera's final heading/pitch in degrees; rotating the heading per stop (`index * 90`) gives the tour a more cinematic feel than always facing north.
- **Known SDK issue (1.1.0): the camera can break after a drag on an underground floor.** After `goToPOI` with `orientation: { heading: 90 or 180, pitch: 45 }` on a POI of an underground floor (`B1-LL01-ID0152` on the demo map: target altitude −2.3 m, camera clamped to `camera.minimumAltitude` = 10 m), one or two user drags turn `camera.heading` into `NaN` and `camera.pitch` into `0`, and the map renders black. It is not recoverable through `goToPOI` / `goToGlobal` / the `camera.heading` setter — only reloading the view helps. Same POI with `heading: 0, pitch: 45` or with `pitch: 30` did not reproduce in our tests, and it is not systematically reproducible. It is not caused by the tour itself (reproduced with a single `goToPOI` call and no tour running). That is why the demo uses `pitch: 30` for every stop.
- Timing on the demo map: a hop takes ~0.8 s (`goToFloor`) + ~2.5 s (`goToPOI`), so with a 3 s dwell the tour advances one stop every ~6.3 s.

## Learn more

- [Go To POI](goto-poi.md) — a single `goToPOI` call with orientation and padding.
- [Floor Selector](floor-selector.md) — `goToFloor` and the `currentfloorchanged` event.
