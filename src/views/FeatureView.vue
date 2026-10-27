<script setup>
// Router host of /feature/:slug: looks the slug up in src/features.js and
// renders that feature's own component (src/features/<Slug>.vue). Every
// feature screen wraps src/components/FeatureScreen.vue (map, top bar, FAB,
// panel). App.vue keys <router-view> on the URL, so each screen gets a fresh
// component, state and map.
import { defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'

import { features } from '../features'

const props = defineProps({
  slug: { type: String, required: true },
})

const { t } = useI18n()

const feature = features.find((entry) => entry.slug === props.slug)
const FeatureComponent = feature ? defineAsyncComponent(feature.component) : null
</script>

<template>
  <component :is="FeatureComponent" v-if="FeatureComponent" />
  <main v-else class="not-found">
    <p>{{ t('home.featureNotFound', { slug }) }}</p>
    <router-link to="/">&larr; {{ t('home.back') }}</router-link>
  </main>
</template>

<style scoped>
.not-found {
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 16px;
}
</style>
