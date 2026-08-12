# Recommended hardware

These are practical guidelines for running this app, based on how the VisioOne SDK renders maps in the browser. Always validate on your actual target device before a large-scale rollout (e.g. kiosk deployments).

## What matters: the client device

This Vue app does almost no work itself — it serves a static JS bundle and delegates all 3D rendering and map logic to the VisioOne SDK, which runs entirely in the end user's browser. The SDK is a **Three.js**-based 3D engine, using **DRACO**-compressed geometry (decoded via WASM) and **WebGL2** rendering. The hardware to size for is the client device, not a server.

| Component | Minimum | Why |
|---|---|---|
| **GPU** | **WebGL2** support (most GPUs since ~2013: Intel HD 4000+, any mobile Adreno/Mali/Apple GPU since ~2015) | The SDK requires a `webgl2` context. A pre-WebGL2 integrated GPU will prevent the map from loading, not just slow it down. |
| **CPU** | Dual-core ≥ 1.5 GHz, reasonably recent (mobile: Snapdragon 660 / Apple A9 or newer) | DRACO (WASM) mesh decoding and the initial Three.js render pass are the heaviest steps, at load time; the app is light once the scene is established. |
| **RAM** | ~4 GB on the device (~150–400 MB used by the browser tab, depending on venue size) | Textures, geometries, and the Three.js scene are kept in memory for as long as the view is active. |
| **Network** | ~5–10 Mbps, reasonable latency | The critical JS is ~1.4 MB gzipped (plus ~285 KB for the loader) before first render, on top of the venue's own models/textures. |
| **Browser** | Recent Chrome/Edge/Safari/Firefox (last 2 major versions) with WebGL2 enabled | No WebGL1 fallback is provided. |

**In practice**: any smartphone, laptop, or tablet from the last 5–6 years will run this comfortably. The main risk isn't generic CPU/GPU power — it's a low-end or older integrated GPU without WebGL2 support, or a slow network on first load for large venues.

## Development / build machine

Trivial: Node.js + Vite, any machine able to run `npm run dev`/`build` (2 GB RAM is enough, no GPU required for the build).

## Hosting

The generated `dist/` folder is pure static output (HTML/JS/CSS) — any static host works (Netlify, Vercel, S3+CDN, etc.), with no server-side compute needed. Map data itself is not served by this app but by `mapserver.visioglobe.com` (or a custom `baseURL` if you host your own map server).
