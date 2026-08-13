# Aller à un lieu / POI (goto-poi)

## Description

Permet de centrer et zoomer la caméra sur un POI donné à partir de son ID, saisi dans un champ texte, en appelant directement `view.goToPOI(poi, animationOptions)` sur l'instance `view` exposée par `VisioOneMap` — comme pour `occupancy-simulated`, pas de pont natif↔JS à construire : le SDK tourne dans le DOM et `venue`/`view` sont des objets JS directement accessibles depuis `src/views/FeatureView.vue`.

Le POI est d'abord retrouvé via `venue.pois.find(p => p.id === targetId)` (même pattern de lookup que `occupancy-simulated`, il n'existe pas de `venue.getPOIById` dédié dans les typings du SDK — voir `node_modules/@visioglobe/visioone/dist/src/VisioOne/Venue/Venue.d.ts`), puis ses surfaces sont mises en évidence via `venue.updateSurface(surface, { selectionColor: '#057DBC' })` pour que l'utilisateur voie clairement quel lieu a été ciblé, en plus du mouvement de caméra.

## Step by step

1. **Ajouter un champ Place ID + deux boutons ("Go" / "Clear")** dans le panneau modal (`BottomSheet.vue`, déjà utilisé par `reset-view`, `occupancy-simulated` et `poi-click`), ouvert par un FAB comme les autres features à contrôle utilisateur. Voir le bloc `v-else-if="props.slug === 'goto-poi'"` dans `src/views/FeatureView.vue`.
2. **"Go" retrouve le POI puis déplace la caméra** :
   ```js
   function goToPoi() {
     const venue = venueRef.value
     const view = viewRef.value
     if (!venue || !view) return

     const targetId = goToPoiId.value.trim()
     if (!targetId) return

     const poi = venue.pois.find((p) => p.id === targetId)
     if (!poi) {
       goToPoiNotFound.value = true
       return
     }
     goToPoiNotFound.value = false

     clearGoToPoiHighlight()
     highlightedPoi = poi
     poi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: '#057DBC' }))
     view.goToPOI(poi, {
       orientation: { pitch: 20 },
       padding: { top: 100, bottom: 100, left: 100, right: 100 },
     })
   }
   ```
   `goToPOI` accepte les mêmes `AnimationOptions` que les autres méthodes de caméra du SDK (`goToFloor`, `goToBuilding`, `goToGlobal`) — `orientation.pitch` et `padding` sont optionnels, utilisés ici uniquement pour un rendu plus lisible (caméra légèrement inclinée, POI pas collé aux bords de l'écran).
3. **"Clear" réinitialise la mise en évidence et le champ** :
   ```js
   function clearGoToPoiHighlight() {
     if (!highlightedPoi) return
     const venue = venueRef.value
     if (venue) {
       highlightedPoi.surfaces.forEach((surface) => venue.updateSurface(surface, { selectionColor: undefined }))
     }
     highlightedPoi = null
   }

   function clearGoToPoi() {
     clearGoToPoiHighlight()
     goToPoiId.value = ''
     goToPoiNotFound.value = false
   }
   ```
4. **Afficher un message d'erreur discret** (`goToPoiNotFound`) si l'ID saisi ne correspond à aucun POI de la carte chargée, plutôt que de ne rien faire silencieusement.

## Points d'attention

- **Pourquoi pas le clic sur la carte ?** Une note historique du hub suggérait de réutiliser le handler de clic POI (`handlePOIClick`) pour déclencher `goToPOI`. C'est devenu incorrect depuis que `poi-click` a sa propre implémentation : `handlePOIClick` est maintenant dédié à l'ouverture du panneau "détails du POI cliqué" (voir `docs/features/poi-click.md`), et un clic sur la carte ne doit *pas* aussi déclencher un recentrage caméra — les deux features sont des démonstrations distinctes du catalogue (`CHECKLIST.md`), avec des déclencheurs distincts : `poi-click` réagit au clic carte, `goto-poi` réagit à la saisie d'un ID dans un champ dédié + bouton "Go". Coupler les deux aurait mélangé deux comportements que le hub tracke et qu'un client pourrait vouloir l'un sans l'autre (ex. navigation programmatique vers un POI depuis un moteur de recherche externe, sans jamais impliquer de clic carte).
- **Pas de `venue.getPOIById` dans les typings.** Comme pour `occupancy-simulated`, la recherche passe par `venue.pois.find(...)`, qui échoue silencieusement (retourne `undefined`, pas d'exception) si l'ID ne correspond à rien — d'où le contrôle explicite `if (!poi)` et le message `goToPoiNotFound` affiché à l'utilisateur, pour ne pas laisser un clic sur "Go" sans aucun retour visible.
- **La mise en évidence (`selectionColor`) est un choix de démo, pas une obligation du SDK.** `view.goToPOI` fonctionne seul ; la coloration de surface a été ajoutée (à l'image de la référence React Native, `src/assets/visioOneHtml.ts`, fonction `goToPlace`) pour que l'utilisateur voie clairement *quel* POI a été ciblé, surtout sur une carte dense où le recentrage caméra seul peut être ambigu. Contrairement à la référence RN, ce repo ne crée pas de marker/image flottant additionnel (`venue.createImage` avec une icône externe) — jugé superflu pour la démonstration et introduisant une dépendance à une URL d'icône externe (CDN tiers) sans bénéfice pour ce que cette feature doit prouver.
- **`selectionColor: undefined` réinitialise la surface** à son état normal (comme `color: undefined` pour `occupancy-simulated`) — ce n'est pas une couleur par défaut câblée en dur, donc pas besoin de connaître la couleur d'origine pour "Clear".
- **"Clear" ne rappelle pas `goToGlobal()`.** Recentrer la caméra sur la vue par défaut est déjà le rôle de la feature `reset-view` (bouton dédié) — "Clear" ici se limite à annuler la mise en évidence du POI et vider le champ, pour ne pas dupliquer/mélanger deux features déjà distinctes du catalogue.
- **`highlightedPoi` est une variable module-locale (pas un `ref`)**, comme `simulatingPlaceId` pour `occupancy-simulated` : elle capture le POI réellement ciblé au moment de "Go", indépendamment de ce que le champ texte contient ensuite si l'utilisateur le modifie avant de cliquer "Clear".
- **Aucun nettoyage explicite requis au démontage de l'écran** : `VisioOneMap` détruit la `view` et décharge la `venue` dans son propre `onBeforeUnmount` (voir `src/components/VisioOneMap.vue`) — la surface mise en évidence disparaît avec l'instance, contrairement au timer de `occupancy-simulated` qui est un `setInterval` JS indépendant du cycle de vie du SDK et doit être nettoyé explicitement.
