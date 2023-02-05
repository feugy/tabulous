import { getValue } from '@src/utils'
import { derived } from 'svelte/store'
import { locale } from 'svelte-intl'

const defaultLocale = 'fr'
/* c8 ignore start */
const locale$ = derived(locale, value => value || defaultLocale)
/* c8 ignore stop */

/**
 * Readable store a collator for comparisons, configured with current locale.
 */
export const comparator$ = derived(
  locale$,
  locale => new Intl.Collator(locale, { numeric: true, usage: 'sort' })
)

/**
 * Builds a readable store containing a function for sorting arrays, based on locale collator.
 * It can dive into compared object properties to find a comparable value.
 * @param {string} propertyPath - the path to property used for comparison.
 * Use . to dive into sub-object (or array index). You can use $locale as a placeholder for a propety named after the current locale:
 * `locales.$locale.titles`
 * @returns {import('svelte/store').Readable<<T>(a: T, b: T) => number>}
 */
export function buildLocaleComparator(propertyPath) {
  return derived([comparator$, locale$], ([comparator, locale]) => {
    const path = propertyPath?.replace('$locale', locale).split('.') ?? []
    return (itemA, itemB) =>
      comparator.compare(getValue(itemA, path), getValue(itemB, path))
  })
}
