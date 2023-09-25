// @ts-check
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { faker } from '@faker-js/faker'
import { CustomShapeManager } from '@src/3d/managers'
import { getDieModelFile } from '@src/3d/meshes'
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

  /** @type {Record<string, {meshes: any[] }>} */
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

  /** @type {import('vitest').Spy<logger['error']>} */
  let error
  const server = setupServer(
    rest.get(`${gameAssetsUrl}/:name`, ({ params }, res, ctx) => {
      const data =
        fixtures[/** @type {string} */ (params.name).replace('.babylon', '')]
      return res(data ? ctx.json(data) : ctx.status(404))
    })
  )

  const manager = new CustomShapeManager({ gameAssetsUrl })

  beforeAll(() => server.listen())

  beforeEach(() => {
    vi.clearAllMocks()
    server.resetHandlers()
    error = vi.spyOn(logger, 'error')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => server.close())

  describe('init()', () => {
    beforeEach(() => manager.clear())

    it('downloads all required mesh and die shapes', async () => {
      const file = `/${faker.lorem.word()}`
      server.use(
        rest.get(`${gameAssetsUrl}${file}`, (req, res, ctx) =>
          res(ctx.json(fixtures.pawn))
        )
      )
      server.use(
        rest.get(`${gameAssetsUrl}${getDieModelFile(4)}`, (req, res, ctx) =>
          res(ctx.json(fixtures.die))
        )
      )
      await manager.init({
        id: 'game',
        created: Date.now(),
        meshes: [
          { id: '', texture: '', shape: 'custom', file },
          { id: '', texture: '', shape: 'die', faces: 4 }
        ]
      })
      expect(manager.get(file)).toEqual(expectedData.pawn)
      expect(manager.get(getDieModelFile(4))).toEqual(expectedData.die)
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
        id: 'game',
        created: Date.now(),
        hands: [
          {
            playerId: '1',
            meshes: [
              { id: '', texture: '', shape: 'custom', file: file1 },
              { id: '', texture: '', shape: 'custom', file: file2 }
            ]
          },
          {
            playerId: '2',
            meshes: [{ id: '', texture: '', shape: 'custom', file: file3 }]
          }
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
        id: 'game',
        created: Date.now(),
        meshes: [
          { id: '', texture: '', shape: 'card', file: file1 },
          { id: '', texture: '', shape: 'custom', file: file2 }
        ],
        hands: undefined
      })
      expect(manager.get(file2)).toEqual(expectedData.pawn)
      expect(() => manager.get(file1)).toThrow()
    })

    it('throws on network errors', async () => {
      const file = `/${faker.lorem.word()}`
      await expect(
        manager.init({
          id: 'game',
          created: Date.now(),
          meshes: [{ id: '', texture: '', shape: 'custom', file: file }],
          hands: undefined
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
        id: 'game',
        created: Date.now(),
        meshes: [
          { id: '', texture: '', shape: 'custom', file: file },
          { id: '', texture: '', shape: 'custom', file: file }
        ],
        hands: undefined
      })
      expect(manager.get(file)).toEqual(expectedData.pawn)
      expect(request).toHaveBeenCalledTimes(1)
    })

    it('throws on custom mesh without file', async () => {
      const id = faker.string.uuid()
      await expect(
        manager.init({
          id: 'game',
          created: Date.now(),
          meshes: [{ id, texture: '', shape: 'custom' }],
          hands: undefined
        })
      ).rejects.toThrow(`Custom shaped mesh '${id}' is missing a file`)
    })

    it('throws on dice without face', async () => {
      const id = faker.string.uuid()
      await expect(
        manager.init({
          id: 'game',
          created: Date.now(),
          meshes: [{ id, texture: '', shape: 'die' }],
          hands: undefined
        })
      ).rejects.toThrow(`0 faces dice are not supported`)
    })
  })

  describe('given initialised', () => {
    const pawnPath = '/pawn.babylon'
    const avatarPath = '/avatar.babylon'
    const diePath = '/die.babylon'
    const knightPath = '/knight.obj'

    beforeEach(async () => {
      vi.clearAllMocks()
      server.resetHandlers()
      await manager.init({
        id: 'game',
        created: Date.now(),
        meshes: [
          { id: '', texture: '', shape: 'custom', file: pawnPath },
          { id: '', texture: '', shape: 'custom', file: avatarPath }
        ],
        hands: undefined
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
          id: 'game',
          created: Date.now(),
          meshes: [{ id: '', texture: '', shape: 'custom', file: diePath }],
          hands: undefined
        })
        expect(manager.get(pawnPath)).toEqual(expectedData.pawn)
        expect(manager.get(avatarPath)).toEqual(expectedData.avatar)
        expect(manager.get(diePath)).toEqual(expectedData.die)
      })

      it('handles binary files', async () => {
        const binaryContent = await readFile(
          resolve(__dirname, '../../../../games/chess/models/knight.obj'),
          { encoding: 'binary' }
        )
        server.use(
          rest.get(`${gameAssetsUrl}${knightPath}`, (req, res, ctx) =>
            res(ctx.body(binaryContent))
          )
        )
        await manager.init({
          id: 'game',
          created: Date.now(),
          meshes: [{ id: '', texture: '', shape: 'custom', file: knightPath }],
          hands: undefined
        })
        expect(manager.get(pawnPath)).toBeDefined()
      })
    })

    describe('get()', () => {
      it('returns the same data for cached file', () => {
        expect(manager.get(pawnPath)).toEqual(expectedData.pawn)
        expect(manager.get(avatarPath)).toEqual(expectedData.avatar)
        expect(manager.get(pawnPath)).toEqual(expectedData.pawn)
      })

      it('throws on unknown file', () => {
        const file = faker.image.url()
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
