import '@testing-library/jest-dom'
import 'whatwg-fetch'
import '../src/common'
// Babylon.js side effect imports
import '@babylonjs/core/Materials/standardMaterial'

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
