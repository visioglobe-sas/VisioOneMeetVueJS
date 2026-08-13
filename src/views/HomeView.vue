<script setup>
import { useI18n } from 'vue-i18n'

import { features } from '../features'

const { t } = useI18n()
</script>

<template>
  <main class="home">
    <h1>{{ t('home.title') }}</h1>

    <ul class="home__list">
      <li v-for="feature in features" :key="feature.slug">
        <router-link :to="`/feature/${feature.slug}`" class="home__item">
          <span class="home__item-title">{{ t(feature.titleKey) }}</span>
          <span class="home__item-description">{{ t(feature.descriptionKey) }}</span>
        </router-link>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.home {
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 16px;
}

.home__list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.home__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 8px;
  padding: 14px 16px;
  background: #f2f2f2;
  color: inherit;
  text-decoration: none;
}

.home__item-title {
  font-weight: 600;
}

.home__item-description {
  font-size: 0.9em;
  opacity: 0.75;
}
</style>
