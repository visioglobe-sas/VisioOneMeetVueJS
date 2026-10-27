<template>
  <!-- Keyed on the URL so going from one feature screen straight to another
       remounts the screen (fresh state, fresh map) instead of reusing it. -->
  <router-view :key="$route.fullPath" />
</template>
