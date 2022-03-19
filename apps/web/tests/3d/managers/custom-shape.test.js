import faker from 'faker'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import { customShapeManager as manager } from '../../../src/3d/managers'
import { makeLogger } from '../../../src/utils'

const logger = makeLogger('custom-shape')

const fixtures = {
  pawn: {
    meshes: [{ name: 'Pawn', id: 'Pawn', positions: [0.2858, -0.3324] }]
  },
  avatar: {
    meshes: [{ name: 'avatar', id: 'avatar', positions: [1, 1] }]
  },
  die: {
    meshes: [{ name: 'DIE', id: 'DIE', positions: [0, 1] }]
  }
}

const expectedData = Object.fromEntries(
  Object.keys(fixtures).map(key => [key, btoa(JSON.stringify(fixtures[key]))])
)

let error
const server = setupServer(
  rest.get('/:name', ({ params }, res, ctx) => {
    const data = fixtures[params.name.replace('.babylon', '')]
    return res(data ? ctx.json(data) : ctx.status(404))
  })
)

beforeAll(() => server.listen())

beforeEach(() => {
  jest.resetAllMocks()
  server.resetHandlers()
  error = jest.spyOn(logger, 'error')
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterAll(() => server.close())

describe('CustomShapeManager', () => {
  describe('init()', () => {
    beforeEach(() => manager.clear())

    it('downloads all required mesh shapes', async () => {
      const file = faker.internet.url()
      server.use(
        rest.get(file, (req, res, ctx) => res(ctx.json(fixtures.pawn)))
      )
      await manager.init({ meshes: [{ shape: 'custom', file }] })
      expect(manager.get(file)).toEqual(expectedData.pawn)
    })

    it('downloads shapes for hand meshes', async () => {
      const file1 = faker.internet.url()
      const file2 = faker.internet.url()
      const file3 = faker.internet.url()
      server.use(
        rest.get(file1, (req, res, ctx) => res(ctx.json(fixtures.pawn))),
        rest.get(file2, (req, res, ctx) => res(ctx.json(fixtures.avatar))),
        rest.get(file3, (req, res, ctx) => res(ctx.json(fixtures.die)))
      )
      await manager.init({
        hands: [
          {
            meshes: [
              { shape: 'custom', file: file1 },
              { shape: 'custom', file: file2 }
            ]
          },
          { meshes: [{ shape: 'custom', file: file3 }] }
        ]
      })
      expect(manager.get(file1)).toEqual(expectedData.pawn)
      expect(manager.get(file2)).toEqual(expectedData.avatar)
      expect(manager.get(file3)).toEqual(expectedData.die)
    })

    it('ignores non-custom meshes', async () => {
      const file1 = faker.internet.url()
      const file2 = faker.internet.url()
      server.use(
        rest.get(file2, (req, res, ctx) => res(ctx.json(fixtures.pawn)))
      )
      await manager.init({
        meshes: [
          { shape: 'card', file: file1 },
          { shape: 'custom', file: file2 }
        ]
      })
      expect(manager.get(file2)).toEqual(expectedData.pawn)
      expect(() => manager.get(file1)).toThrow()
    })

    it('throws on network errors', async () => {
      const file = faker.internet.url()
      await expect(
        manager.init({ meshes: [{ shape: 'custom', file: file }] })
      ).rejects.toThrow(`failed to download custom shape file ${file}`)
      expect(() => manager.get(file)).toThrow()
      expect(error).toHaveBeenCalled()
    })

    it('downloads the same file only once', async () => {
      const file = faker.internet.url()
      const request = jest.fn()

      server.use(
        rest.get(file, (req, res, ctx) => {
          request()
          return res(ctx.json(fixtures.pawn))
        })
      )
      await manager.init({
        meshes: [
          { shape: 'custom', file: file },
          { shape: 'custom', file: file }
        ]
      })
      expect(manager.get(file)).toEqual(expectedData.pawn)
      expect(request).toHaveBeenCalledTimes(1)
    })
  })

  describe('given initialised', () => {
    const pawnPath = '/pawn.babylon'
    const avatarPath = '/avatar.babylon'
    const diePath = '/die.babylon'

    beforeEach(async () => {
      jest.resetAllMocks()
      server.resetHandlers()
      await manager.init({
        meshes: [
          { shape: 'custom', file: pawnPath },
          { shape: 'custom', file: avatarPath }
        ]
      })
    })

    describe('init()', () => {
      it('appends to reviously cached files', async () => {
        server.use(
          rest.get(diePath, (req, res, ctx) => res(ctx.json(fixtures.die)))
        )
        await manager.init({ meshes: [{ shape: 'custom', file: diePath }] })
        expect(manager.get(pawnPath)).toEqual(expectedData.pawn)
        expect(manager.get(avatarPath)).toEqual(expectedData.avatar)
        expect(manager.get(diePath)).toEqual(expectedData.die)
      })
    })

    describe('get()', () => {
      it('returns the same data for cached file', () => {
        expect(manager.get(pawnPath)).toEqual(expectedData.pawn)
        expect(manager.get(avatarPath)).toEqual(expectedData.avatar)
        expect(manager.get(pawnPath)).toEqual(expectedData.pawn)
      })

      it('throws on unknown file', () => {
        const file = faker.image.abstract()
        expect(() => manager.get(file)).toThrow(
          `${file} must be cached with init()`
        )
        expect(error).toHaveBeenCalledTimes(1)
      })
    })

    describe('clear()', () => {
      it('clears cached file', () => {
        manager.clear()
        expect(() => manager.get(pawnPath)).toThrow()
      })
    })
  })
})
