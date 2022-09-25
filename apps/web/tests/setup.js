import matchers from '@testing-library/jest-dom/matchers'
import { expect, vi } from 'vitest'
import crypto from 'crypto'
import 'whatwg-fetch'
import '../src/common'
// Babylon.js side effect imports
import '@babylonjs/core/Materials/standardMaterial'

expect.extend(matchers)

vi.mock('$app/environment', () => ({ browser: true }))

vi.mock('$app/navigation', () => {
  return {
    goto: vi.fn()
  }
})

vi.mock('$app/stores', async () => {
  const { readable, writable } = await import('svelte/store')
  const getStores = () => ({
    navigating: readable(null),
    page: readable({ url: new URL('http://localhost'), params: {} }),
    session: writable(null),
    updated: readable(false)
  })
  const page = {
    subscribe(fn) {
      return getStores().page.subscribe(fn)
    }
  }
  const navigating = {
    subscribe(fn) {
      return getStores().navigating.subscribe(fn)
    }
  }
  const session = {
    subscribe(fn) {
      return getStores().session.subscribe(fn)
    }
  }
  const updated = {
    subscribe(fn) {
      return getStores().updated.subscribe(fn)
    }
  }
  return {
    getStores,
    navigating,
    page,
    session,
    updated
  }
})

if (typeof window !== 'undefined') {
  document.querySelector(':root').style.setProperty('--short', '150ms')

  // implements requestAnimationFrame ourselves, because the one in jsdom
  // breaks svelte transition firective
  window.requestAnimationFrame = callback =>
    setTimeout(() => callback(Date.now()), 10)

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
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
}
