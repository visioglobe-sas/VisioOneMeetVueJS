import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '../views/HomeView.vue'
import FeatureView from '../views/FeatureView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/feature/:slug', name: 'feature', component: FeatureView, props: true },
  ],
})
