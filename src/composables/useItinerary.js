// Itinerary between two POI ids, shared by compute-navigation,
// custom-navigation-trace, navigation-exclude-modalities and accessible-mode:
// venue.computeNavigation() + a NavigationTrace made current on the view.
// Both POIs are resolved with findPoi (no venue.getPOIById in the SDK) so a
// typo surfaces as an explicit "not found" message rather than a silent
// no-op. See docs/features/compute-navigation.md.
import { ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { findPoi } from '../sdk/pois'

// venueRef/viewRef: the screen's shallowRefs holding the SDK instances.
// from/to: the POI ids the From/To fields open prefilled with.
export function useItinerary(venueRef, viewRef, { from, to }) {
  const { t } = useI18n()

  const originId = ref(from)
  const destinationId = ref(to)
  const error = ref('')
  // The NavigationTrace currently displayed, if any. shallowRef: an SDK
  // instance must never be wrapped in a deep reactive proxy.
  const currentTrace = shallowRef(null)

  // navigationOptions is merged into the NavigationRequest, e.g.
  // { excludedAttributes: ['lift'] } or { isAccessible: true }.
  function compute(navigationOptions = {}) {
    const venue = venueRef.value
    const view = viewRef.value
    if (!venue || !view) return

    const fromId = originId.value.trim()
    const toId = destinationId.value.trim()
    if (!fromId || !toId) return

    const originPoi = findPoi(venue, fromId)
    const destinationPoi = findPoi(venue, toId)
    if (!originPoi || !destinationPoi) {
      error.value = t('features.computeNavigation.notFound')
      return
    }

    clear()

    try {
      const navigation = venue.computeNavigation({
        origin: originPoi,
        destination: destinationPoi,
        ...navigationOptions,
      })
      currentTrace.value = venue.createNavigationTrace(navigation)
      view.setCurrentNavigationTrace(currentTrace.value)
      error.value = ''
    } catch (computeError) {
      // computeNavigation throws RouteNotFoundError/SourceOutOfLimitError/
      // DestinationOutOfLimitError (see Navigation/Errors in the SDK typings)
      // when the two POIs aren't connected by the routing graph.
      console.error('computeNavigation failed:', computeError)
      error.value = t('features.computeNavigation.routeNotFound')
    }
  }

  function clear() {
    // removeCurrentNavigationTrace() also unregisters the trace from the venue:
    // calling venue.removeNavigationTrace() on it afterwards throws
    // "Cannot remove Navigation as it is unregistered". It throws too when no
    // trace is current, hence the guard.
    if (viewRef.value && currentTrace.value) {
      viewRef.value.removeCurrentNavigationTrace()
    }
    currentTrace.value = null
    error.value = ''
  }

  function clearFields() {
    clear()
    originId.value = ''
    destinationId.value = ''
  }

  return { originId, destinationId, error, currentTrace, compute, clear, clearFields }
}
