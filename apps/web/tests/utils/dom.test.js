import { faker } from '@faker-js/faker'
import { setCssVariables } from '@src/utils'
import { describe, expect, it } from 'vitest'

describe('DOM utils', () => {
  describe('setCssVariables()', () => {
    it('sets new CSS variables on DOM node', () => {
      const node = document.createElement('div')
      const bg = faker.color.rgb()
      const fontName = faker.animal.cetacean()
      setCssVariables(node, { 'font-name': fontName, bg })
      expect(node.style.getPropertyValue('--font-name')).toEqual(fontName)
      expect(node.style.getPropertyValue('--bg')).toEqual(bg)
    })

    it('unsets existing CSS variables on DOM node', () => {
      const node = document.createElement('div')
      const bg = faker.color.rgb()
      node.style.setProperty('--bg', bg)

      setCssVariables(node, { bg: '' })
      expect(node.style.getPropertyValue('--bg')).toEqual('')
    })

    it('ignores null and undefined values', () => {
      const node = document.createElement('div')
      const base = faker.color.rgb()

      setCssVariables(node, { base, primary: null, secondary: undefined })
      expect(node.style.getPropertyValue('--base')).toEqual(base)
      expect(node.style.getPropertyValue('--primary')).toEqual('')
      expect(node.style.getPropertyValue('--secondary')).toEqual('')
    })

    it('returns existing CSS values', () => {
      const node = document.createElement('div')
      const color1 = faker.color.rgb()
      const color2 = faker.color.rgb()
      node.style.setProperty('--bg', color1)

      setCssVariables(node, { bg: color2 })
      expect(node.style.getPropertyValue('--bg')).toEqual(color2)
    })
  })
})
