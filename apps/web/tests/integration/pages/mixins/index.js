// @ts-check
export { AuthenticatedHeaderMixin } from './authenticated-header.js'
export { GameAsideMixin } from './game-aside.js'
export { TermsSupportedMixin } from './terms-supported.js'

/**
 * @typedef {import('@playwright/test').Page} Page
 */

/**
 * @template T
 * @typedef {{ new(page: Page): T}} Constructor
 */

/**
 * @template {Constructor<?>[]} M
 * @typedef {M[4] extends Constructor<?>
 * ? InstanceType<M[4]> & InstanceType<M[3]> & InstanceType<M[2]> & InstanceType<M[1]> & InstanceType<M[0]>
 * : M[3] extends Constructor<?>
 * ? InstanceType<M[3]> & InstanceType<M[2]> & InstanceType<M[1]> & InstanceType<M[0]>
 * : M[2] extends Constructor<?>
 * ? InstanceType<M[2]> & InstanceType<M[1]> & InstanceType<M[0]>
 * : M[1] extends Constructor<?>
 * ? InstanceType<M[1]> & InstanceType<M[0]>
 * : InstanceType<M[0]>} UnpackConstructors
 */

/**
 * @type {<B, M extends Constructor<?>[]>(BaseConstructor: Constructor<B>, ...Mixins: M) => Constructor<B & UnpackConstructors<M>> }
 */
export function mixin(BaseConstructor, ...Mixins) {
  // @ts-ignore because TypeScript does not like constructor to have a generic parameter
  class Augmented extends BaseConstructor {
    constructor(page) {
      super(page)
      for (const Mixin of Mixins) {
        Object.assign(this, new Mixin(page))
      }
    }
  }
  for (const { prototype } of Mixins) {
    for (const method of Object.getOwnPropertyNames(prototype)) {
      if (method !== 'constructor') {
        Object.defineProperty(
          Augmented.prototype,
          method,
          // @ts-ignore the returned property can not be undefined
          Object.getOwnPropertyDescriptor(prototype, method)
        )
      }
    }
  }
  // @ts-ignore could not type Augmented properly
  return Augmented
}
