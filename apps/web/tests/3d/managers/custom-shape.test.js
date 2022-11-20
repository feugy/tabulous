import { faker } from '@faker-js/faker'
import { customShapeManager as manager } from '@src/3d/managers'
import { makeLogger } from '@src/utils'
import { rest } from 'msw'
import { setupServer } from 'msw/node'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

describe('CustomShapeManager', () => {
  const logger = makeLogger('custom-shape')
  const gameAssetsUrl = 'https://localhost:3000'

  const fixtures = {
    pawn: {
      meshes: [{ name: 'custom', id: 'Pawn', positions: [0.2858, -0.3324] }]
    },
    avatar: {
      meshes: [{ name: 'custom', id: 'avatar', positions: [1, 1] }]
    },
    die: {
      meshes: [{ name: 'custom', id: 'DIE', positions: [0, 1] }]
    }
  }

  const expectedData = Object.fromEntries(
    Object.keys(fixtures).map(key => [key, btoa(JSON.stringify(fixtures[key]))])
  )

  let error
  const server = setupServer(
    rest.get(`${gameAssetsUrl}/:name`, ({ params }, res, ctx) => {
      const data = fixtures[params.name.replace('.babylon', '')]
      return res(data ? ctx.json(data) : ctx.status(404))
    })
  )

  beforeAll(() => server.listen())

  beforeEach(() => {
    vi.resetAllMocks()
    server.resetHandlers()
    error = vi.spyOn(logger, 'error')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => server.close())

  describe('init()', () => {
    beforeEach(() => manager.clear())

    it('downloads all required mesh shapes', async () => {
      const file = `/${faker.lorem.word()}`
      server.use(
        rest.get(`${gameAssetsUrl}${file}`, (req, res, ctx) =>
          res(ctx.json(fixtures.pawn))
        )
      )
      await manager.init({ gameAssetsUrl, meshes: [{ shape: 'custom', file }] })
      expect(manager.get(file)).toEqual(expectedData.pawn)
    })

    it('downloads shapes for hand meshes', async () => {
      const file1 = `/${faker.lorem.word()}`
      const file2 = `/${faker.lorem.word()}`
      const file3 = `/${faker.lorem.word()}`
      server.use(
        rest.get(`${gameAssetsUrl}${file1}`, (req, res, ctx) =>
          res(ctx.json(fixtures.pawn))
        ),
        rest.get(`${gameAssetsUrl}${file2}`, (req, res, ctx) =>
          res(ctx.json(fixtures.avatar))
        ),
        rest.get(`${gameAssetsUrl}${file3}`, (req, res, ctx) =>
          res(ctx.json(fixtures.die))
        )
      )
      await manager.init({
        gameAssetsUrl,
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
      const file1 = `/${faker.lorem.word()}`
      const file2 = `/${faker.lorem.word()}`
      server.use(
        rest.get(`${gameAssetsUrl}${file2}`, (req, res, ctx) =>
          res(ctx.json(fixtures.pawn))
        )
      )
      await manager.init({
        gameAssetsUrl,
        meshes: [
          { shape: 'card', file: file1 },
          { shape: 'custom', file: file2 }
        ]
      })
      expect(manager.get(file2)).toEqual(expectedData.pawn)
      expect(() => manager.get(file1)).toThrow()
    })

    it('throws on network errors', async () => {
      const file = `/${faker.lorem.word()}`
      await expect(
        manager.init({
          gameAssetsUrl,
          meshes: [{ shape: 'custom', file: file }]
        })
      ).rejects.toThrow(`failed to download custom shape file ${file}`)
      expect(() => manager.get(file)).toThrow()
      expect(error).toHaveBeenCalled()
    })

    it('downloads the same file only once', async () => {
      const file = `/${faker.lorem.word()}`
      const request = vi.fn()

      server.use(
        rest.get(`${gameAssetsUrl}${file}`, (req, res, ctx) => {
          request()
          return res(ctx.json(fixtures.pawn))
        })
      )
      await manager.init({
        gameAssetsUrl,
        meshes: [
          { shape: 'custom', file: file },
          { shape: 'custom', file: file }
        ]
      })
      expect(manager.get(file)).toEqual(expectedData.pawn)
      expect(request).toHaveBeenCalledTimes(1)
    })

    it('sets mesh names to custom', async () => {
      const file = `/${faker.lorem.word()}`
      server.use(
        rest.get(`${gameAssetsUrl}${file}`, (req, res, ctx) =>
          res(
            ctx.json({
              meshes: [
                { name: 'OVERRIDEN', id: 'Pawn', positions: [0.2858, -0.3324] }
              ]
            })
          )
        )
      )
      await manager.init({ gameAssetsUrl, meshes: [{ shape: 'custom', file }] })
      expect(manager.get(file)).toEqual(expectedData.pawn)
    })
  })

  describe('given initialised', () => {
    const pawnPath = '/pawn.babylon'
    const avatarPath = '/avatar.babylon'
    const diePath = '/die.babylon'

    beforeEach(async () => {
      vi.resetAllMocks()
      server.resetHandlers()
      await manager.init({
        gameAssetsUrl,
        meshes: [
          { shape: 'custom', file: pawnPath },
          { shape: 'custom', file: avatarPath }
        ]
      })
    })

    describe('init()', () => {
      it('appends to previously cached files', async () => {
        server.use(
          rest.get(`${gameAssetsUrl}${diePath}`, (req, res, ctx) =>
            res(ctx.json(fixtures.die))
          )
        )
        await manager.init({
          gameAssetsUrl,
          meshes: [{ shape: 'custom', file: diePath }]
        })
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
