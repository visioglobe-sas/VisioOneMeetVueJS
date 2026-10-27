<script setup>
// Shared shell of every feature screen: the map, the top bar (back link +
// feature title), the FAB and the BottomSheet that hosts the feature's panel
// (default slot). It holds no SDK logic of its own: each feature in
// src/features/ wraps it, passes its own map options and handles `ready`.
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import BottomSheet from './BottomSheet.vue'
import VisioOneMap from './VisioOneMap.vue'
import { features } from '../features'

const props = defineProps({
  // Map options, passed through to VisioOneMap. hash and baseURL default to
  // the .env values (VITE_VISIOONE_HASH / VITE_VISIOONE_BASE_URL).
  hash: { type: String, default: () => import.meta.env.VITE_VISIOONE_HASH },
  baseURL: { type: String, default: () => import.meta.env.VITE_VISIOONE_BASE_URL },
  viewOptions: { type: Object, default: () => ({}) },
  showSdkError: { type: Boolean, default: true },
  // Changing it remounts VisioOneMap: destroyView + unloadVenue, then a fresh
  // loadVenue + createView with the current options.
  mapKey: { type: String, default: 'default' },
  // false: no map at all (auth-token, a code-sample-only screen); the `body`
  // slot is shown instead.
  showMap: { type: Boolean, default: true },
  // Whether the FAB that opens the panel is shown.
  hasControls: { type: Boolean, default: true },
})

// Panel open state; a feature binds v-model:open only when it opens the
// panel itself (poi-click).
const open = defineModel('open', { type: Boolean, default: false })

const emit = defineEmits(['ready', 'error', 'poi-click', 'map-pointerdown', 'map-pointerup'])

const { t } = useI18n()
const route = useRoute()

const feature = computed(() => features.find((entry) => entry.slug === route.params.slug))

// The auth token is never set per feature: it only ever comes from .env.
const authorizationToken = import.meta.env.VITE_VISIOONE_AUTH_TOKEN

function handleError(error) {
  console.error('VisioOne error:', error)
  emit('error', error)
}
</script>

<template>
  <main class="feature">
    <slot v-if="!showMap" name="body" />
    <VisioOneMap
      v-else
      :key="mapKey"
      :hash="hash"
      :baseURL="baseURL"
      :authorizationToken="authorizationToken"
      :viewOptions="viewOptions"
      :showSdkError="showSdkError"
      @ready="emit('ready', $event)"
      @error="handleError"
      @poi-click="emit('poi-click', $event)"
      @pointerdown.capture="emit('map-pointerdown', $event)"
      @pointerup.capture="emit('map-pointerup', $event)"
    />

    <div class="top-bar">
      <router-link to="/" class="back-link">&larr; {{ t('home.back') }}</router-link>
      <span v-if="feature" class="top-bar__title">{{ t(feature.titleKey) }}</span>
    </div>

    <!-- Extra on-map overlays (e.g. poi-click's hint). -->
    <slot name="overlay" />

    <button v-if="hasControls" class="fab" :aria-label="t('home.openControls')" @click="open = true">⚙</button>

    <BottomSheet :visible="open" @close="open = false">
      <slot />
    </BottomSheet>
  </main>
</template>

<style scoped>
.feature {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.top-bar {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
}

.back-link {
  border-radius: 6px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.top-bar__title {
  border-radius: 6px;
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: #057dbc;
  color: #fff;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.3),
    0 2px 4px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  z-index: 15;
}
</style>
