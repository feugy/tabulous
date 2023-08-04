/* eslint-disable no-unused-vars */
import '@poppanator/sveltekit-svg/dist/svg'

import type { Locale } from '@src/common'
import type { PlayerWithTurnCredentials } from '@src/graphql'
import type { DeepRequired } from '@src/types'

// for information about these interfaces
// See https://kit.svelte.dev/docs/types#app
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      bearer: string
      session: ?DeepRequired<PlayerWithTurnCredentials>
      timeZone: string | undefined
    }
    interface PageData {
      lang: Locale
    }
    // interface Platform {}
  }
}

export {}
