import '@testing-library/jest-dom'
import 'whatwg-fetch'
import '../src/common'
// Babylon.js side effect imports
import '@babylonjs/core/Materials/standardMaterial'

document.querySelector(':root').style.setProperty('--short', '150ms')

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }))
})
