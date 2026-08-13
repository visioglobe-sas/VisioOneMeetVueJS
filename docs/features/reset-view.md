# Réinitialiser la vue

## Description

Recentre la caméra sur la carte en appelant `view.goToGlobal()` sur l'instance `view` exposée par `VisioOneMap` — comme pour l'occupation simulée, pas de pont à construire sur cette plateforme : le SDK tourne directement dans le DOM et `view` est un objet JS accessible depuis le composant parent, sans bridge natif↔JS à écrire.

## Step by step

1. **Récupérer la `view`** : `VisioOneMap` émet déjà `@ready="{ venue, view }"` (voir `handleReady` dans `src/views/FeatureView.vue`) — stocker `view` dans un `ref` dédié (`viewRef`), au même titre que `venueRef` pour la feature d'occupation simulée.
   ```js
   const viewRef = ref(null)

   function handleReady({ venue, view }) {
     venueRef.value = venue
     viewRef.value = view
   }
   ```
2. **Écrire une fonction `resetView`** qui appelle `goToGlobal()` sur la `view` stockée :
   ```js
   function resetView() {
     viewRef.value?.goToGlobal()
   }
   ```
3. **Ajouter un bouton** déclenchant `resetView`, affiché uniquement une fois la carte prête (`v-if="viewRef"`) :
   ```html
   <button v-if="viewRef" class="reset-view-button" @click="resetView">Reset view</button>
   ```

## Points d'attention

- **`viewRef` n'est disponible qu'après l'événement `ready`** — un appel à `resetView` avant ce moment est un no-op silencieux grâce à l'optional chaining (`viewRef.value?.goToGlobal()`) et au `v-if` qui masque le bouton, pas une erreur à gérer explicitement. Même remarque que pour `venueRef` sur la feature d'occupation simulée.
- `goToGlobal()` ne prend aucun paramètre ici : elle recentre sur la vue globale par défaut de la carte, pas sur une position ou un zoom personnalisés.

## Pour aller plus loin

- C'est la plateforme la plus simple des 5 pour cette feature : aucun pont natif↔JS, `view` est un objet JS ordinaire manipulable directement depuis le composant Vue.
