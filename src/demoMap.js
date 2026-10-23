// Values of Visioglobe's shared demo map (the map hash itself comes from
// VITE_VISIOONE_HASH in .env): replace them with your own map's ids.

// custom-data only: a dedicated map that actually has CustomData published
// (the shared demo map has none). See docs/features/custom-data.md.
export const CUSTOM_DATA_MAP_HASH = 'kd9426d8cb3f1c532f22b5bcbd325c280bd351feb'
// POI ids (on CUSTOM_DATA_MAP_HASH) carrying non-empty CustomData.
export const CUSTOM_DATA_SAMPLE_POI_IDS = ['B1', 'B3-UL00-ID0065', 'B3-UL00-ID0064']
export const CUSTOM_DATA_POI_ID = 'B3-UL00-ID0065'

export const GOTO_POI_ID = 'B3-UL00-ID0076'
export const OCCUPANCY_POI_ID = 'B3-UL00-ID0065'
export const CLICKABLE_SURFACE_POI_ID = 'B3-UL00-ID0064'

// compute-navigation and custom-navigation-trace.
export const ITINERARY_FROM = 'B4-UL00-ID0009'
export const ITINERARY_TO = 'B3-UL00-ID0064'
// navigation-exclude-modalities: a route that uses an elevator by default.
export const EXCLUDE_MODALITIES_FROM = 'B1-LL01-ID0013'
export const EXCLUDE_MODALITIES_TO = 'B1-UL02-ID0012'
// accessible-mode: a route whose default path takes stairs.
export const ACCESSIBLE_FROM = 'B4-UL00-ID0010'
export const ACCESSIBLE_TO = 'B4-UL01-ID0014'

// simulated-position, camera-lock-on-position, geofencing, accuracy-circle-style.
export const TRACKING_FROM = 'B4-UL00-ID0009'
export const TRACKING_TO = 'B4-UL00-ID0010'
// geofencing: a POI with a surface, used as the zone.
export const GEOFENCE_ZONE_ID = 'B4-UL00-ID0010'

// dynamic-poi-crud: id of the POI to create (any unused id works).
export const NEW_POI_ID = 'demo-poi'
// Existing POI with a label: dynamic-poi-crud, 3d-icon-marker,
// custom-text-label and html-overlay-marker copy its position.
export const ANCHOR_POI_ID = 'B4-UL00-ID0009'

// camera-showcase-carousel stops, in tour order.
export const CAROUSEL_STOP_IDS = ['B4-UL00-ID0009', 'B1-LL01-ID0152', 'B3-UL00-ID0064', 'B4-UL03-ID0015']
