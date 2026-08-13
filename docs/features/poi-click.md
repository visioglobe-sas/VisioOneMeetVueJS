# Réagir au clic sur un POI

## Description

Affiche le détail du (ou des) POI tapé(s) sur la carte dans un panneau modal, à partir de l'événement `poiclick` émis par la `view` VisioOne. Comme pour les autres features de ce repo, pas de pont natif↔JS à construire : `VisioOneMap` écoute déjà l'événement SDK (`view.addEventListener('poiclick', ...)`, voir `src/components/VisioOneMap.vue`) et le réémet en événement Vue `@poi-click`.

Avant cette implémentation, le handler de cet événement se contentait d'un `console.log` (`handlePOIClick` dans `src/views/FeatureView.vue`) — aucune réaction visible pour l'utilisateur, ce qui ne satisfaisait pas la barre "démontré avec une interaction utilisateur" du hub. Cette feature ajoute la réaction UI manquante : taper un POI ouvre désormais un panneau listant son nom, son ID, son étage et ses catégories.

Contrairement aux autres features de cet écran (`reset-view`, `occupancy-simulated`), le déclencheur n'est pas un FAB mais l'événement carte lui-même : taper un POI ouvre directement le panneau, sans étape intermédiaire.

## Step by step

1. **Écouter l'événement** : rien à faire côté SDK, `VisioOneMap` transmet déjà `poiclick` via `@poi-click`. Le payload est un `POIEvent` (voir `node_modules/@visioglobe/visioone/dist/src/VisioOne/View/Events/POIEvent.d.ts`) avec, entre autres, un champ `pois: POI[]` — un tableau, pas un seul POI, car un clic peut toucher plusieurs objets superposés (ex. un marker posé sur une surface).
   ```js
   const clickedPois = ref([])

   function handlePOIClick(event) {
     if (props.slug !== 'poi-click') return
     clickedPois.value = event.pois ?? []
     controlsOpen.value = true
   }
   ```
2. **Dériver un nom lisible** : un `POI` n'a pas de champ `name` direct — le nom vient du texte de son premier `Label` (`poi.labels[0].text`), avec repli sur l'`id` si le POI n'a pas de label.
   ```js
   function poiName(poi) {
     return poi.labels?.[0]?.text || poi.id
   }
   ```
3. **Réutiliser le panneau modal existant** (`BottomSheet.vue`, déjà utilisé par `reset-view` et `occupancy-simulated`) pour afficher la liste des POIs cliqués — même fond opaque, même transition slide-up, même fermeture par tap sur le scrim ou bouton de fermeture. Voir le bloc `v-else-if="props.slug === 'poi-click'"` dans `src/views/FeatureView.vue`.
4. **Ajouter un indice discret** quand aucun POI n'a encore été cliqué (`.poi-hint`), pour que l'utilisateur sache où taper avant la première interaction — ce n'est pas strictement nécessaire au SDK, mais évite un écran vide et silencieux à l'arrivée sur la feature.

## Points d'attention

- **`event.pois` est un tableau, pas un objet unique.** Un clic peut correspondre à plusieurs POIs superposés (marker + surface, par exemple) ; le panneau boucle sur `clickedPois` plutôt que de n'afficher qu'un seul résultat, pour rester fidèle au payload réel plutôt que de deviner lequel afficher.
- **Pas de champ `name` sur `POI`.** Le nom affiché vient de `poi.labels[0]?.text`, avec repli sur `poi.id` si le POI n'a pas de label visible sur la carte — à vérifier avec une carte de démo qui a effectivement des labels, sinon le panneau n'affichera que des IDs.
- **`poi.floor` et `poi.categories` sont optionnels/peuvent être vides** selon comment le POI a été modélisé dans VisioMapEditor — le panneau masque ces lignes plutôt que d'afficher un champ vide (`v-if="poi.floor"`, `v-if="poi.categories?.length"`).
- **`@poi-click` est câblé sur `VisioOneMap` pour tous les écrans de feature**, pas seulement `poi-click` — le handler `handlePOIClick` filtre sur `props.slug === 'poi-click'` avant de toucher au panneau, pour ne pas ouvrir de modal sur un écran qui ne l'attend pas. Le `console.log` d'origine reste conservé pour toutes les features (utile en debug), seule la réaction UI est conditionnée au slug.
- **Ce n'était auparavant qu'un `console.log`** marqué ✅ dans `CHECKLIST.md` par erreur : le hub exige une interaction utilisateur visible pour ce statut, pas seulement un event bien reçu côté code. Cette implémentation ajoute la partie manquante.

## Pour aller plus loin

- Le même événement pourrait aussi piloter d'autres réactions (mise en évidence de la surface cliquée, navigation vers ce POI) — hors scope ici, cette feature se limite à l'affichage d'information, conformément à son intitulé dans `CHECKLIST.md`.
