<script setup>
// auth-token is a code sample only: src/components/ProtectedVisioOneMap.vue.
// This demo has no protected map, so the screen loads no map at all. See
// docs/features/auth-token.md.
import { useI18n } from 'vue-i18n'

import FeatureScreen from '../components/FeatureScreen.vue'

const { t } = useI18n()
</script>

<template>
  <FeatureScreen :show-map="false" :has-controls="false">
    <template #body>
      <div class="auth-token-sample">
        <p>
          {{
            t('features.authToken.body', {
              file: 'src/components/ProtectedVisioOneMap.vue',
              doc: 'docs/features/auth-token.md',
            })
          }}
        </p>
      </div>
    </template>
  </FeatureScreen>
</template>

<style scoped>
.auth-token-sample {
  box-sizing: border-box;
  height: 100%;
  padding: 72px 20px 20px;
  overflow-y: auto;
  line-height: 1.5;
}

.auth-token-sample p {
  max-width: 640px;
  margin: 0 auto;
}
</style>
