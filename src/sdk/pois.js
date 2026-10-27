// POI helpers shared by every feature screen. Plain functions over the SDK's
// own objects (see POI.d.ts, Label.d.ts, Image.d.ts, Marker.d.ts and
// Surface.d.ts in node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/).

// There is no venue.getPOIById in the SDK: look the POI up in venue.pois.
// Returns null (no exception) when the id matches nothing on the loaded venue.
export function findPoi(venue, id) {
  return venue?.pois.find((poi) => poi.id === id) ?? null
}

function centroid(positions) {
  if (!positions?.length) return null
  const sum = positions.reduce(
    (acc, position) => ({
      latitude: acc.latitude + position.latitude,
      longitude: acc.longitude + position.longitude,
      altitude: acc.altitude + (position.altitude ?? 0),
    }),
    { latitude: 0, longitude: 0, altitude: 0 },
  )
  return {
    latitude: sum.latitude / positions.length,
    longitude: sum.longitude / positions.length,
    altitude: sum.altitude / positions.length,
  }
}

// A POI has no latitude/longitude of its own: its position is read off the
// objects it owns, which all carry a WGS84 Position ({ latitude, longitude,
// altitude? }), the shape expected by createLabel/createImage/createMarker
// and injectTrackedPosition. Priority:
//   1. its first label (poi.labels[0].position),
//   2. its first image, then its first marker (poi.images[0] / poi.markers[0]),
//   3. the centroid of its first surface's vertices (poi.surfaces[0].positions).
// `exclude` lists objects to skip, e.g. a label or marker the app itself
// added to that POI, whose position is already offset.
// Returns null when the POI has none of these.
export function poiDisplayPosition(poi, exclude = []) {
  if (!poi) return null
  const usable = (item) => item && !exclude.includes(item)
  const label = poi.labels?.find(usable)
  if (label) return label.position
  const image = poi.images?.find(usable)
  if (image) return image.position
  const marker = poi.markers?.find(usable)
  if (marker) return marker.position
  return centroid(poi.surfaces?.[0]?.positions)
}

// Camera move shared by goto-poi, 3d-icon-marker, custom-text-label and
// html-overlay-marker: frames the POI and shows its floor (an image, label or
// marker on an indoor POI only renders while that floor is shown).
export function focusCameraOnPoi(view, poi) {
  view?.goToPOI(poi, {
    orientation: { pitch: 20 },
    padding: { top: 100, bottom: 100, left: 100, right: 100 },
  })
}
