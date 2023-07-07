import 'virtual:windi.css'
import './style.postcss'

import { getBrowserLocale, locale, options, translations } from 'svelte-intl'

import fr from './locales/fr.yaml'

export function initLocale(timeZone) {
  translations.update({ fr, en: {} })
  locale.set(getBrowserLocale('fr'))
  options.update({
    formats: {
      ...fr.formats,
      date: {
        ...Object.fromEntries(
          Object.entries(fr.formats.date).map(([name, definition]) => [
            name,
            { ...definition, timeZone }
          ])
        )
      }
    }
  })
}
