# Position simulée (simulated-position)

## Description

Anime un point de position suivi (dot + cercle de précision) entre deux POI, en appelant directement `view.injectTrackedPosition({ position, precisionCircleRadius }, animationOptions?)` sur l'instance `view` exposée par `VisioOneMap` — comme pour les autres features de ce dépôt, pas de pont natif↔JS à construire : le SDK tourne dans le DOM et `venue`/`view` sont des objets JS directement accessibles depuis `src/views/FeatureView.vue`.

Il n'y a pas de vraie source de positionnement indoor derrière (pas de BLE/Wi-Fi/UWB) : un `setInterval` fait avancer une position interpolée linéairement entre les deux POI, aller-retour en boucle, en lieu et place d'un flux de positionnement réel. C'est une démonstration de la **mécanique d'affichage** d'une position suivie, pas une intégration de positionnement indoor — voir "Points d'attention".

## Step by step

1. **Résoudre chaque POI en position WGS84** via `venue.pois.find(p => p.id === id)`, puis lire la position sur le premier sous-objet qui en porte une — les POI n'ont pas de champ lat/lng direct :
   ```js
   function resolvePoiPosition(id) {
     const venue = venueRef.value
     if (!venue) return null
     const poi = venue.pois.find((p) => p.id === id)
     if (!poi) return null
     return poi.markers?.[0]?.position ?? poi.labels?.[0]?.position ?? poi.images?.[0]?.position ?? null
   }
   ```
2. **Autoriser le tracking avant le premier appel** — `view.allowTracking` doit être passé à `true` avant tout `injectTrackedPosition`, sous peine d'exception :
   ```js
   view.allowTracking = true
   ```
3. **Interpoler linéairement** entre origine et destination selon une progression `0..1`, et injecter la position à chaque tick :
   ```js
   function lerpPosition(from, to, progress) {
     return {
       latitude: from.latitude + (to.latitude - from.latitude) * progress,
       longitude: from.longitude + (to.longitude - from.longitude) * progress,
       altitude: (from.altitude ?? 0) + ((to.altitude ?? 0) - (from.altitude ?? 0)) * progress,
     }
   }

   function injectSimulatedPositionTick() {
     const view = viewRef.value
     if (!view || !positionOrigin || !positionDestination) return

     view.injectTrackedPosition({
       position: lerpPosition(positionOrigin, positionDestination, positionProgress),
       precisionCircleRadius: accuracyRadius.value,
     })

     positionProgress += POSITION_STEP * positionDirection
     if (positionProgress >= 1) {
       positionProgress = 1
       positionDirection = -1
     } else if (positionProgress <= 0) {
       positionProgress = 0
       positionDirection = 1
     }
   }
   ```
   Le `setInterval` (toutes les 150 ms) rappelle cette fonction, en inversant `positionDirection` à chaque extrémité pour faire l'aller-retour en boucle — même idiome de timer que `occupancy-simulated`.
4. **Rayon de précision réglable en direct** : `precisionCircleRadius` est relu depuis `accuracyRadius.value` à chaque tick, donc déplacer le curseur pendant que la simulation tourne change le rayon dès le tick suivant, sans redémarrage. Si la simulation n'est pas encore démarrée, la valeur est simplement mémorisée pour le prochain "Start".
5. **Arrêter la simulation** : pas de méthode dédiée côté SDK pour retirer la position suivie — on nettoie le timer et on repasse `allowTracking` à `false`, ce qui retire le dot et le cercle de la carte :
   ```js
   function stopSimulatedPosition() {
     clearInterval(positionTimer)
     positionTimer = null
     positionOrigin = null
     positionDestination = null
     if (viewRef.value) viewRef.value.allowTracking = false
     simulatingPosition.value = false
   }
   ```
6. **UI** : bouton FAB (`⚙`) ouvrant le panneau modal `BottomSheet.vue` (déjà utilisé par les autres features à contrôle utilisateur), contenant deux champs Place ID (origine/destination), un curseur `<input type="range">` (1 à 20 m, défaut 5 m) pour le rayon de précision, et un bouton toggle Start/Stop — même structure de panneau que `compute-navigation` (deux champs + not-found) et même idiome de toggle que `occupancy-simulated`. Voir le bloc `v-else-if="props.slug === 'simulated-position'"` dans `src/views/FeatureView.vue`.

## Points d'attention

- **`injectTrackedPosition` exige `allowTracking = true` au préalable.** Appeler `injectTrackedPosition` avant d'avoir positionné `view.allowTracking = true` lève une exception côté SDK — `startSimulatedPosition` le fait systématiquement avant le premier tick.
- **Pas de méthode "stop" dédiée.** Contrairement à ce qu'on pourrait attendre, il n'existe pas de `view.removeTrackedPosition()` ou équivalent : repasser `allowTracking` à `false` est le seul moyen documenté de retirer le dot et le cercle de précision de la carte (`View.ts`).
- **Les POI n'ont pas de position directe.** Comme pour les autres features qui résolvent un ID en donnée exploitable (`goto-poi`, `compute-navigation`), il n'existe pas de champ lat/lng sur `POI` — la position vient de son premier marker, à défaut label, à défaut image (`poi.markers?.[0]?.position ?? poi.labels?.[0]?.position ?? poi.images?.[0]?.position`), tous portant une `Position` du même type `{ latitude, longitude, altitude? }` attendu par `injectTrackedPosition`, sans conversion. Si aucun de ces trois n'existe, ou si l'ID ne correspond à aucun POI, l'erreur "not found" est affichée — même pattern de surface d'erreur que `goto-poi`/`compute-navigation`.
- **Simulation purement applicative, pas un vrai positionnement indoor.** Aucune donnée de capteur (BLE/Wi-Fi/UWB) n'est utilisée ; le `setInterval` fait juste avancer un point interpolé entre deux POI. C'est la mécanique d'affichage d'une position suivie qui est démontrée ici, pas une solution de localisation — voir le hors-scope "positionnement indoor réel" du hub (`VisioOneHub`, `CHECKLIST.md`).
- **Le rayon de précision ne s'applique qu'au tick suivant.** Comme le rayon est relu depuis un `ref` à chaque appel d'`injectTrackedPosition`, déplacer le curseur pendant que la simulation tourne n'a d'effet qu'à partir de la prochaine mise à jour (~150 ms plus tard), jamais instantanément ni rétroactivement sur la position déjà affichée.
- **La simulation survit à la fermeture du panneau.** Comme pour `occupancy-simulated`, fermer le `BottomSheet` ne stoppe pas le `setInterval` — seul le bouton "Stop" ou la sortie de l'écran (qui démonte `VisioOneMap` et détruit la `view`) l'arrête. Le timer est explicitement nettoyé dans le `onBeforeUnmount` de `FeatureView.vue`, comme celui de `occupancy-simulated`.
- **Appel SDK direct, sans pont.** Comme le reste de ce dépôt, `injectTrackedPosition`/`allowTracking` sont appelés directement sur l'instance `view` réelle — pas de sérialisation ni d'aller-retour natif↔JS comme sur les 4 autres plateformes démo.
