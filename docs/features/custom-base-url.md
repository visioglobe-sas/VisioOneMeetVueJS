# Configurable Map Server

## Description

Points the SDK at a different map server than Visioglobe's default SaaS (`https://mapserver.visioglobe.com/`), via `LoadOptions.baseURL`. Demonstrates that the demo map isn't hard-wired to Visioglobe's own infrastructure — relevant for clients with data-sovereignty or on-premise hosting requirements.

## SDK usage

`baseURL` is a `LoadOptions` field passed to `loadVenue()`, alongside the map hash:

```js
const venue = await visioOne.loadVenue(
  { hash, baseURL: 'https://mapserver.visioglobe.com/' },
  loaderContainer,
)
```

It's read once, at load time — there's no setter to change it on an already-loaded venue/view. To point at a different server, the venue must be reloaded from scratch: `destroyView()` + `unloadVenue()` the old instance, then `loadVenue()`/`createView()` again with the new `baseURL`. In this app that's done by changing the `:key` on `<VisioOneMap>` (see `src/views/FeatureView.vue`), which forces Vue to unmount and remount the whole component — re-running its full SDK lifecycle.

## Things to know

- An invalid or unreachable `baseURL` makes `loadVenue()` reject — always a plain, catchable `Error`, never a hang or an uncaught crash. The exact error depends on *why* it failed: a well-formed but non-existent hash rejects with the typed `VenueNotFoundError`; a `baseURL` that can't be reached at all (DNS failure, network error) falls through `loadVenue`'s internal error mapping and rejects with a generic `Error('Cannot load the venue')` instead (confirmed by reading the SDK source — `VisioOneImplementation/Venue/VisioOne.ts`). Either way, `error.message` is safe to show to a user. Also see `venue.baseURL` (readable post-load) — the same value is used internally to build asset URLs (e.g. `baseURL + 'icons/'`).
- **The SDK's own `showError()` renders at `z-index: 1000000`**, well above anything a host app is likely to use — it will cover your own UI entirely (this app's back button and FAB included), with no way to interact with your app underneath. That's a reasonable default for a genuine, unexpected load failure, but is actively hostile to a feature like this one whose whole point is to recover from a failed load and try again. This demo's `VisioOneMap` wrapper takes a `showSdkError` prop (default `true`) to opt out of calling `showError()` for this one screen, falling back to `isLoading = false` and this feature's own in-panel error message instead — see `src/components/VisioOneMap.vue`.
- **`venue.unloadVenue()` throws internally on every call in this SDK version** (`TypeError: Cannot read properties of undefined (reading 'sdkStatsLogger')`) — reading the SDK source shows it deletes the venue's internal private-state entry and *then* tries to read from that same entry one line later, for a final stats-logging call. The actual unload (native/core teardown) already completed correctly before that point; only the trailing telemetry call fails. Harmless to your own app logic, but worth catching/swallowing explicitly if you call `unloadVenue()` yourself (as this demo does in `VisioOneMap.vue`'s teardown) — otherwise Vue (or your framework's async-hook error handling) will surface it as an unhandled rejection on every unmount, which gets noisy for a feature like this one that unmounts/remounts on every reload.
- There is no publicly reachable second Visioglobe map server this demo can point at to prove a *different* real deployment works — that would require standing up a self-hosted VisioMapServer, a separate infrastructure decision. Re-submitting the same default URL (or a syntactically different but equivalent one) still proves the parameter is genuinely wired through to `loadVenue`, since it's the exact value the SDK would otherwise use implicitly.
- **Bind `baseURL`/`authorizationToken` in camelCase, not kebab-case.** This app's own `<VisioOneMap :base-url="..." :authorization-token="...">` bindings never actually resolved to the component's declared props — Vue's runtime left them as literal, unmatched `"base-url"`/`"authorization-token"` attribute keys instead of camelizing them to match, so both props silently stayed `undefined` on every feature, in every prior release of this repo. Never noticed before because the underlying env vars (`VITE_VISIOONE_BASE_URL`/`VITE_VISIOONE_AUTH_TOKEN`) were always unset anyway, making "always undefined" indistinguishable from "correctly unset." This feature is the first to actually depend on a real, non-empty `baseURL` reaching the SDK, which is what surfaced it. Fixed here by binding `:baseURL`/`:authorizationToken` explicitly in camelCase — verified live by inspecting the mounted component's resolved `props` object in the browser.
