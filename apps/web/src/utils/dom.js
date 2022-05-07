import { auditTime, map, Subject } from 'rxjs'

/**
 * @typedef {object} Dimension the dimension of a HTML element.
 * @param {number} height - height, in pixel.
 */

/**
 * Computes the height, in pixel, or a displayed HTML element.
 * @param {HTMLElement} element - the sized element.
 * @returns {Dimension} its dimension in pixel.
 */
export function getPixelDimension(element) {
  const style = window.getComputedStyle(element)
  return { height: parseFloat(style.height), width: parseFloat(style.width) }
}

/**
 * @typedef {object} SizeObserver
 * @param {import('rxjs').Observable<Dimension>} dimension$ - emit an element size, in pixels.
 * @param {function} disconnect - function to release the observer and stop the observable.
 */

/**
 * Creates an RX Subject emitting every time an HTML element is resized.
 * @param {HTMLElement} element - the observed element
 * @param {number} [buffer=10] - buffer time applied to avoid emitting events too often.
 * @returns {SizeObserver} the created subject and function to release it.
 */
export function observeDimension(element, buffer = 10) {
  const subject$ = new Subject()
  const observer = new ResizeObserver(() => subject$.next())
  observer.observe(element)
  return {
    dimension$: subject$.pipe(
      auditTime(buffer),
      map(() => getPixelDimension(element))
    ),
    disconnect: () => observer.disconnect()
  }
}
