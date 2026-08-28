# Add Locale

## Description

Registers a brand-new locale at runtime via `venue.translator.addLocale(locale, resources)` — one that was never authored for this map in VisioMapEditor. `resources` is a flat key/value map (`Translator.Resources`, `{ [key: string]: string }`), backed internally by a generic [i18next](https://www.i18next.com/) resource bundle. Reading a value back with `venue.translator.translate(key, locale)` right after `addLocale` is the reliable way to prove the locale was registered, independent of whether any of the SDK's own default UI is currently visible.

## SDK usage

```js
// Translator.addLocale(locale: string, resources: Resources): void
// Translator.translate(key: string, locale: string, context?: Context): string
// Resources = { [key: string]: string }

const resources = {
  'search-for-anything': 'Buscar cualquier cosa', // a predefined SDK UI key
  'welcome-message': 'Bienvenido al mapa',        // an arbitrary, app-defined key
}

venue.translator.addLocale('es', resources)

venue.translator.translate('search-for-anything', 'es') // => 'Buscar cualquier cosa'
venue.translator.translate('welcome-message', 'es')      // => 'Bienvenido al mapa'

// Optional: make the new locale "live" for any visible SDK UI/Navigation text
// (reuses the exact same call as the runtime-locale feature):
await venue.setCurrentLocale('es')
```

Both `addLocale` and `translate` are called directly on `venue.translator` — no bridge layer exists in this repo.

## Things to know

- **`addLocale` never touches POI/label/floor/building/category names.** Those come from a completely separate code path: they're parsed once, at load, from the published map's own JSON (content authored in VisioMapEditor) and exposed through `translatePOI`/`translateFloor`/`translateBuilding`/`translateCategory`. Adding a locale here can never make a POI's name appear translated, no matter which keys are added.
- **Only two kinds of key are meaningful.** (a) The SDK's own predefined UI/Navigation strings — see the full list in `Translator.addLocale`'s own TSDoc (UI keys like `'search-for-anything'`, `'go'`, `'cancel'`, `'start'`; Navigation keys like `'turnRight'`, `'changeFloor'`) — overriding one of these changes what the SDK's own default UI/Navigation displays, if visible. (b) Any other key you invent — the store is a fully generic key/value map, just as usable for the app's own strings that have no meaning to the SDK at all.
- **Not persisted.** Per its own TSDoc, a runtime-added locale "will not be saved once the application is reloaded" — it only lives in memory for the current session.
- **Complements, doesn't replace, [`runtime-locale`](./runtime-locale.md).** `runtime-locale` switches between locales already authored in VisioMapEditor (`en`/`fr` on the shared demo map), which does change POI/label text since those locales have real, map-authored content. `add-locale` instead creates a locale that was never authored anywhere; it can only ever affect UI/Navigation/custom-key strings, never POI/label/floor/building names.
- **`translate(key, locale)` is the reliable proof, not the SDK's visible UI.** If none of the SDK's own default UI parts using a given key happen to be on-screen (or their visibility was toggled off — see [`ui-part-visibility`](./ui-part-visibility.md)), the round trip is still verifiable directly, since `translate` reads straight back from the in-memory resource bundle regardless of what's rendered.

## Learn more

- [`runtime-locale`](./runtime-locale.md) — switching between locales already authored on the map; the complementary feature.
- `Translator.removeLocale(locale)` and `Translator.getLocale(locale)` exist on the same interface (undo an `addLocale`, and read back a whole locale's resources) — not built into this demo's UI, but useful to know about.
