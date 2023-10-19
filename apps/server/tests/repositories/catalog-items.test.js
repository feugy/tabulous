// @ts-check
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { faker } from '@faker-js/faker'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { catalogItems } from '../../src/repositories/catalog-items.js'

describe('Catalog Items repository', () => {
  const items = [
    {
      name: '6-takes',
      build: expect.any(Function),
      copyright: {
        authors: [{ name: 'Wolfgang Kramer' }]
      }
    },
    {
      name: 'belote',
      build: expect.any(Function),
      addPlayer: expect.any(Function),
      zoomSpec: { min: 5, max: 50 },
      colors: { players: ['red', 'green', 'blue'] }
    },
    {
      name: 'draughts',
      build: expect.any(Function),
      addPlayer: expect.any(Function),
      askForParameters: expect.any(Function)
    },
    { name: 'klondike', build: expect.any(Function) },
    {
      name: 'splendor',
      rulesBookPageCount: 4,
      maxSeats: 4,
      build: expect.any(Function),
      copyright: {
        authors: [{ name: 'Marc André' }]
      }
    }
  ]

  const fixtures = join('tests', 'fixtures', 'games')
  const unbuildable = join('tests', 'fixtures', 'unbuildable-games')

  async function rmEngines(/** @type {string} */ folder) {
    for (const file of await readdir(folder)) {
      await rm(join(folder, file, 'engine.min.js'), { force: true })
    }
  }

  afterEach(async () => {
    // delete engine.min.js files inside fictures folder
    await rmEngines(fixtures)
    await rmEngines(unbuildable)
    await catalogItems.release()
  })

  describe('connect()', () => {
    it('throws an error on unreadable folder', async () => {
      await expect(
        catalogItems.connect({ path: faker.system.filePath() })
      ).rejects.toThrow('Failed to connect Catalog Items repository')
    })

    // Since recently (https://github.com/vitest-dev/vitest/commit/58ee8e9b6300fd6899072e34feb766805be1593c),
    // it can not be tested under vitest because an uncatchable rejection will be thrown
    it('throws an invalid game descriptor', async () => {
      await expect(
        catalogItems.connect({
          path: join('tests', 'fixtures', 'broken-games')
        })
      ).rejects.toThrow(`Failed to load game broken`)
    })

    it('handles an folder without game descriptors', async () => {
      await catalogItems.connect({ path: join('tests', 'graphql') })
      expect(await catalogItems.list()).toEqual({
        total: 0,
        from: 0,
        size: Number.POSITIVE_INFINITY,
        results: []
      })
    })

    it('builds rule engines', async () => {
      await catalogItems.connect({ path: fixtures })
      const engines = []
      for (const file of await readdir(fixtures)) {
        if (
          await stat(join(fixtures, file, 'engine.min.js'))
            .then(() => true)
            .catch(() => false)
        ) {
          engines.push(file)
        }
      }
      expect(engines).toEqual([
        '6-takes',
        'belote',
        'draughts',
        'klondike',
        'splendor'
      ])
    })

    it('throws on un-buildable rule engines', async () => {
      await expect(catalogItems.connect({ path: unbuildable })).rejects.toThrow(
        `Failed to load game import: Build failed with 1 error:
tests/fixtures/unbuildable-games/import/index.js:2:9: ERROR: Could not resolve "does-not-exist"`
      )
    })
  })

  describe('given a connected repository on mocked data', () => {
    beforeEach(() => catalogItems.connect({ path: fixtures }))

    describe('Catalog repository', () => {
      describe('list()', () => {
        it('lists all items within folder', async () => {
          expect(await catalogItems.list()).toEqual({
            total: items.length,
            from: 0,
            size: Number.POSITIVE_INFINITY,
            results: items
          })
        })
      })

      describe('reload()', () => {
        const kind = 'new-game'

        beforeEach(async () => {
          await mkdir(join(fixtures, kind), { recursive: true })
          await writeFile(
            join(fixtures, kind, 'index.js'),
            `export function build() {
              return { meshes: [] }
            }
            export const rulesBookPageCount = 4`
          )
        })

        afterEach(() =>
          rm(join(fixtures, kind), { force: true, recursive: true })
        )

        it('loads new game', async () => {
          await catalogItems.reload(kind)
          expect(await catalogItems.getById(kind)).toEqual({
            name: kind,
            build: expect.any(Function),
            rulesBookPageCount: 4
          })
          expect(await catalogItems.list()).toEqual(
            expect.objectContaining({
              total: 6
            })
          )
        })

        it('can change a game metadata', async () => {
          await catalogItems.reload(kind)
          await writeFile(
            join(fixtures, kind, 'index.js'),
            `export function build() {
              return { meshes: [] }
            }
            export const maxSeats = 4
            export const rulesBookPageCount = 6`
          )
          await catalogItems.reload(kind)
          expect(await catalogItems.getById(kind)).toEqual({
            name: kind,
            build: expect.any(Function),
            maxSeats: 4,
            rulesBookPageCount: 6
          })
          expect(await catalogItems.list()).toEqual(
            expect.objectContaining({
              total: 6
            })
          )
        })

        it('rebuilds script', async () => {
          await catalogItems.reload(kind)
          const script = await catalogItems.getEngineScript(kind)
          await writeFile(
            join(fixtures, kind, 'index.js'),
            `export function build() {
              return { meshes: [] }
            }
            export function addPlayer() {}
            export const rulesBookPageCount = 4`
          )

          await catalogItems.reload(kind)
          expect(await catalogItems.getEngineScript(kind)).not.toEqual(script)
        })

        it('reports invalid descriptor', async () => {
          await writeFile(
            join(fixtures, kind, 'index.js'),
            `export function build() {
              return { meshes: [] }
            export const rulesBookPageCount = 4`
          )

          await expect(catalogItems.reload(kind)).rejects.toThrow(
            `Failed to load game ${kind}: Failed to parse source for import analysis because the content contains invalid JS syntax. If you are using JSX, make sure to name the file with the .jsx or .tsx extension.`
          )
        })
      })

      describe('getById()', () => {
        it('returns a model by id', async () => {
          const model = faker.helpers.arrayElement(items)
          expect(await catalogItems.getById(model.name)).toEqual(model)
        })

        it('returns null on unknown id', async () => {
          expect(await catalogItems.getById(faker.string.uuid())).toBeNull()
        })

        it('returns several models by ids', async () => {
          expect(
            await catalogItems.getById(items.map(({ name }) => name).reverse())
          ).toEqual([...items].reverse())
        })

        it('returns null on unknown ids', async () => {
          expect(
            await catalogItems.getById([
              faker.string.uuid(),
              items[2].name,
              faker.string.uuid(),
              items[1].name
            ])
          ).toEqual([null, items[2], null, items[1]])
        })
      })

      describe('getEngineScript()', () => {
        it('returns a script content by id', async () => {
          expect(
            (await catalogItems.getEngineScript('klondike'))?.split('\n')[0]
          ).toEqual(
            `"use strict";var engine=(()=>{var o=Object.defineProperty;var d=Object.getOwnPropertyDescriptor;var r=Object.getOwnPropertyNames;var i=Object.prototype.hasOwnProperty;var u=(t,e)=>{for(var n in e)o(t,n,{get:e[n],enumerable:!0})},p=(t,e,n,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of r(e))!i.call(t,s)&&s!==n&&o(t,s,{get:()=>e[s],enumerable:!(a=d(e,s))||a.enumerable});return t};var x=t=>p(o({},"__esModule",{value:!0}),t);var c={};u(c,{build:()=>b});function b(){return{meshes:[{shape:"card",id:"one-of-diamonds",texture:"test.ktx2"}],bags:new Map,slots:[]}}return x(c);})();`
          )
        })

        it('returns undefined on unknown id', async () => {
          expect(
            await catalogItems.getEngineScript(faker.string.uuid())
          ).toBeUndefined()
        })

        it('returns undefined on missing id', async () => {
          expect(await catalogItems.getEngineScript(undefined)).toBeUndefined()
        })
      })

      describe('save()', () => {
        it('throws error as it is not supported', async () => {
          await expect(catalogItems.save()).rejects.toThrow(
            'Catalog items can not be saved'
          )
        })
      })

      describe('deleteById()', () => {
        it('throws error as it is not supported', async () => {
          await expect(catalogItems.deleteById()).rejects.toThrow(
            'Catalog items can not be deleted'
          )
        })
      })
    })
  })
})
