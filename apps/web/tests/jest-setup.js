import '@testing-library/jest-dom'
import 'whatwg-fetch'
import '../src/common'
// Babylon.js side effect imports
import '@babylonjs/core/Materials/standardMaterial'

document.querySelector(':root').style.setProperty('--short', '150ms')
