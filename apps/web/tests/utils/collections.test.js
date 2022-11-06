import { describe, expect, it } from 'vitest'

import * as collections from '../../src/utils/collections'

describe('Collection utils', () => {
  describe('shuffle()', () => {
    it('can shuffle array, without altering original', async () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8]

      expect(collections.shuffle(array)).not.toEqual([1, 2, 3, 4, 5, 6, 7, 8])
      expect(array).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('can handle missing input', async () => {
      expect(collections.shuffle()).toEqual([])
      expect(collections.shuffle(null)).toEqual([])
      expect(collections.shuffle([])).toEqual([])
    })
  })
})
