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

## Structure

- `src/components/VisioOneMap.vue` — wraps the VisioOne SDK lifecycle (`createVisioOne`, `loadVenue`, `createView`, teardown) as a Vue component. Emits `ready`, `error`, and `poi-click`, and exposes `visioOne`/`venue`/`view` via `defineExpose` for parent components that need direct SDK access (navigation, custom POIs, camera control, etc.).
- `src/App.vue` — reads the map configuration from environment variables and renders `VisioOneMap` full-screen.

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
