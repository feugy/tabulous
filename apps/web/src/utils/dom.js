// @ts-check
import { auditTime, map, Subject } from 'rxjs'

import { browser } from '$app/environment'

/** @typedef {'base-darkest'|'base-darker'|'base-dark'|'base'|'base-light'|'base-lighter'|'base-lightest'|'primary-darkest'|'primary-darker'|'primary-dark'|'primary'|'primary-light'|'primary-lighter'|'primary-lightest'|'secondary-darkest'|'secondary-darker'|'secondary-dark'|'secondary'|'secondary-light'|'secondary-lighter'|'secondary-lightest'} CssColorVariables **/

/**
 * @typedef {object} Dimension the dimension of a HTML element.
 * @property {number} height - height, in pixel.
 * @property {number} width - width, in pixel.
 */

/**
 * Computes the height and width, in pixel, of a displayed HTML element.
 * @param {HTMLElement} element - the sized element.
 * @returns {Dimension} its dimension in pixel.
 */
export function getPixelDimension(element) {
  const style = window.getComputedStyle(element)
  return { height: parseFloat(style.height), width: parseFloat(style.width) }
}

/**
 * @typedef {object} SizeObserver
 * @property {import('rxjs').Observable<Dimension>} dimension$ - emit an element size, in pixels.
 * @property {() => void} disconnect - function to release the observer and stop the observable.
 */

/**
 * Creates an RX Subject emitting every time an HTML element is resized.
 * @param {HTMLElement} element - the observed element
 * @param {number} [buffer=10] - buffer time applied to avoid emitting events too often.
 * @returns {SizeObserver} the created subject and function to release it.
 */
export function observeDimension(element, buffer = 10) {
  const subject$ = new Subject()
  const observer = new ResizeObserver(() => subject$.next(void 0))
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
 * @param {Record<string, ?string|undefined>} variables - hash of Css variables (without the -- prefix).
 */
export function setCssVariables(element, variables) {
  for (const [name, value] of Object.entries(variables)) {
    if (value != undefined) {
      element.style.setProperty(`--${name}`, value)
    }
  }
}

/**
 * @typedef {object} CornerClipPath
 * @property {string} d - the d attribute of the SVG path.
 * @property {string} transform - transform to apply to the SVG path.
 * @property {string} transform-origin - transform origin for the SVG path.
 */

/**
 * Computes a SVG clip path for a rounded tab.
 * The returned properties must be applied like this:
 * <svg style="width:0px; height:0px">
 *   <clipPath id={id} clipPathUnits="objectBoundingBox">
 *    <path {...corner} />
 *   </clipPath>
 * </svg>
 * and then referenced in a clip-path css property: `clip-path: var(--id);`
 *
 * @param {object} args - generated clip path arguments:
 * @param {number} [args.curve=0.5] - percentage for the curve (between 0 and 1)
 * @param {boolean} [args.inverted=false] - whether to invert the curve.
 * @param {'top'|'bottom'|'left'|'right'} [args.placement='top'] - tab placement.
 * @returns {[string, CornerClipPath]} the generated clip path
 */
export function buildCornerClipPath({
  curve = 0.5,
  inverted = false,
  placement = 'top'
} = {}) {
  return [
    `clip-path-${Math.floor(Math.random() * 100000)}`,
    {
      transform: `rotate(${
        placement === 'right' || placement === 'left' ? 90 : 0
      }) scale(1, ${placement === 'right' || placement === 'top' ? -1 : 1})`,
      d: inverted
        ? `M 0 0 C ${curve} 0 ${1 - curve} 1 1 1 H 0 Z`
        : `M 0 1 C ${curve} 1 ${1 - curve} 0 1 0 V 1 Z`,
      'transform-origin': '0.5 0.5'
    }
  ]
}

/**
 * Detect touch screens
 * @returns {boolean} true if this screens has touch capabilities.
 */
export function isTouchScreen() {
  return browser ? navigator?.maxTouchPoints > 0 : false
}
