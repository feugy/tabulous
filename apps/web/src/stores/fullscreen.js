import { browser } from '$app/environment'
import { BehaviorSubject } from 'rxjs'
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
 * Enters or leaves fullscreen mode, updating the relevant store.
 */
export async function toggleFullscreen() {
  if (fullscreen$.value) {
    try {
      document.exitFullscreen?.()
      fullscreen$.next(false)
    } catch (error) {
      logger.warn({ error }, `failed to leave fullscreen: ${error.message}`)
    }
  } else {
    try {
      await document.documentElement?.requestFullscreen()
      fullscreen$.next(true)
    } catch (error) {
      logger.warn({ error }, `failed to enter fullscreen: ${error.message}`)
    }
  }
}
