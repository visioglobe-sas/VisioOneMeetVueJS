# VisioOne + Vue 3

A Vue 3 (Vite) application integrating the [VisioOne SDK](https://www.npmjs.com/package/@visioglobe/visioone) to display and explore indoor/outdoor 3D maps built with VisioMapEditor.

## Setup

```sh
npm install
cp .env.example .env
```

Edit `.env` and set `VITE_VISIOONE_HASH` to your map's hash, available from [my.visioglobe.com](https://my.visioglobe.com) (the map must have been "built" first).

```sh
npm run dev
```

## Features

Each feature below is a self-contained example screen. The bullet links go to a developer doc covering the actual SDK call(s) it demonstrates.

- [Reset View](docs/features/reset-view.md) — recenter the camera on the whole venue with `view.goToGlobal()`.
- [Real-Time Occupancy (Simulated Data)](docs/features/occupancy-simulated.md) — color a POI's surface to reflect an occupancy status via `venue.updateSurface`.
- [React to a POI Click](docs/features/poi-click.md) — read the `poiclick` event payload and display details for the tapped POI(s).
- [Go To POI](docs/features/goto-poi.md) — look up a POI by ID and center/zoom the camera on it with `view.goToPOI()`.
- [Floor / Building Selector](docs/features/floor-selector.md) — build a custom floor/building switcher on top of `venue.venueLayout` and `view.goToFloor()`/`view.goToBuilding()`.
- [Compute Navigation](docs/features/compute-navigation.md) — compute and display a route between two places with `venue.computeNavigation()`.
- [UI Part Visibility](docs/features/ui-part-visibility.md) — show/hide the SDK's default on-map widgets individually with `view.setUIPartVisible()`.
- [Simulated Position](docs/features/simulated-position.md) — animate a tracked position between two POIs with `view.injectTrackedPosition()`.
- [Camera Lock on Position](docs/features/camera-lock-on-position.md) — lock the camera's focus onto the currently tracked position via `view.lockCameraPositionOnTracking`.
- [Clickable Surface](docs/features/clickable-surface.md) — make a POI's surface interactive so the SDK swaps its color on hover/tap via `venue.updateSurface`.
- [Custom Data](docs/features/custom-data.md) — read business key/value data (price, hours, reference) attached to a POI via `venue.getPOICustomData()`.
- [Category Highlight](docs/features/category-highlight.md) — highlight every POI in a chosen category at once by combining `venue.categories`, `poi.categories`, and `venue.updateSurface()`.
- [Dynamic POI CRUD](docs/features/dynamic-poi-crud.md) — create, update and remove a POI at runtime with `venue.createPOI()`/`venue.updateLabel()`/`venue.removePOI()`, without republishing the map.

## Structure

- `src/components/VisioOneMap.vue` — wraps the VisioOne SDK lifecycle (`createVisioOne`, `loadVenue`, `createView`, teardown) as a Vue component. Emits `ready`, `error`, and `poi-click`, and exposes `visioOne`/`venue`/`view` via `defineExpose` for parent components that need direct SDK access (navigation, custom POIs, camera control, etc.).
- `src/App.vue` — renders the router view; navigation between the home menu and each feature screen goes through `vue-router`.
- `src/views/HomeView.vue` — the menu screen, listing the features registered in `src/features.js`.
- `src/views/FeatureView.vue` — hosts `VisioOneMap` for each feature screen, reads the map configuration from environment variables, and drives the SDK calls specific to the selected feature.

## Environment variables

| Variable                    | Required | Description                                                                 |
| ---------------------------- | -------- | ----------------------------------------------------------------------------- |
| `VITE_VISIOONE_HASH`         | yes      | The map hash from my.visioglobe.com.                                          |
| `VITE_VISIOONE_BASE_URL`     | no       | Server hosting the map data. Defaults to `https://mapserver.visioglobe.com/`. |
| `VITE_VISIOONE_AUTH_TOKEN`   | no       | JWT bearer token, required when the map server enforces authorization.        |

## Build

```sh
npm run build
```
