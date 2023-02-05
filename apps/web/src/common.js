import 'virtual:windi.css'
import './style.postcss'

import { getBrowserLocale, locale, options, translations } from 'svelte-intl'

import fr from './locales/fr.yaml'

translations.update({ fr, en: {} })
locale.set(getBrowserLocale('fr'))
options.update({ formats: fr.formats })
