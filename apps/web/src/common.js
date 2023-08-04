// @ts-check
import 'virtual:windi.css'
import './style.postcss'

import { locale, options, translations } from 'svelte-intl'

/** @typedef {'fr'|'en'} Locale Supported locales */
// @ts-expect-error: can not find module
import en from './locales/en.yaml'
// @ts-expect-error: can not find module
import fr from './locales/fr.yaml'
translations.update({ fr, en })

function enrichWithTz(obj = {}, /** @type {string|undefined} */ timeZone) {
  return Object.fromEntries(
    Object.entries(obj).map(([name, definition]) => [
      name,
      { ...definition, timeZone }
    ])
  )
}

/**
 * Initialize the locale used in svelte-intl, by selecting the right language and time zone.
 * @param {Locale} [lang='fr'] - locale used.
 * @param {string} [timeZone] - time zone used (UTC by default).
 */
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
