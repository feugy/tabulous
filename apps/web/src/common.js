import './style.svelte'
import { locale, translations, getBrowserLocale } from 'svelte-intl'
import fr from './locales/fr.yaml'

translations.update({ fr })
locale.set(getBrowserLocale('fr'))
