import { auditTime, map, Subject } from 'rxjs'

import { browser } from '$app/environment'

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

/**
 * Defines new css variables on a given element, returning any existing values.
 * @param {HTMLElement} element - element to set variables on.
 * @param {object} variables - hash of Css variables (without the -- prefix).
 */
export function setCssVariables(element, variables) {
  for (const [name, value] of Object.entries(variables)) {
    if (value != undefined) {
      element.style.setProperty(`--${name}`, value)
    }
  }
}

/**
 * TODOC
 */
export function buildCornerClipPath({
  curve = 0.5,
  inverted = false,
  placement = 'top'
} = {}) {
  return {
    id: `clip-path-${Math.floor(Math.random() * 100000)}`,
    transform: `rotate(${
      placement === 'right' || placement === 'left' ? 90 : 0
    }) scale(1, ${placement === 'right' || placement === 'top' ? -1 : 1})`,
    d: inverted
      ? `M 0 0 C ${curve} 0 ${1 - curve} 1 1 1 H 0 Z`
      : `M 0 1 C ${curve} 1 ${1 - curve} 0 1 0 V 1 Z`
  }
}

/**
 * Detect touch screens
 * @returns {boolean} true if this screens has touch capabilities.
 */
export function isTouchScreen() {
  return browser ? navigator?.maxTouchPoints > 0 : false
}
