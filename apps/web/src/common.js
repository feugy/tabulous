import { getBrowserLocale, locale, options, translations } from 'svelte-intl'
import './style.svelte'
import fr from './locales/fr.yaml'

translations.update({ fr })
locale.set(getBrowserLocale('fr'))
options.update({ formats: fr.formats })
