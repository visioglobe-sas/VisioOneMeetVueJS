import { createI18n } from 'vue-i18n'

import en from './locales/en.json'
import fr from './locales/fr.json'

const supportedLocales = ['en', 'fr']
const browserLocale = navigator.language?.split('-')[0]
const locale = supportedLocales.includes(browserLocale) ? browserLocale : 'en'

export const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: 'en',
  messages: { en, fr },
})
