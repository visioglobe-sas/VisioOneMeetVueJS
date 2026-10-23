# Configurable Map Server

## Description

Points the SDK at a different map server than Visioglobe's default SaaS (`https://mapserver.visioglobe.com/`), via `LoadOptions.baseURL`. Demonstrates that the demo map isn't hard-wired to Visioglobe's own infrastructure — relevant for clients with data-sovereignty or on-premise hosting requirements.

## SDK usage

`baseURL` is a `LoadOptions` field passed to `loadVenue()`, alongside the map hash:

```js
const venue = await visioOne.loadVenue(
  { vg_maphash: hash, baseURL: 'https://mapserver.visioglobe.com/' },
  loaderContainer,
)
```

It's read once, at load time — there's no setter to change it on an already-loaded venue/view. To point at a different server, the venue must be reloaded from scratch: `destroyView()` + `unloadVenue()` the old instance, then `loadVenue()`/`createView()` again with the new `baseURL`. In Vue, the simplest way is to change the `:key` of the component that owns the SDK lifecycle (here `src/components/VisioOneMap.vue`): Vue unmounts and remounts it, re-running its full SDK lifecycle. Drop every reference you keep to the old `venue`/`view` at that moment, since they are destroyed before the new ones are ready.

## Things to know

- An invalid or unreachable `baseURL` makes `loadVenue()` reject — always a plain, catchable `Error`, never a hang or an uncaught crash. The exact error depends on *why* it failed: a well-formed but non-existent hash rejects with the typed `VenueNotFoundError`; a `baseURL` that can't be reached at all (DNS failure, network error) falls through `loadVenue`'s internal error mapping and rejects with a generic `Error('Cannot load the venue')` instead. Either way, `error.message` is safe to show to a user. Also see `venue.baseURL` (readable post-load) — the same value is used internally to build asset URLs (e.g. `baseURL + 'icons/'`).
- **The SDK's own `showError()` renders at `z-index: 1000000`** inside the container you pass it. Unless the map's container creates a stacking context (this demo sets `isolation: isolate` on it, see the README), that value competes with your whole page and covers your own UI entirely. Even confined to the map, the error screen covers the map area for good — a reasonable default for a genuine, unexpected load failure, but hostile to a feature like this one whose whole point is to recover from a failed load and try again. This demo's `VisioOneMap` wrapper takes a `showSdkError` prop (default `true`) to opt out of calling `showError()` for this one screen, falling back to `isLoading = false` and this feature's own in-panel error message instead — see `src/components/VisioOneMap.vue`.
- Wrap the teardown (`destroyView()` + `unloadVenue()`) in a `try`/`catch`: a component that unmounts/remounts on every reload, as this feature does, should not surface a teardown failure as an unhandled rejection (`unloadVenue()` rejected on every call before SDK 1.0.9).
- There is no publicly reachable second Visioglobe map server this demo can point at to prove a *different* real deployment works — that would require standing up a self-hosted VisioMapServer, a separate infrastructure decision. Re-submitting the same default URL (or a syntactically different but equivalent one) still proves the parameter is genuinely wired through to `loadVenue`, since it's the exact value the SDK would otherwise use implicitly.
- **Bind `baseURL`/`authorizationToken` in camelCase, not kebab-case**, when passing them as props to a component that declares them in camelCase (`:baseURL="..."`, not `:base-url="..."`). Vue does not map `base-url` to a prop named `baseURL` (the `URL` part is not a kebab-case word boundary), so the value silently never reaches `loadVenue`.
