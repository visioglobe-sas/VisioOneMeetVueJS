# Runtime Locale

## Description

Switches the language the map displays — POI/label text, and any current UI/Navigation — while the venue stays loaded, without reloading the page or republishing the map. It's built entirely on the venue-level locale API: `venue.currentLocale` (the venue's current locale, readonly) and `venue.setCurrentLocale(locale)` (changes it). No manual re-fetch of POI data is needed: per the SDK's own TSDoc, the SDK re-renders labels and UI itself once the locale changes.

## SDK usage

```js
// Venue.currentLocale: string (readonly)
// Venue.setCurrentLocale(locale: string): Promise<void>
//   "Labels will be displayed with 'text' field corresponding to their POI's
//   LocaleEntry when it exists, otherwise the Label 'text' will be empty.
//   When a View exists, each UI item (and the current Navigation) will use
//   this locale to be displayed." — Venue.ts

const current = venue.currentLocale

await venue.setCurrentLocale('fr')
// venue.currentLocale is now 'fr'; POI/label text and any visible UI/
// Navigation have already been re-rendered by the SDK — nothing else to call.
```

The list of locales actually available for a given venue is `venue.translator.allLocales: string[]` (`Translator.allLocales`) — populated from whatever locales were authored for that map in VisioMapEditor.

## Things to know

- **`setCurrentLocale` is async.** It returns a `Promise<void>`, not a synchronous setter — `await` it (or handle it as a promise) before relying on `venue.currentLocale` reflecting the new value.
- **`venue.currentLocale` is a plain readonly property, not an observable/event.** It doesn't push change notifications on its own; if your UI needs to reflect the active locale, read it once after load and again after each `setCurrentLocale()` call resolves — there's no dedicated "locale changed" event to subscribe to instead.
- **`allLocales` never includes `'default'`.** The SDK's `Translator.allLocales` getter explicitly filters the `'default'` key out of the map's underlying locale resources (confirmed by reading the SDK's own source, `Translator.parseLocales`) — so on the shared demo map behind this repo, `allLocales` is `['en', 'fr']`, not three entries. `'default'` is nonetheless a working value for `setCurrentLocale('default')`, and on this map it turned out to be a byte-identical duplicate of `'fr'` (both French) — confirmed by comparing the published map payload. More generally, don't assume every entry in `allLocales` represents a genuinely different language for a given map; an integrator building a language picker off this list should de-duplicate content, not just locale codes, or at least verify per-map before presenting every code as its own option.
- A locale that has no `LocaleEntry` for a given POI falls back to the default locale's entry (per `Translator.translatePOI`'s own TSDoc) or, failing that, to an empty string — not an error. This fallback is silent and per-item: live-tested on the shared demo map, `venue.currentLocale` correctly flips to `'fr'` and stays there, but several elements (a sampled POI's name/description, its category label, even the SDK's own default UI panel strings like "Close"/"Go") kept rendering their English text after the switch — those particular entries simply have no distinct `'fr'` content on this map and silently fall back, rather than erroring or showing blank text. Don't assume every visible string on a given venue will change just because `setCurrentLocale` resolved successfully; whether any specific piece of text changes depends on whether that item actually has a `LocaleEntry` authored for the target locale.

## Learn more

- `Venue.currentLocale` / `Venue.setCurrentLocale` — `node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/Venue.d.ts`.
- `Translator.allLocales` / `Translator.translatePOI` — `node_modules/@visioglobe/visioone/dist/src/VisioOne/Content/Translator.d.ts`.
- `docs/features/category-highlight.md` — also reads `venue.translator` (via `translateCategory`) to display a human-readable label for an otherwise-opaque id.
