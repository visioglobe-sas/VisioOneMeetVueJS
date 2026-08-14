# Masquage sélectif de l'UI (ui-part-visibility)

## Description

Permet à l'application de montrer/masquer individuellement chacune des 5 parties de l'UI par défaut affichée par le SDK sur la carte, via `view.setUIPartVisible(uiPart, isVisible)` (et sa consultation via `view.isUIPartVisible(uiPart)`). Les valeurs valides de `uiPart` sont exactement `'floorSelector'`, `'navigation'`, `'poiDetails'`, `'search'` et `'userTracking'` (type `UIPart`, `View.ts`) — aucune autre n'existe.

Comme pour `goto-poi`, `occupancy-simulated` et `floor-selector`, pas de pont natif↔JS à construire : le SDK tourne dans le DOM et `view` est un objet JS directement accessible depuis `src/views/FeatureView.vue`. C'est d'ailleurs la seule des 5 plateformes démo où l'appel SDK se fait ainsi en direct — les 4 autres passent par une WebView et un pont natif↔JS pour atteindre le même `view`.

## Step by step

1. **Déclarer la liste des 5 valeurs `UIPart`** et un état réactif initialisé à `true` pour chacune (le SDK affiche tout par défaut ; rien n'est masqué tant que l'utilisateur n'a pas basculé un switch) :
   ```js
   const UI_PARTS = ['floorSelector', 'navigation', 'poiDetails', 'search', 'userTracking']
   const uiPartVisibility = ref(Object.fromEntries(UI_PARTS.map((part) => [part, true])))
   ```

2. **Basculer une partie de l'UI** au changement d'un switch, en appelant `setUIPartVisible` directement sur la `view` en cours :
   ```js
   function toggleUIPart(uiPart) {
     const view = viewRef.value
     if (!view) return
     const isVisible = !uiPartVisibility.value[uiPart]
     uiPartVisibility.value[uiPart] = isVisible
     view.setUIPartVisible(uiPart, isVisible)
   }
   ```
   L'état local (`uiPartVisibility`) et l'état réel de la `view` sont mis à jour dans le même geste — pas de relecture via `isUIPartVisible` après coup, puisque ce panneau est le seul point de contrôle de ces 5 parties (contrairement à `floor-selector`, rien d'autre ne peut faire changer cet état en dehors de ce panneau, donc pas besoin d'écouteur d'événement pour rester synchronisé).

3. **UI** : bouton FAB (`⚙`) ouvrant le panneau modal `BottomSheet.vue` (déjà utilisé par `reset-view`, `occupancy-simulated`, `poi-click`, `goto-poi`, `floor-selector`, `compute-navigation`), contenant une liste de 5 lignes libellées (Sélecteur d'étage / Navigation / Détails du POI / Recherche / Suivi utilisateur), chacune avec une case à cocher stylée en switch on/off :
   ```html
   <label v-for="part in UI_PARTS" :key="part" class="ui-part-panel__row">
     <span class="ui-part-panel__label">{{ t(`features.uiPartVisibility.parts.${part}`) }}</span>
     <input
       type="checkbox"
       class="ui-part-panel__switch"
       :checked="uiPartVisibility[part]"
       @change="toggleUIPart(part)"
     />
   </label>
   ```
   Voir le bloc `v-else-if="props.slug === 'ui-part-visibility'"` dans `src/views/FeatureView.vue`. L'apparence de switch est purement CSS (`input[type=checkbox]` avec `appearance: none` et un pseudo-élément `::before` pour le curseur), pas de composant tiers.

## Points d'attention

- **N'appeler `setUIPartVisible` qu'une fois la vue chargée.** `toggleUIPart` vérifie `viewRef.value` avant tout appel — la garde existe surtout par cohérence avec le reste de `FeatureView.vue` (le FAB de cette feature n'est de toute façon affiché qu'après que `handleReady` ait posé `viewRef`), mais reste indispensable si un appel venait à être déclenché plus tôt.
- **Les 5 valeurs `UIPart` sont exactes et sensibles à la casse** (`floorSelector`, `navigation`, `poiDetails`, `search`, `userTracking`) — pas de validation runtime côté SDK visible dans les typings, une faute de frappe échoue silencieusement plutôt que de lever une erreur explicite.
- **Masquer `search` ou `navigation` retire le seul moyen pour le client de déclencher ces flux du SDK** (pas de recherche possible sans le widget `search`, pas de démarrage de guidage sans le widget `navigation`) — dans cette démo, les deux restent réversibles depuis le même panneau, donc toujours ré-affichables en un tap ; dans une vraie app cliente, masquer l'un de ces deux UIPart n'a de sens que si l'app fournit sa propre UI de remplacement pour déclencher le même flux (recherche maison, bouton "Itinéraire" applicatif comme `compute-navigation`, etc.).
- **Seule plateforme démo appelant le SDK en direct.** Sur Android/iOS/Flutter/React Native, la même fonctionnalité passerait par un pont natif↔JS pour atteindre `view.setUIPartVisible` dans la WebView ; ici, `viewRef.value` est l'instance SDK réelle, donc l'appel est un simple appel de méthode JS sans sérialisation ni aller-retour asynchrone.
- **État non persistant entre navigations.** Comme la carte/WebView est recréée à chaque écran (pas d'instance partagée), `uiPartVisibility` est réinitialisé à `true` pour les 5 parties à chaque nouvelle entrée sur l'écran de cette feature — aucun état résiduel d'une précédente visite.
