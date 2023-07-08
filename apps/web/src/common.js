import 'virtual:windi.css'
import './style.postcss'

import { locale, options, translations } from 'svelte-intl'

import en from './locales/en.yaml'
import fr from './locales/fr.yaml'
translations.update({ fr, en })

function enrichWithTz(obj = {}, timeZone) {
  return Object.fromEntries(
    Object.entries(obj).map(([name, definition]) => [
      name,
      { ...definition, timeZone }
    ])
  )
}

export function initLocale(lang = 'fr', timeZone = undefined) {
  locale.set(lang)
  const {
    formats: { number, date, time }
  } = fr
  options.update({
    formats: {
      number,
      date: enrichWithTz(date, timeZone),
      time: enrichWithTz(time, timeZone)
    }
  })
}
