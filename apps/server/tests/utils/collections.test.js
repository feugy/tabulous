import { shuffle } from '../../src/utils/index.js'

describe('shuffle()', () => {
  it('randomizes elements of an array, leaving source array unmodified', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    const result = shuffle(source)
    expect(result).toHaveLength(source.length)
    expect(result).toEqual(expect.arrayContaining(source))
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    expect(source).not.toEqual(result)
  })

  it('returns array copy when specifying 0 iterations', () => {
    const source = [1, 2, 3, 4, 5]
    const result = shuffle(source, 0)
    expect(result).toHaveLength(source.length)
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('handles missing input', () => {
    expect(shuffle()).toEqual([])
    expect(shuffle(null)).toEqual([])
    expect(shuffle([])).toEqual([])
  })
})
