import { locale, translations, getBrowserLocale } from 'svelte-intl'
import './style.svelte'
import fr from './locales/fr.yaml'

translations.update({ fr })
locale.set(getBrowserLocale('fr'))
