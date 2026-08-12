<script setup>
import VisioOneMap from './components/VisioOneMap.vue'

const visioOneHash = import.meta.env.VITE_VISIOONE_HASH
const visioOneBaseURL = import.meta.env.VITE_VISIOONE_BASE_URL
const visioOneAuthToken = import.meta.env.VITE_VISIOONE_AUTH_TOKEN

function handleReady({ venue, view }) {
  console.log('VisioOne venue loaded:', venue)
  console.log('VisioOne view created:', view)
}

function handleError(error) {
  console.error('VisioOne error:', error)
}

function handlePOIClick(event) {
  console.log('POI clicked:', event)
}
</script>

<template>
  <main class="app">
    <VisioOneMap
      :hash="visioOneHash"
      :base-url="visioOneBaseURL"
      :authorization-token="visioOneAuthToken"
      @ready="handleReady"
      @error="handleError"
      @poi-click="handlePOIClick"
    />
  </main>
</template>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
}
</style>
