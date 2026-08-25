# React to a POI Click

## Description

Shows details for the POI(s) tapped on the map, from the `poiclick` event emitted by the VisioOne `view`. `VisioOneMap.vue` already listens for this event (`view.addEventListener('poiclick', ...)`) and re-emits it as the Vue event `poi-click`.

## SDK usage

```js
function handlePOIClick(event) {
  clickedPois.value = event.pois ?? []
}

function poiName(poi) {
  return poi.labels?.[0]?.text || poi.id
}
```

The event payload is a `POIEvent` (see `node_modules/@visioglobe/visioone/dist/src/VisioOne/View/Events/POIEvent.d.ts`) carrying `pois: POI[]` — an array, not a single POI, because one tap can hit several overlapping objects (e.g. a marker sitting on a surface).

## Things to know

- `event.pois` is always an array, even for a single hit — a tap can resolve to multiple overlapping POIs (marker + surface, for example), so don't assume there's exactly one result.
- `POI` has no `name` field. The displayed name comes from `poi.labels[0]?.text`, with a fallback to `poi.id` when the POI has no visible label on the map.
- `poi.floor` and `poi.categories` are optional and may be empty depending on how the POI was modeled in VisioMapEditor — don't assume either is always present.
