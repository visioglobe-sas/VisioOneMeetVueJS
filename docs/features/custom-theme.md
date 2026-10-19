# Custom Theme

## Description

White-label styling of the map, applied live with no reload:

- **3D scene theme**: `view.themes` lists the registered lighting themes (`['day', 'night', 'goldenHour']` as of SDK 1.1.0) and `view.setTheme(name)` applies one. `night` gives a bluish, darker scene and `goldenHour` a warm, muted one.
- **UI accent colors**: `view.accentColor` and `view.textAccentColor` are settable properties that recolor the SDK's own UI buttons (the POI card's "Go", "Add a step", "Remove step"...).

Themes only take effect on a view created with `enableShadows: true` (see "Things to know").

## SDK usage

```js
// Themes need shadows/lights rendering, which is opt-in at view creation.
const view = await visioOne.createView(container, venue, { enableShadows: true })

// Build the theme picker from the SDK's own list rather than hardcoding ids.
const themes = view.themes // ['day', 'night', 'goldenHour']
view.setTheme('night')

// Recolor the SDK's buttons (hex, rgb(a) or hsl).
view.accentColor = '#E53935' // button background, default '#0094f0'
view.textAccentColor = '#212121' // button text/icon, default '#ffffff'

// Back to the defaults.
view.setTheme('day')
view.accentColor = '#0094F0'
view.textAccentColor = '#FFFFFF'
```

Signatures, from `node_modules/@visioglobe/visioone/dist/src/VisioOne/`:

- `View.themes: readonly string[]` and `View.setTheme(themeName: string): void` (`View/View.d.ts`).
- `View.accentColor: Color` and `View.textAccentColor: Color` (`View/View.d.ts`).
- `ViewCreateOptions.enableShadows?: boolean` (`Venue/ViewCreateOptions.d.ts`).

## Things to know

- **`setTheme` does nothing visible without `enableShadows: true`.** Themes only change the scene's directional and ambient lights, and those are only rendered when the view is created with `enableShadows: true`. Without it, every theme renders pixel-identical. `enableShadows` can't be turned on later: it is a `createView` option.
- **Shadows are expensive.** The SDK documents them as "computationally expensive" and they "may hurt performance". Enable them only on the screens that need themes. The SDK also ignores `enableShadows` when it picks its `low` quality preset (low-end devices), in which case themes have no visible effect either.
- **Themes change the lighting only, never the UI.** Use `accentColor` / `textAccentColor` for the SDK's buttons.
- **The initial lighting can't be restored exactly.** At load the SDK fits the light to the venue's bounds. `setTheme` then sets the theme's fixed light position, so after switching to any theme, `setTheme('day')` gives a slightly different render (other shadow direction, a bit darker) than the freshly loaded view, even though both are "day".
- **Only use ids from `view.themes`.** An unknown id throws `Cannot apply given theme <name> as it isn't registered.`
- **There is no getter for the current theme** (as of SDK 1.1.0). Track it yourself; the view starts on `day`.
- **Invalid colors throw.** Assigning anything other than a hex, rgb(a) or hsl color to `accentColor` / `textAccentColor` throws `Invalid color format provided, it should be hex color, rgba color or hsl color.`
- **Accent colors apply live** to every SDK button that uses them, including the ones not currently on screen. They do not change the color of a selected surface: that is the separate `view.surfaceSelectionColor`.

## Learn more

- Both accent colors can also be set at load time through the `accentColor` / `textAccentColor` URL parameters (see `Venue/URLParameters.d.ts`), e.g. `?accentColor=rgb(252,3,15)`.
