# Itinéraire (compute-navigation)

## Description

Calcule et affiche un itinéraire entre deux lieux, saisis comme deux Place ID (« From » / « To ») dans le panneau modal, en appelant directement `venue.computeNavigation({ origin, destination })` puis en affichant le résultat sur la carte via `venue.createNavigationTrace(navigation)` + `view.setCurrentNavigationTrace(navigationTrace)` — les trois méthodes exposées par le SDK pour, dans l'ordre : calculer l'itinéraire, en construire une représentation visuelle, puis la rendre courante sur la vue.

Comme pour `goto-poi` et `floor-selector`, pas de pont natif↔JS à construire : le SDK tourne dans le DOM et `venue`/`view` sont des objets JS directement accessibles depuis `src/views/FeatureView.vue`.

Les deux lieux sont d'abord retrouvés via `venue.pois.find(p => p.id === id)` (même pattern de lookup que `goto-poi`, il n'existe pas de `venue.getPOIById` dédié dans les typings du SDK) avant d'être passés à `computeNavigation` — bien que `computeNavigation` accepte aussi directement une chaîne d'ID en `origin`/`destination` (type `POIOrIDOrPosition`, voir `NavigationRequest.d.ts`), la résolution explicite permet d'afficher un message « not found » propre à cette démo plutôt que de laisser le SDK lever une exception moins parlante pour un ID inconnu.

## Step by step

1. **Ajouter deux champs Place ID ("From" / "To") + un bouton "Itinerary"** dans le panneau modal (`BottomSheet.vue`, déjà utilisé par les autres features), ouvert par un FAB comme les autres features à contrôle utilisateur. Voir le bloc `v-else-if="props.slug === 'compute-navigation'"` dans `src/views/FeatureView.vue`.
2. **Résoudre les deux POIs et calculer l'itinéraire** :
   ```js
   function computeItinerary() {
     const venue = venueRef.value
     const view = viewRef.value
     if (!venue || !view) return

     const originId = itineraryOriginId.value.trim()
     const destinationId = itineraryDestinationId.value.trim()
     if (!originId || !destinationId) return

     const originPoi = venue.pois.find((p) => p.id === originId)
     const destinationPoi = venue.pois.find((p) => p.id === destinationId)
     if (!originPoi || !destinationPoi) {
       itineraryError.value = t('features.computeNavigation.notFound')
       return
     }

     clearItinerary()

     try {
       const navigation = venue.computeNavigation({ origin: originPoi, destination: destinationPoi })
       currentNavigationTrace = venue.createNavigationTrace(navigation)
       view.setCurrentNavigationTrace(currentNavigationTrace)
       itineraryError.value = ''
     } catch (error) {
       console.error('computeNavigation failed:', error)
       itineraryError.value = t('features.computeNavigation.routeNotFound')
     }
   }
   ```
   `computeNavigation` returns a `Navigation` (the request + the ordered `NavigationInstruction[]`, in a locale-independent format — see `Navigation.d.ts`/`NavigationInstruction.d.ts`). It is not by itself visible on the map: it must be turned into a `NavigationTrace` (`venue.createNavigationTrace`) before it can be made current on the view.
3. **Afficher la trace et gérer les erreurs.** `computeNavigation` lève une exception (`RouteNotFoundError`, `SourceOutOfLimitError` ou `DestinationOutOfLimitError` — voir `Navigation/Errors/` dans les typings) quand les deux POIs existent mais qu'aucune route ne les relie (bâtiments non connectés dans le graphe de routing, par exemple). Ce repo ne distingue pas les trois cas pour l'utilisateur final — un seul message générique `routeNotFound` couvre les trois, la distinction précise étant surtout utile en debug (`console.error`).
4. **Nettoyer l'itinéraire affiché**, avant un nouveau calcul et via le bouton "Clear" :
   ```js
   function clearItinerary() {
     const venue = venueRef.value
     if (venue && currentNavigationTrace) {
       viewRef.value?.removeCurrentNavigationTrace()
       venue.removeNavigationTrace(currentNavigationTrace)
     }
     currentNavigationTrace = null
     itineraryError.value = ''
   }
   ```
   Deux appels distincts sont nécessaires : `view.removeCurrentNavigationTrace()` retire la représentation de la vue/UI (ce n'est plus la navigation "courante"), tandis que `venue.removeNavigationTrace(trace)` détruit l'objet `NavigationTrace` lui-même côté venue. Omettre le second laisse un objet orphelin.

## Points d'attention

- **Pas de `venue.getPOIById` dans les typings.** Comme pour `goto-poi`, la recherche passe par `venue.pois.find(...)`, qui échoue silencieusement (retourne `undefined`) si l'ID ne correspond à rien — d'où le contrôle explicite `if (!originPoi || !destinationPoi)` avant même d'appeler `computeNavigation`.
- **`computeNavigation` accepte directement une chaîne d'ID.** Le type `POIOrIDOrPosition` (voir `NavigationRequest.d.ts`) accepte un `POI`, une chaîne d'ID ou une `Position` géographique en `origin`/`destination` — passer l'ID brut sans lookup préalable aurait fonctionné, mais on perd la possibilité d'un message "not found" propre à la démo : le SDK lèverait alors une erreur de routing (route non trouvée) plutôt qu'une erreur "POI inconnu" distincte, ce qui est moins clair pour un utilisateur qui a simplement fait une faute de frappe.
- **Deux objets, deux étapes de nettoyage.** `computeNavigation` (calcul pur, pas de rendu) → `createNavigationTrace` (représentation visuelle, pas encore affichée) → `setCurrentNavigationTrace` (affichage effectif). Symétriquement, faire disparaître un itinéraire affiché demande `view.removeCurrentNavigationTrace()` **et** `venue.removeNavigationTrace(trace)` — le premier seul laisserait un objet `NavigationTrace` existant mais invisible.
- **Un seul itinéraire affiché à la fois dans cette démo.** `clearItinerary()` est appelée avant tout nouveau calcul (pas seulement via le bouton "Clear"), pour éviter d'empiler plusieurs `NavigationTrace` sur la vue — le SDK autoriserait plusieurs traces (`venue.createNavigationTrace` peut être appelé plusieurs fois), mais ce n'est pas ce que cette démo cherche à montrer.
- **`type`/`isAccessible` non exposés dans cette démo.** `NavigationRequest` accepte aussi `type` (`'fastest'` par défaut, ou `'shortest'`) et `isAccessible` (routage PMR) — voir `NavigationRequestType.d.ts`. Ni l'un ni l'autre n'a de champ dédié dans le panneau ici, contrairement à la référence React Native (`startItinerary(origin, destination, isAccessible)`) qui câble `isAccessible` en dur à `false`. Ajouter un contrôle (case à cocher "Accessible") serait une extension directe de `computeItinerary()`, pas un changement d'architecture.
- **Pas de suivi d'instructions pas-à-pas.** Cette démo affiche l'itinéraire complet en une fois ; elle n'appelle ni `view.setCurrentNavigationInstruction`, ni `view.navigateToNextInstruction`/`navigateToPreviousInstruction` (navigation pas-à-pas guidée), ni le suivi de position réel (`view.injectTrackedPosition`, hors scope — position simulée/réelle non fournie par ces repos démo). Voir `docs/features/` du hub pour le statut de ces features potentielles.
- **Aucun nettoyage explicite requis au démontage de l'écran** : `VisioOneMap` détruit la `view` et décharge la `venue` dans son propre `onBeforeUnmount` (voir `src/components/VisioOneMap.vue`) — la trace affichée disparaît avec l'instance, comme pour la mise en évidence de `goto-poi`.
