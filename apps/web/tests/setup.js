// Babylon.js side effect imports
import '@babylonjs/core/Materials/standardMaterial'
import 'whatwg-fetch'

import util from 'node:util'

import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import matchers from '@testing-library/jest-dom/matchers'
import crypto from 'crypto'
import { expect, vi } from 'vitest'

expect.extend(matchers)

vi.mock('$app/environment', () => ({ browser: true }))

vi.mock('$app/navigation', () => {
  return {
    goto: vi.fn(),
    invalidateAll: vi.fn(),
    beforeNavigate: vi.fn()
  }
})

vi.mock('$app/stores', async () => {
  const { readable, writable } = await import('svelte/store')
  const stores = {
    navigating: readable(null),
    page: writable({ url: new URL('http://localhost'), params: {} }),
    session: writable(null),
    updated: readable(false)
  }
  return {
    getStores: () => stores,
    ...stores
  }
})

AbstractMesh.prototype[util.inspect.custom] = function () {
  const result = {
    absolutePosition: this.absolutePosition,
    absoluteRotationQuaternion: this.absoluteRotationQuaternion,
    absoluteScaling: this.absoluteScaling,
    behaviors: this.behaviors,
    parent: this.parent,
    position: this.position,
    rotation: this.rotation,
    rotationQuaternion: this.rotationQuaternion,
    renderingGroupId: this.renderingGroupId,
    visibility: this.visibility
  }
  for (const prop in this) {
    if (!/^_|^on[A-Z]/.test(prop)) {
      result[prop] = this[prop]
    }
  }
  return result
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window.navigator, 'languages', {
    value: ['fr'],
    configurable: true
  })

  document.querySelector(':root').style.setProperty('--short', '150ms')

  // implements requestAnimationFrame ourselves, because the one in jsdom
  // breaks svelte transition firective
  window.requestAnimationFrame = callback =>
    setTimeout(() => callback(Date.now()), 10)

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
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

  const intersectionObservers = []

  class IntersectionObserver {
    constructor(observer) {
      this.observedNodes = new Set()
      this.observer = observer
      intersectionObservers.push(this)
    }
    disconnect() {
      this.observedNodes.clear()
      intersectionObservers.splice(resizeObservers.indexOf(this), 1)
    }
    observe(node) {
      this.observedNodes.add(node)
    }
    unobserve(node) {
      this.observedNodes.delete(node)
    }
    notify(entries) {
      this.observer([...this.observedNodes].map(() => entries))
    }
  }

  window.IntersectionObserver = IntersectionObserver
  window.intersectionObservers = intersectionObservers

  Object.defineProperty(global.self, 'crypto', {
    configurable: true,
    value: Object.setPrototypeOf({ subtle: crypto.subtle }, crypto)
  })

  window.Notification = class Notification {
    static requestPermission() {}

    static permission = 'default'

    constructor(title, options) {
      this.title = title
      this.options = options
    }
  }
}

// common initialization, once locale is set
await import('../src/common')
