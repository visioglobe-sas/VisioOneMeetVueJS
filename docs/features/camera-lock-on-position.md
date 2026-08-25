# Verrouillage caméra sur la position (camera-lock-on-position)

## Description

Ajoute, au-dessus de la démonstration `simulated-position` (mêmes champs Origine/Destination + Start/Stop), un interrupteur "Recentrer la caméra sur la position" qui bascule `view.lockCameraPositionOnTracking` — une simple propriété booléenne de la classe `View` du SDK — pour verrouiller le focus de la caméra sur la position actuellement suivie, comme le fait un mode "recentrer sur moi" d'une app GPS.

Comme pour `simulated-position`, aucune donnée de positionnement indoor réelle n'est utilisée : il faut une position suivie en mouvement pour voir l'effet du verrouillage, donc cet écran réexpose intégralement les contrôles de simulation existants (résolution des deux POI par ID, `setInterval` qui interpole et appelle `view.injectTrackedPosition`) et y ajoute uniquement la case à cocher de verrouillage. Toute la logique de simulation de position (`toggleSimulatedPosition`, `startSimulatedPosition`, `stopSimulatedPosition`, `injectSimulatedPositionTick`, `originPoiId`, `destinationPoiId`, `accuracyRadius`, `simulatingPosition`, `positionError`) est **partagée avec** l'écran `simulated-position` — ce ne sont pas des refs/fonctions dupliquées par slug, seul le panneau affiché dans `FeatureView.vue` diffère (bloc `v-else-if="props.slug === 'camera-lock-on-position'"`).

## Step by step

1. **Démarrer une simulation de position comme sur l'écran `simulated-position`** : deux champs Place ID (origine/destination), bouton Start/Stop. Voir `docs/features/simulated-position.md` pour le détail de cette mécanique (résolution POI → position, `allowTracking = true`, `setInterval` d'aller-retour).
2. **Verrouiller la caméra sur la position suivie**, une fois la simulation démarrée, en cochant la case "Recentrer la caméra sur la position" :
   ```js
   const lockCameraOnPosition = ref(false)

   function toggleCameraLock() {
     const view = viewRef.value
     if (!view) return
     lockCameraOnPosition.value = !lockCameraOnPosition.value
     view.lockCameraPositionOnTracking = lockCameraOnPosition.value
   }
   ```
   Comme pour `injectTrackedPosition`/`allowTracking`, c'est un appel direct sur l'instance `view` réelle exposée par `VisioOneMap.vue` — pas de pont natif↔JS à construire sur ce dépôt.
3. **La case est désactivée tant qu'aucune simulation ne tourne** (`:disabled="!simulatingPosition"` dans le template) — verrouiller la caméra sur une position qui n'existe pas n'a pas de sens, et `lockCameraPositionOnTracking` n'a de toute façon aucun effet visible sans `allowTracking = true` (voir "Points d'attention").
4. **Réinitialiser le verrou à chaque arrêt de la simulation**, pour que redémarrer reparte toujours décoché — trois cas ramenés à une seule fonction :
   ```js
   function resetCameraLock() {
     lockCameraOnPosition.value = false
     if (viewRef.value) viewRef.value.lockCameraPositionOnTracking = false
   }
   ```
   appelée depuis :
   - `stopSimulatedPosition()` (bouton Stop) ;
   - la branche "POI introuvable" de `startSimulatedPosition()` (erreur `notFound`) ;
   - le `onBeforeUnmount` de `FeatureView.vue` (sortie de l'écran).
5. **UI** : même panneau `BottomSheet.vue` que `simulated-position` (champs Origine/Destination, curseur de rayon de précision, bouton Start/Stop, message d'erreur), avec une ligne supplémentaire reprenant le style toggle déjà utilisé par `ui-part-visibility` (classes `ui-part-panel__row`/`ui-part-panel__switch`), assombrie via `camera-lock-panel__row--disabled` quand elle est désactivée. Voir le bloc `v-else-if="props.slug === 'camera-lock-on-position'"` dans `src/views/FeatureView.vue`, et l'entrée correspondante dans la liste de conditions qui affiche le FAB (`⚙`).

## Points d'attention

- **`lockCameraPositionOnTracking` sans `allowTracking = true` est un no-op silencieux, pas une exception.** Le commentaire de doc du SDK (`View.d.ts`) est explicite : *"This won't have any effect if flag 'allowTracking' isn't set to true."* — contrairement à `injectTrackedPosition`, qui lève une exception si `allowTracking` est resté `false`. Il n'y a donc pas besoin d'un `try/catch` ici ; désactiver la case tant qu'aucune simulation ne tourne est une précaution UX, pas une nécessité pour éviter un crash.
- **Propriété "fire and forget", pas d'événement de confirmation.** `lockCameraPositionOnTracking` est un simple setter booléen sur `View` — aucun événement ni retour ne confirme que la caméra a effectivement recentré son focus ; l'effet ne se voit qu'à l'écran (la caméra suit le dot au tick suivant).
- **Ne verrouille que la position, pas l'orientation.** Le SDK expose une propriété sœur, `lockCameraOrientationOnTracking`, pour verrouiller l'orientation de la caméra sur les données du capteur d'orientation de l'appareil — volontairement hors périmètre ici (pas de capteur d'orientation exploité par cette démo, qui tourne dans un navigateur desktop/mobile générique sans garantie d'accès à ce capteur).
- **Le verrou doit être remis à zéro à chaque arrêt de simulation, explicitement.** Comme le SDK ne réinitialise pas `lockCameraPositionOnTracking` lui-même quand `allowTracking` repasse à `false`, oublier de le faire côté application laisserait un état "verrouillé" fantôme qui réapparaîtrait sans action utilisateur au prochain démarrage — d'où `resetCameraLock()` appelée aux trois points de sortie (Stop, erreur "POI introuvable", démontage de l'écran), pour garantir qu'un redémarrage reparte toujours en opt-in explicite, décoché.
- **Repose entièrement sur la mécanique de `simulated-position`.** Il n'y a pas de "vraie" position suivie ici : sans simulation en cours (donc sans `allowTracking = true`), cocher la case n'aurait aucun effet visible — voir les "Points d'attention" de `simulated-position.md` sur le caractère purement applicatif de cette simulation.
- **Appel SDK direct, sans pont.** Comme le reste de ce dépôt, `lockCameraPositionOnTracking` est lu/écrit directement sur l'instance `view` réelle exposée par `VisioOneMap.vue` via `defineExpose` — pas de sérialisation ni d'aller-retour natif↔JS comme sur les 4 autres plateformes démo (`VisioOneMeetAndroid`, `VisioOneMeetIos`, `VisioOneMeetRN`, `VisioOneMeetFlutter`).
