import { locale, translations, getBrowserLocale } from 'svelte-intl'
import './style.svelte'
import fr from './locales/fr.yaml'
import en from './locales/fr.yaml'

translations.update({ fr, en })
locale.set(getBrowserLocale('fr'))
