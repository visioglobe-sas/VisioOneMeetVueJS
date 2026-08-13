# Sélection d'étage / bâtiment (floor-selector)

## Description

Permet à l'application de piloter elle-même le changement d'étage (et de bâtiment) sur la carte, via `view.goToFloor(floor)` et `view.goToBuilding(building)`, en s'appuyant sur les données réelles du lieu chargé (`venue.venueLayout.buildings[].floors[]`) — jamais d'ID d'étage ou de bâtiment codé en dur.

Comme pour `goto-poi` et `occupancy-simulated`, pas de pont natif↔JS à construire : le SDK tourne dans le DOM et `venue`/`view` sont des objets JS directement accessibles depuis `src/views/FeatureView.vue`.

Le SDK affiche déjà, par défaut, son propre widget de sélection d'étage sur la carte (visible sans aucun code applicatif — `UIPart` `'floorSelector'`, voir `View.d.ts`). Cette feature n'a pas vocation à le remplacer : elle démontre qu'un client peut construire **son propre contrôle**, avec son propre look, ses propres déclencheurs (ex. depuis un menu, une recherche, un flux métier externe), tout en restant synchronisé avec l'état réel de la vue — y compris quand ce dernier change par un autre biais que ce contrôle (widget natif du SDK inclus). Voir "Points d'attention" ci-dessous.

## Step by step

1. **Lire la structure du lieu** depuis `venue.venueLayout` (typings : `node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/VenueLayout.d.ts`) :
   ```js
   const buildings = computed(() => venueRef.value?.venueLayout.buildings ?? [])
   ```
   Chaque `Building` expose `id`, `floors: Floor[]` et `defaultFloorID` (`Building.d.ts`). Chaque `Floor` expose `id`, `altitude` et `levelIndex` (`Floor.d.ts`) — pas de champ "label" ou "nom" dans les typings, d'où l'affichage de `floor.id` tel quel dans la liste.

2. **Choisir un bâtiment par défaut** à l'ouverture de la feature : le bâtiment courant de la vue (`view.currentBuilding`) s'il existe, sinon le premier bâtiment du lieu :
   ```js
   function initFloorSelector() {
     const view = viewRef.value
     if (!view) return
     selectedBuildingId.value = view.currentBuilding?.id ?? buildings.value[0]?.id ?? null
     syncCurrentFloor()
     view.addEventListener('currentfloorchanged', handleCurrentFloorChanged)
   }
   ```

3. **Lister les étages du bâtiment sélectionné**, triés du plus haut au plus bas via `levelIndex` (et non l'ordre du tableau, qui n'est pas garanti) :
   ```js
   const floorsForSelectedBuilding = computed(() =>
     [...(selectedBuilding.value?.floors ?? [])].sort((a, b) => b.levelIndex - a.levelIndex),
   )
   ```

4. **Changer d'étage** au tap sur un bouton de la liste :
   ```js
   function selectFloor(floor) {
     const view = viewRef.value
     if (!view || floor.id === currentFloorId.value) return
     view.goToFloor(floor)
   }
   ```
   `goToFloor` accepte un `Floor` complet (pas un ID) — d'où le passage de l'objet directement issu de `venue.venueLayout`, jamais reconstruit.

5. **Changer de bâtiment** (uniquement affiché si le lieu en a plus d'un) via `view.goToBuilding(building)` :
   ```js
   function selectBuilding(building) {
     const view = viewRef.value
     if (!view || building.id === selectedBuildingId.value) return
     selectedBuildingId.value = building.id
     view.goToBuilding(building)
   }
   ```
   `goToBuilding` ouvre le bâtiment sur son étage par défaut (`defaultFloorID`) ; le nouvel étage courant est répercuté automatiquement dans le panneau via l'écouteur d'événement (étape suivante), pas par un appel explicite supplémentaire.

6. **Rester synchronisé avec l'état réel de la vue**, y compris quand il change par un autre chemin que ce panneau (widget natif du SDK, `goToPOI` d'une autre feature, etc.), via l'événement `'currentfloorchanged'` (`EventType.d.ts`, `VenueEvent.d.ts`) :
   ```js
   function handleCurrentFloorChanged(event) {
     currentFloorId.value = event.newFloor?.id ?? null
     if (event.newBuilding) selectedBuildingId.value = event.newBuilding.id
   }
   ```
   C'est ce qui permet à la liste de toujours mettre en évidence le bon étage (`floor-panel__floor-button--active`, badge "Current"/"Actuel"), même si l'utilisateur a changé d'étage autrement.

7. **UI** : bouton FAB (`⚙`) ouvrant le panneau modal `BottomSheet.vue` (déjà utilisé par `reset-view`, `occupancy-simulated`, `poi-click`, `goto-poi`) contenant une rangée d'onglets bâtiment (si plusieurs bâtiments) suivie d'une liste verticale de boutons, un par étage. Voir le bloc `v-else-if="props.slug === 'floor-selector'"` dans `src/views/FeatureView.vue`.

## Points d'attention

- **Chevauchement avec le widget natif du SDK.** Le SDK affiche déjà, sans aucun code, son propre sélecteur d'étage (`UIPart: 'floorSelector'`, visible/masquable via `view.setUIPartVisible('floorSelector', ...)`). Cette feature n'est donc pas là pour "faire exister" la fonctionnalité — elle existe déjà côté SDK — mais pour prouver qu'un client peut piloter le même comportement (`goToFloor`/`goToBuilding`) depuis **sa propre UI**, avec son propre style, potentiellement déclenchée par autre chose qu'un tap sur le widget carte (ex. une liste de résultats de recherche, un lien profond, une action métier). Les deux contrôles coexistent sans conflit : ce sont deux clients du même `view`, et l'écouteur `'currentfloorchanged'` garantit que le panneau maison reste synchronisé même quand c'est le widget natif qui a changé l'étage.
- **Pas de champ "nom d'étage" dans les typings.** `Floor` n'expose que `id`, `altitude` et `levelIndex` (pas de `label`/`name` comme pour `POI`). L'affichage utilise donc `floor.id` brut — pour un vrai déploiement client, l'`id` d'étage est généralement déjà lisible (ex. `"L0"`, `"RDC"`), défini au moment du build de la carte dans VisioMapEditor.
- **`goToFloor`/`goToBuilding` attendent l'objet complet, pas un ID.** Contrairement à `goToPoi` (qui doit d'abord retrouver le POI via `venue.pois.find(...)` à partir d'un ID saisi), ici les objets `Floor`/`Building` sont déjà en main puisqu'ils viennent directement de `venue.venueLayout` — pas de lookup ni de gestion de "not found" nécessaire.
- **`goToBuilding` change aussi l'étage courant** (vers `defaultFloorID` du bâtiment ouvert) : ne pas appeler `goToFloor` juste après dans le même geste utilisateur, sous peine de déclencher deux animations de caméra qui se chevauchent. Le panneau se contente d'appeler `goToBuilding` puis laisse l'écouteur `'currentfloorchanged'` mettre à jour l'étage courant affiché.
- **`view.currentFloor` est en lecture seule** — impossible de l'assigner directement ; le seul moyen de le changer est `goToFloor`/`goToBuilding` (ou la navigation/tracking). D'où l'écouteur d'événement plutôt qu'une relecture manuelle après chaque action.
- **Onglets bâtiment masqués s'il n'y a qu'un seul bâtiment** dans le lieu chargé (cas fréquent des démos), pour ne pas afficher un sélecteur à une seule option sans intérêt.
- **Aucun nettoyage explicite du côté SDK requis à la destruction de la vue** (comme pour `goto-poi`) : `VisioOneMap` détruit la `view` dans son propre `onBeforeUnmount`. L'écouteur `'currentfloorchanged'` est néanmoins retiré explicitement dans le `onBeforeUnmount` de `FeatureView.vue`, par hygiène, avant que la `view` elle-même soit détruite.
