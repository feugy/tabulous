import '@testing-library/jest-dom'
import crypto from 'crypto'
import 'whatwg-fetch'
import '../../src/common'
import { init } from '../../../../node_modules/@sveltejs/kit/src/runtime/client/singletons.js'
// Babylon.js side effect imports
import '@babylonjs/core/Materials/standardMaterial'

const jestExpect = expect
// freely inspired from Playwright's expect
// @see https://github.com/microsoft/playwright/blob/main/packages/playwright-test/src/expect.ts
global.expect = function (actual, message) {
  if (!message) {
    return jestExpect(actual)
  }
  const get = (target, matcherName, receiver) => {
    let matcher = Reflect.get(target, matcherName, receiver)
    if (matcher === undefined) {
      throw new Error(`expect: Property '${matcherName}' not found.`)
    }
    if (typeof matcher !== 'function') {
      return new Proxy(matcher, { get })
    }
    function reportError(error) {
      error.message = `${message}\n\n${error.message}`
      const stackFrames = error.stack.split('\n')
      error.stack = stackFrames
        .filter(frame => !frame.startsWith('    at Proxy.call'))
        .join('\n')
      throw error
    }
    return (...args) => {
      try {
        const result = matcher.call(target, ...args)
        if (result instanceof Promise) {
          return result.catch(reportError)
        } else {
          return result
        }
      } catch (error) {
        reportError(error)
      }
    }
  }
  return new Proxy(jestExpect(actual), { get })
}
Object.assign(global.expect, jestExpect)

init({
  client: {
    goto: jest.fn(),
    invalidate: jest.fn(),
    prefetch: jest.fn(),
    before_navigate: jest.fn(),
    after_navigate: jest.fn()
  }
})

document.querySelector(':root').style.setProperty('--short', '150ms')

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  })
})

const resizeObservers = []

class ResizeObserver {
  constructor(observer) {
    this.observedNodes = new Set()
    this.observer = observer
    resizeObservers.push(this)
  }
  disconnect() {
    this.observedNodes.clear()
    resizeObservers.splice(resizeObservers.indexOf(this), 1)
  }
  observe(node) {
    this.observedNodes.add(node)
  }
  unobserve(node) {
    this.observedNodes.delete(node)
  }
  notify() {
    this.observer([...this.observedNodes].map(target => ({ target })))
  }
}

window.ResizeObserver = ResizeObserver
window.resizeObservers = resizeObservers

Object.defineProperty(global.self, 'crypto', {
  value: Object.setPrototypeOf({ subtle: crypto.subtle }, crypto)
})
