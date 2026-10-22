<script setup>
// Code sample: load a map protected by an authorization token (JWT).
//
// Every value below is a PLACEHOLDER. This demo has no protected map to
// load, so nothing in the app mounts this component: copy it into your own
// app and replace PROTECTED_MAP_HASH and AUTHORIZATION_TOKEN with your own
// values. See docs/features/auth-token.md.
//
// It reuses VisioOneMap.vue, which does the actual SDK calls:
//   const venue = await visioOne.loadVenue({
//     vg_maphash: PROTECTED_MAP_HASH,
//     baseURL: PROTECTED_MAP_SERVER_URL,
//     authorizationToken: token,
//   }, loaderContainer)
//   const view = await visioOne.createView(container, venue)
import { shallowRef } from 'vue'

import VisioOneMap from './VisioOneMap.vue'

// Your protected map's own hash (distinct from any public map hash).
const PROTECTED_MAP_HASH = 'YOUR_PROTECTED_MAP_HASH'

// The protected map server. The standard https://mapserver.visioglobe.com/
// does not enforce tokens.
const PROTECTED_MAP_SERVER_URL = 'https://mapserver-auth.visioglobe.com/'

// The JWT must be issued by YOUR OWN backend (Visioglobe provides the signing
// secret and the claims to use) and fetched by the app at runtime. Never
// embed the signing secret in the app or the page.
const AUTHORIZATION_TOKEN = 'YOUR_JWT_FROM_YOUR_BACKEND'

const emit = defineEmits(['ready', 'unauthorized', 'error'])

const venue = shallowRef(null)
const view = shallowRef(null)

// The SDK 1.1.0 package does not export the UnauthorizedError class at
// runtime (only its TypeScript declaration) and its `name` stays 'Error'.
// The class name survives Vite's build, but a bundler that mangles class
// names would change it, so the message is checked as a fallback.
function isUnauthorizedError(error) {
  return (
    error?.constructor?.name === 'UnauthorizedError' ||
    /authorization token/i.test(error?.message ?? '')
  )
}

function handleReady(instances) {
  venue.value = instances.venue
  view.value = instances.view
  emit('ready', instances)
}

function handleError(error) {
  if (isUnauthorizedError(error)) {
    console.error('Protected map: token invalid, expired or missing.', error)
    emit('unauthorized', error)
  } else {
    console.error('Protected map: the venue could not be loaded.', error)
    emit('error', error)
  }
}

// Call this with a fresh token from your backend BEFORE the current one
// expires (tokens live at most 1 hour). It applies to every later map
// request; no reload is needed.
function refreshAuthorizationToken(freshToken) {
  if (!venue.value) throw new Error('Protected map: no venue loaded yet.')
  venue.value.setAuthorizationToken(freshToken)
}

defineExpose({ venue, view, refreshAuthorizationToken, isUnauthorizedError })
</script>

<template>
  <VisioOneMap
    :hash="PROTECTED_MAP_HASH"
    :baseURL="PROTECTED_MAP_SERVER_URL"
    :authorizationToken="AUTHORIZATION_TOKEN"
    @ready="handleReady"
    @error="handleError"
  />
</template>
