# Occupation temps réel (données simulées)

## Description

Colore dynamiquement la surface d'un POI pour refléter un statut d'occupation (libre / bientôt occupé / occupé), en appelant directement `venue.updateSurface(surface, { color })` sur l'instance `venue` exposée par `VisioOneMap` — pas de pont à construire ici, contrairement aux plateformes qui embarquent le SDK dans une WebView : le SDK tourne directement dans le DOM et `venue`/`view` sont des objets JS accessibles depuis le composant parent.

Il n'y a pas de vrai capteur derrière : un `setInterval` fait tourner la couleur toutes les 2,5 secondes, en lieu et place d'un flux IoT réel. C'est le point de départ pour brancher une vraie source de données (websocket, polling d'API) sans rien changer côté composant `VisioOneMap`.

## Step by step

1. **Récupérer la `venue`** : `VisioOneMap` émet déjà `@ready="{ venue, view }"` (voir `handleReady` dans `src/views/FeatureView.vue`) — stocker `venue` dans un `ref` pour pouvoir l'utiliser plus tard, en dehors du handler.
2. **Écrire une fonction `updateOccupancy(placeId, color)`** qui retrouve le POI et colore ses surfaces :
   ```js
   function updateOccupancy(targetPlaceId, color) {
     const venue = venueRef.value
     if (!venue) return
     const poi = venue.pois.find((p) => p.id === targetPlaceId)
     if (!poi) return
     poi.surfaces.forEach((surface) => venue.updateSurface(surface, { color }))
   }
   ```
3. **Démarrer un `setInterval`** qui appelle cette fonction avec une couleur différente à chaque tick, déclenché par un contrôle utilisateur (ici, un champ Place ID + un bouton toggle).
4. **Toujours nettoyer le timer** (`clearInterval`) — au moment d'arrêter la simulation ET dans `onBeforeUnmount` — et remettre `color: undefined` pour réinitialiser la surface plutôt que de la laisser bloquée sur la dernière couleur simulée.

## Points d'attention

- **`placeId` doit être un vrai ID de POI de la carte chargée.** `venue.pois.find(...)` échoue silencieusement (pas d'erreur) si l'ID ne correspond à rien — vérifier avec un ID qui fonctionne déjà pour un clic POI (`@poi-click`).
- **`color: undefined` réinitialise l'apparence de la surface** à son état normal — ce n'est pas une couleur par défaut à coder en dur.
- **`venue` n'est disponible qu'après l'événement `ready`** — un appel à `updateOccupancy` avant ce moment est un no-op silencieux (`venueRef.value` est encore `null`), pas une erreur à gérer explicitement.
- Ceci démontre la **mécanique** de mise à jour temps réel, pas une vraie intégration IoT — pour un cas client réel, remplacer le `setInterval` par un abonnement à la vraie source (websocket, polling d'API).

## Pour aller plus loin

- Version "vrai capteur" : voir le `ROADMAP.md` du hub (`VisioOneHub`), feature "Suivi d'actifs connectés (IoT)" — hors scope tant qu'aucun flux IoT réel n'est disponible.
