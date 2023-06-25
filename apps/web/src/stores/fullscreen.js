import { BehaviorSubject } from 'rxjs'

import { browser } from '$app/environment'

import { makeLogger } from '../utils'

const logger = makeLogger('fullscreen')

const fullscreen$ = new BehaviorSubject(
  browser ? Boolean(document.fullscreenElement) : false
)

/**
 * Emits whenever the application enters or leaves the fullscreen mode
 * @type {Observable<boolean>}
 */
export const isFullscreen = fullscreen$.asObservable()

/**
 * Enters fullscreen mode.
 * @returns {Promise<void>}
 */
export async function enterFullscreen() {
  if (!fullscreen$.value) {
    try {
      await document.documentElement?.requestFullscreen()
      fullscreen$.next(true)
    } catch (error) {
      logger.warn({ error }, `failed to enter fullscreen: ${error.message}`)
    }
  }
}

/**
 * Leaves fullscreen mode.
 * @returns {Promise<void>}
 */
export async function leaveFullscreen() {
  if (fullscreen$.value) {
    try {
      document.exitFullscreen?.()
      fullscreen$.next(false)
    } catch (error) {
      logger.warn({ error }, `failed to leave fullscreen: ${error.message}`)
    }
  }
}

/**
 * Enters or leaves fullscreen mode, updating the relevant store.
 * @returns {Promise<void>}
 */
export async function toggleFullscreen() {
  if (fullscreen$.value) {
    leaveFullscreen()
  } else {
    enterFullscreen()
  }
}
