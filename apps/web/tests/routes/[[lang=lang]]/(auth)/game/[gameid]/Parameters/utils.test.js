// @ts-check
import { findViolations } from '@src/routes/[[lang=lang]]/(auth)/game/[gameId]/Parameters/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('Parameters findViolations() utility', () => {
  it.each([
    // enum
    {
      title: 'valid numerical enum',
      value: -10,
      schema: { type: 'number', enum: [-9, -10, -11] },
      numViolations: 0
    },
    {
      title: 'invalid numerical enum',
      value: 4,
      schema: { type: 'number', enum: [-9, -10, -11] },
      numViolations: 1
    },
    {
      title: 'valid string enum',
      value: 'white',
      schema: { type: 'string', enum: ['white', 'black'] },
      numViolations: 0
    },
    {
      title: 'invalid string enum',
      value: 'red',
      schema: { type: 'string', enum: ['white', 'black'] },
      numViolations: 1
    },
    {
      title: 'valid object enum',
      value: { a: 5, b: { c: true } },
      schema: {
        type: 'object',
        enum: [
          { a: 5, b: { c: false } },
          { a: 5, b: { c: true } }
        ]
      },
      numViolations: 0
    },
    {
      title: 'invalid object enum',
      value: { a: 5, b: { c: true } },
      schema: { type: 'object', enum: [{ a: 5 }, { a: 10 }] },
      numViolations: 1
    },
    {
      title: 'valid array enum',
      value: [1, 2],
      schema: { type: 'array', enum: [[1], [2], [1, 2]] },
      numViolations: 0
    },
    {
      title: 'invalid array enum',
      value: [1, 2],
      schema: { type: 'array', enum: [[1], [2]] },
      numViolations: 1
    },
    {
      title: 'missing enum',
      schema: { type: 'string', enum: ['white', 'black'] },
      numViolations: 1
    },
    {
      title: 'valid enum with $data',
      value: 'black',
      schema: { type: 'string', enum: { $data: '/sides' } },
      context: { sides: ['white', 'black'] },
      numViolations: 0
    },
    {
      title: 'enum with missing $data',
      value: 'black',
      schema: { type: 'string', enum: { $data: '/sides' } },
      numViolations: 1
    },
    {
      title: 'enum with invalid $data',
      value: 'black',
      schema: { type: 'string', enum: { $data: '/sides' } },
      context: { sides: 'not an array' },
      numViolations: 1
    },
    // const
    {
      title: 'valid numerical const',
      value: 10.5,
      schema: { type: 'number', const: 10.5 },
      numViolations: 0
    },
    {
      title: 'invalid numerical const',
      value: -4,
      schema: { type: 'number', const: 3 },
      numViolations: 1
    },
    {
      title: 'valid string const',
      value: 'hi',
      schema: { type: 'string', const: 'hi' },
      numViolations: 0
    },
    {
      title: 'invalid string const',
      value: 'foo',
      schema: { type: 'string', const: 'bar' },
      numViolations: 1
    },
    {
      title: 'valid object const',
      value: { a: 5, b: { c: true } },
      schema: { type: 'object', const: { a: 5, b: { c: true } } },
      numViolations: 0
    },
    {
      title: 'invalid object const',
      value: { a: 5, b: { c: true } },
      schema: { type: 'object', const: { a: 5 } },
      numViolations: 1
    },
    {
      title: 'valid array const',
      value: [1, 2],
      schema: { type: 'array', const: [1, 2] },
      numViolations: 0
    },
    {
      title: 'invalid array const',
      value: [1, 2],
      schema: { type: 'array', const: [1] },
      numViolations: 1
    },
    {
      title: 'missing const',
      schema: { type: 'string', const: 'bar' },
      numViolations: 1
    },
    {
      title: 'valid const with $data',
      value: 'leto',
      schema: { type: 'string', const: { $data: '/character' } },
      context: { character: 'leto' },
      numViolations: 0
    },
    {
      title: 'invalid const with $data',
      value: 'paul',
      schema: { type: 'string', const: { $data: '/character' } },
      context: { character: 'leto' },
      numViolations: 1
    },
    {
      title: 'const with missing $data',
      value: 'jessica',
      schema: { type: 'string', const: { $data: '/character' } },
      numViolations: 1
    },
    {
      title: 'const with invalid $data',
      value: 'black',
      schema: { type: 'string', const: { $data: '/sides' } },
      context: { sides: { foo: 'bar' } },
      numViolations: 1
    },
    // maximum
    {
      title: 'valid maximum',
      value: -5,
      schema: { type: 'number', maximum: -3 },
      numViolations: 0
    },
    {
      title: 'valid maximum equality',
      value: 5,
      schema: { type: 'number', maximum: 5 },
      numViolations: 0
    },
    {
      title: 'invalid maximum',
      value: 7,
      schema: { type: 'number', maximum: 3 },
      numViolations: 1
    },
    {
      title: 'missing maximum',
      schema: { type: 'number', maximum: 3 },
      numViolations: 1
    },
    {
      title: 'valid maximum with $data',
      value: 3.9,
      schema: { type: 'number', maximum: { $data: '/selected' } },
      context: { selected: 4 },
      numViolations: 0
    },
    {
      title: 'invalid maximum with $data',
      value: 5,
      schema: { type: 'number', maximum: { $data: '/selected' } },
      context: { selected: 4 },
      numViolations: 1
    },
    {
      title: 'maximum with missing $data',
      value: 3,
      schema: { type: 'number', maximum: { $data: '/selected' } },
      numViolations: 1
    },
    {
      title: 'maximum with invalid $data',
      value: 0,
      schema: { type: 'number', maximum: { $data: '/selected' } },
      context: { selected: 'bar' },
      numViolations: 1
    },
    // exclusiveMaximum
    {
      title: 'valid exclusiveMaximum',
      value: -5,
      schema: { type: 'number', exclusiveMaximum: -3 },
      numViolations: 0
    },
    {
      title: 'valid exclusiveMaximum equality',
      value: 5,
      schema: { type: 'number', exclusiveMaximum: 5 },
      numViolations: 1
    },
    {
      title: 'invalid exclusiveMaximum',
      value: 7,
      schema: { type: 'number', exclusiveMaximum: 3 },
      numViolations: 1
    },
    {
      title: 'missing exclusiveMaximum',
      schema: { type: 'number', exclusiveMaximum: 3 },
      numViolations: 1
    },
    {
      title: 'valid exclusiveMaximum with $data',
      value: 3.9,
      schema: { type: 'number', exclusiveMaximum: { $data: '/selected' } },
      context: { selected: 4 },
      numViolations: 0
    },
    {
      title: 'invalid exclusiveMaximum with $data',
      value: 5,
      schema: { type: 'number', exclusiveMaximum: { $data: '/selected' } },
      context: { selected: 4 },
      numViolations: 1
    },
    {
      title: 'exclusiveMaximum with missing $data',
      value: 3,
      schema: { type: 'number', exclusiveMaximum: { $data: '/selected' } },
      numViolations: 1
    },
    {
      title: 'exclusiveMaximum with invalid $data',
      value: 0,
      schema: { type: 'number', exclusiveMaximum: { $data: '/selected' } },
      context: { selected: 'bar' },
      numViolations: 1
    },
    // minimum
    {
      title: 'valid minimum',
      value: -3,
      schema: { type: 'number', minimum: -5 },
      numViolations: 0
    },
    {
      title: 'valid minimum equality',
      value: 5,
      schema: { type: 'number', minimum: 5 },
      numViolations: 0
    },
    {
      title: 'invalid minimum',
      value: 3,
      schema: { type: 'number', minimum: 7 },
      numViolations: 1
    },
    {
      title: 'missing minimum',
      schema: { type: 'number', minimum: 3 },
      numViolations: 1
    },
    {
      title: 'valid minimum with $data',
      value: 3.9,
      schema: { type: 'number', minimum: { $data: '/selected' } },
      context: { selected: 3.5 },
      numViolations: 0
    },
    {
      title: 'invalid minimum with $data',
      value: 2,
      schema: { type: 'number', minimum: { $data: '/selected' } },
      context: { selected: 4 },
      numViolations: 1
    },
    {
      title: 'minimum with missing $data',
      value: 3,
      schema: { type: 'number', minimum: { $data: '/selected' } },
      numViolations: 1
    },
    {
      title: 'minimum with invalid $data',
      value: 0,
      schema: { type: 'number', minimum: { $data: '/selected' } },
      context: { selected: 'bar' },
      numViolations: 1
    },
    // exclusiveMinimum
    {
      title: 'valid exclusiveMinimum',
      value: -3,
      schema: { type: 'number', exclusiveMinimum: -5 },
      numViolations: 0
    },
    {
      title: 'exclusiveMinimum equality',
      value: 5,
      schema: { type: 'number', exclusiveMinimum: 5 },
      numViolations: 1
    },
    {
      title: 'invalid exclusiveMinimum',
      value: 3,
      schema: { type: 'number', exclusiveMinimum: 7 },
      numViolations: 1
    },
    {
      title: 'missing exclusiveMinimum',
      schema: { type: 'number', exclusiveMinimum: 3 },
      numViolations: 1
    },
    {
      title: 'valid exclusiveMinimum with $data',
      value: 3.9,
      schema: { type: 'number', exclusiveMinimum: { $data: '/selected' } },
      context: { selected: 3.5 },
      numViolations: 0
    },
    {
      title: 'invalid exclusiveMinimum with $data',
      value: 2,
      schema: { type: 'number', exclusiveMinimum: { $data: '/selected' } },
      context: { selected: 4 },
      numViolations: 1
    },
    {
      title: 'exclusiveMinimum with missing $data',
      value: 3,
      schema: { type: 'number', exclusiveMinimum: { $data: '/selected' } },
      numViolations: 1
    },
    {
      title: 'exclusiveMinimum with invalid $data',
      value: 0,
      schema: { type: 'number', exclusiveMinimum: { $data: '/selected' } },
      context: { selected: 'bar' },
      numViolations: 1
    },
    // multipleOf
    {
      title: 'valid multipleOf',
      value: 10,
      schema: { type: 'number', multipleOf: 5 },
      numViolations: 0
    },
    {
      title: 'multipleOf equality',
      value: 3,
      schema: { type: 'number', multipleOf: 3 },
      numViolations: 0
    },
    {
      title: 'negative multipleOf',
      value: -3,
      schema: { type: 'number', multipleOf: 3 },
      numViolations: 0
    },
    {
      title: 'invalid multipleOf',
      value: 4,
      schema: { type: 'number', multipleOf: 3 },
      numViolations: 1
    },
    {
      title: 'missing multipleOf',
      schema: { type: 'number', multipleOf: 3 },
      numViolations: 1
    },
    {
      title: 'valid multipleOf with $data',
      value: 30,
      schema: { type: 'number', multipleOf: { $data: '/selected' } },
      context: { selected: -2 },
      numViolations: 0
    },
    {
      title: 'invalid multipleOf with $data',
      value: 2,
      schema: { type: 'number', multipleOf: { $data: '/selected' } },
      context: { selected: 4 },
      numViolations: 1
    },
    {
      title: 'multipleOf with missing $data',
      value: 3,
      schema: { type: 'number', multipleOf: { $data: '/selected' } },
      numViolations: 1
    },
    {
      title: 'multipleOf with invalid $data',
      value: 0,
      schema: { type: 'number', multipleOf: { $data: '/selected' } },
      context: { selected: 'bar' },
      numViolations: 1
    },
    // maxLength
    {
      title: 'valid maxLength',
      value: '12',
      schema: { type: 'string', maxLength: 3 },
      numViolations: 0
    },
    {
      title: 'maxLength equality',
      value: '123',
      schema: { true: 'string', maxLength: 3 },
      numViolations: 0
    },
    {
      title: 'invalid maxLength',
      value: '12345',
      schema: { type: 'string', maxLength: 4 },
      numViolations: 1
    },
    {
      title: 'missing maxLength',
      schema: { type: 'string', maxLength: 3 },
      numViolations: 1
    },
    {
      title: 'valid maxLength with $data',
      value: 'leto',
      schema: { type: 'string', maxLength: { $data: '/length' } },
      context: { length: 10 },
      numViolations: 0
    },
    {
      title: 'invalid maxLength with $data',
      value: 'paul',
      schema: { type: 'string', maxLength: { $data: '/length' } },
      context: { length: 2 },
      numViolations: 1
    },
    {
      title: 'maxLength with missing $data',
      value: 'jessica',
      schema: { type: 'string', maxLength: { $data: '/length' } },
      numViolations: 1
    },
    {
      title: 'maxLength with invalid $data',
      value: 'black',
      schema: { type: 'string', maxLength: { $data: '/foo' } },
      context: { foo: 'bar' },
      numViolations: 1
    },
    // minLength
    {
      title: 'valid minLength',
      value: '1234',
      schema: { type: 'string', minLength: 3 },
      numViolations: 0
    },
    {
      title: 'minLength equality',
      value: '123',
      schema: { true: 'string', minLength: 3 },
      numViolations: 0
    },
    {
      title: 'invalid minLength',
      value: '123',
      schema: { type: 'string', minLength: 4 },
      numViolations: 1
    },
    {
      title: 'missing minLength',
      schema: { type: 'string', minLength: 3 },
      numViolations: 1
    },
    {
      title: 'valid minLength with $data',
      value: 'leto',
      schema: { type: 'string', minLength: { $data: '/length' } },
      context: { length: 2 },
      numViolations: 0
    },
    {
      title: 'invalid minLength with $data',
      value: 'paul',
      schema: { type: 'string', minLength: { $data: '/length' } },
      context: { length: 20 },
      numViolations: 1
    },
    {
      title: 'minLength with missing $data',
      value: 'jessica',
      schema: { type: 'string', minLength: { $data: '/length' } },
      numViolations: 1
    },
    {
      title: 'minLength with invalid $data',
      value: 'black',
      schema: { type: 'string', minLength: { $data: '/foo' } },
      context: { foo: 'bar' },
      numViolations: 1
    },
    // pattern
    {
      title: 'valid pattern',
      value: '1234',
      schema: { type: 'string', pattern: '\\d+' },
      numViolations: 0
    },
    {
      title: 'invalid pattern',
      value: '123',
      schema: { type: 'string', pattern: '^hey$' },
      numViolations: 1
    },
    {
      title: 'missing pattern',
      schema: { type: 'string', pattern: '\\d+' },
      numViolations: 1
    },
    {
      title: 'valid pattern with $data',
      value: 'leto',
      schema: { type: 'string', pattern: { $data: '/pattern' } },
      context: { pattern: 'paul|leto' },
      numViolations: 0
    },
    {
      title: 'invalid pattern with $data',
      value: 'jessica',
      schema: { type: 'string', pattern: { $data: '/pattern' } },
      context: { pattern: 'paul|leto' },
      numViolations: 1
    },
    {
      title: 'pattern with missing $data',
      value: 'jessica',
      schema: { type: 'string', pattern: { $data: '/pattern' } },
      numViolations: 1
    },
    {
      title: 'pattern with invalid $data',
      value: 'black',
      schema: { type: 'string', pattern: { $data: '/foo' } },
      context: { foo: 18 },
      numViolations: 1
    },
    // maxItems
    {
      title: 'valid maxItems',
      value: [1, 2, 3, 4, 5],
      schema: { type: 'array', maxItems: 10 },
      numViolations: 0
    },
    {
      title: 'maxItems equality',
      value: [1, 2, 3, 4, 5],
      schema: { type: 'array', maxItems: 5 },
      numViolations: 0
    },
    {
      title: 'invalid maxItems',
      value: [1, 2, 3],
      schema: { type: 'array', maxItems: 2 },
      numViolations: 1
    },
    {
      title: 'missing maxItems',
      schema: { type: 'array', maxItems: 5 },
      numViolations: 1
    },
    {
      title: 'valid maxItems with $data',
      value: [1, 2, 3, 4, 5],
      schema: { type: 'array', maxItems: { $data: '/max' } },
      context: { max: 7 },
      numViolations: 0
    },
    {
      title: 'invalid maxItems with $data',
      value: [1, 2],
      schema: { type: 'array', maxItems: { $data: '/max' } },
      context: { max: 1 },
      numViolations: 1
    },
    {
      title: 'maxItems with missing $data',
      value: [1, 2, 3, 4, 5],
      schema: { type: 'array', maxItems: { $data: '/max' } },
      numViolations: 1
    },
    {
      title: 'maxItems with invalid $data',
      value: [1, 2],
      schema: { type: 'array', maxItems: { $data: '/foo' } },
      context: { foo: 'bar' },
      numViolations: 1
    },
    // minItems
    {
      title: 'valid minItems',
      value: [1, 2, 3, 4, 5],
      schema: { type: 'array', minItems: 3 },
      numViolations: 0
    },
    {
      title: 'minItems equality',
      value: [1, 2, 3, 4, 5],
      schema: { type: 'array', minItems: 5 },
      numViolations: 0
    },
    {
      title: 'invalid minItems',
      value: [1, 2, 3],
      schema: { type: 'array', minItems: 5 },
      numViolations: 1
    },
    {
      title: 'missing minItems',
      schema: { type: 'array', minItems: 5 },
      numViolations: 1
    },
    {
      title: 'valid minItems with $data',
      value: [1, 2, 3, 4, 5],
      schema: { type: 'array', minItems: { $data: '/min' } },
      context: { min: 2 },
      numViolations: 0
    },
    {
      title: 'invalid minItems with $data',
      value: [1, 2],
      schema: { type: 'array', minItems: { $data: '/min' } },
      context: { min: 5 },
      numViolations: 1
    },
    {
      title: 'minItems with missing $data',
      value: [1, 2, 3, 4, 5],
      schema: { type: 'array', minItems: { $data: '/min' } },
      numViolations: 1
    },
    {
      title: 'minItems with invalid $data',
      value: [1, 2],
      schema: { type: 'array', minItems: { $data: '/foo' } },
      context: { foo: 'bar' },
      numViolations: 1
    },
    // uniqueItems
    {
      title: 'valid uniqueItems',
      value: [1, 2, 3, 4, 5],
      schema: { type: 'array', uniqueItems: true },
      numViolations: 0
    },
    {
      title: 'false uniqueItems',
      value: [1, 2, 2, 3, 3],
      schema: { type: 'array', uniqueItems: false },
      numViolations: 0
    },
    {
      title: 'invalid uniqueItems',
      value: [1, 2, 2, 3, 3],
      schema: { type: 'array', uniqueItems: true },
      numViolations: 1
    },
    {
      title: 'missing uniqueItems',
      schema: { type: 'array', uniqueItems: true },
      numViolations: 1
    },
    {
      title: 'valid uniqueItems with $data',
      value: ['a', 'b', 'c', 'd'],
      schema: { type: 'array', uniqueItems: { $data: '/unique' } },
      context: { unique: true },
      numViolations: 0
    },
    {
      title: 'invalid uniqueItems with $data',
      value: ['a', 'b', 'a', 'd'],
      schema: { type: 'array', uniqueItems: { $data: '/unique' } },
      context: { unique: true },
      numViolations: 1
    },
    {
      title: 'uniqueItems with missing $data',
      value: ['a', 'b', 'c', 'd'],
      schema: { type: 'array', uniqueItems: { $data: '/min' } },
      numViolations: 1
    },
    {
      title: 'uniqueItems with invalid $data',
      value: ['a', 'b', 'c', 'd'],
      schema: { type: 'array', uniqueItems: { $data: '/foo' } },
      context: { foo: 'bar' },
      numViolations: 1
    },
    // maxProperties
    {
      title: 'valid maxProperties',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', maxProperties: 10 },
      numViolations: 0
    },
    {
      title: 'maxProperties equality',
      value: { a: 1, b: 2, c: 3, d: 4 },
      schema: { type: 'object', maxProperties: 4 },
      numViolations: 0
    },
    {
      title: 'invalid maxProperties',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', maxProperties: 2 },
      numViolations: 1
    },
    {
      title: 'missing maxProperties',
      schema: { type: 'object', maxProperties: 5 },
      numViolations: 1
    },
    {
      title: 'valid maxProperties with $data',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', maxProperties: { $data: '/max' } },
      context: { max: 7 },
      numViolations: 0
    },
    {
      title: 'invalid maxProperties with $data',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', maxProperties: { $data: '/max' } },
      context: { max: 0 },
      numViolations: 1
    },
    {
      title: 'maxProperties with missing $data',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', maxProperties: { $data: '/max' } },
      numViolations: 1
    },
    {
      title: 'maxProperties with invalid $data',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', maxProperties: { $data: '/foo' } },
      context: { foo: 'bar' },
      numViolations: 1
    },
    // minProperties
    {
      title: 'valid minProperties',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', minProperties: 2 },
      numViolations: 0
    },
    {
      title: 'minProperties equality',
      value: { a: 1, b: 2, c: 3, d: 4 },
      schema: { type: 'object', minProperties: 4 },
      numViolations: 0
    },
    {
      title: 'invalid minProperties',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', minProperties: 5 },
      numViolations: 1
    },
    {
      title: 'missing minProperties',
      schema: { type: 'object', minProperties: 5 },
      numViolations: 1
    },
    {
      title: 'valid minProperties with $data',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', minProperties: { $data: '#/min' } },
      context: { min: 2 },
      numViolations: 0
    },
    {
      title: 'invalid minProperties with $data',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', minProperties: { $data: '/min' } },
      context: { min: 5 },
      numViolations: 1
    },
    {
      title: 'minProperties with missing $data',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', minProperties: { $data: '/min' } },
      numViolations: 1
    },
    {
      title: 'minProperties with invalid $data',
      value: { a: 1, b: 2, c: 3 },
      schema: { type: 'object', minProperties: { $data: '/foo' } },
      context: { foo: 'bar' },
      numViolations: 1
    },
    // required
    {
      title: 'valid required',
      value: { a: 1, b: 2, c: 3, d: 4 },
      schema: { type: 'object', required: ['c', 'd', 'a'] },
      numViolations: 0
    },
    {
      title: 'invalid required',
      value: { a: 1, b: 2 },
      schema: { type: 'object', required: ['a', 'd'] },
      numViolations: 1
    },
    {
      title: 'missing required',
      schema: { type: 'object', required: ['a'] },
      numViolations: 1
    },
    {
      title: 'valid required with $data',
      value: { a: 1, b: 2, c: 3, d: 4 },
      schema: { type: 'object', required: { $data: '#/required' } },
      context: { required: ['a'] },
      numViolations: 0
    },
    {
      title: 'invalid required with $data',
      value: { a: 1, b: 2, c: 3, d: 4 },
      schema: { type: 'object', required: { $data: '/required' } },
      context: { required: ['g', 'h'] },
      numViolations: 1
    },
    {
      title: 'required with missing $data',
      value: { a: 1, b: 2, c: 3, d: 4 },
      schema: { type: 'object', required: { $data: '/required' } },
      numViolations: 1
    },
    {
      title: 'required with invalid $data',
      value: { a: 1, b: 2, c: 3, d: 4 },
      schema: { type: 'object', required: { $data: '/foo' } },
      context: { foo: 'bar' },
      numViolations: 1
    },
    // properties
    {
      title: 'valid properties',
      value: { a: 1, b: 2, c: 3, d: 4 },
      schema: {
        type: 'object',
        properties: { a: { const: 1 }, b: { maximum: 10 } }
      },
      numViolations: 0
    },
    {
      title: 'invalid properties',
      value: { a: 1, b: 2 },
      schema: {
        type: 'object',
        properties: { a: { const: 1 }, b: { minimum: 3 } }
      },
      numViolations: 1
    },
    {
      title: 'missing properties',
      schema: {
        type: 'object',
        properties: { a: { const: 1 }, b: { maximum: -3 } }
      },
      numViolations: 1
    },
    {
      title: 'invalid properties type',
      value: 'foobar',
      schema: {
        type: 'object',
        properties: { a: { const: 1 }, b: { maximum: -3 } }
      },
      numViolations: 1
    },
    // not
    {
      title: 'valid not',
      value: 5,
      schema: { type: 'number', not: { const: 1 } },
      numViolations: 0
    },
    {
      title: 'invalid not',
      value: 'paul',
      schema: { type: 'string', not: { const: 'paul' } },
      numViolations: 1
    },
    {
      title: 'missing not',
      schema: { type: 'string', not: { const: 'paul' } },
      numViolations: 0
    },
    // oneOf
    {
      title: 'valid oneOf',
      value: 5,
      schema: { type: 'number', oneOf: [{ enum: [1, 3, 5] }, { const: 7 }] },
      numViolations: 0
    },
    {
      title: 'multiple oneOf',
      value: 5,
      schema: { type: 'number', oneOf: [{ enum: [1, 3, 5] }, { const: 5 }] },
      numViolations: 1
    },
    {
      title: 'not any oneOf',
      value: 5,
      schema: { type: 'number', oneOf: [{ maximum: 3 }, { minimum: 10 }] },
      numViolations: 1
    },
    {
      title: 'missing oneOf',
      schema: { type: 'number', oneOf: [{ enum: [1, 3, 5] }, { const: 7 }] },
      numViolations: 1
    },
    // anyOf
    {
      title: 'valid anyOf',
      value: 5,
      schema: { type: 'number', anyOf: [{ enum: [1, 3, 5] }, { const: 7 }] },
      numViolations: 0
    },
    {
      title: 'multiple anyOf',
      value: 5,
      schema: { type: 'number', anyOf: [{ enum: [1, 3, 5] }, { const: 5 }] },
      numViolations: 0
    },
    {
      title: 'invalid anyOf',
      value: 5,
      schema: { type: 'number', anyOf: [{ maximum: 3 }, { minimum: 10 }] },
      numViolations: 1
    },
    {
      title: 'missing anyOf',
      schema: { type: 'number', anyOf: [{ enum: [1, 3, 5] }, { const: 7 }] },
      numViolations: 1
    },
    // allOf
    {
      title: 'valid allOf',
      value: 5,
      schema: { type: 'number', allOf: [{ enum: [1, 3, 5] }, { const: 5 }] },
      numViolations: 0
    },
    {
      title: 'invalid anyOf',
      value: 5,
      schema: { type: 'number', allOf: [{ enum: [1, 3, 5] }, { const: 7 }] },
      numViolations: 1
    },
    {
      title: 'missing anyOf',
      schema: { type: 'number', allOf: [{ enum: [1, 3, 5] }, { const: 7 }] },
      numViolations: 1
    },
    // if then
    {
      title: 'valid if then',
      value: { a: 5, b: 'paul' },
      schema: {
        type: 'object',
        if: { properties: { a: { const: 5 } } },
        then: { properties: { b: { enum: ['paul', 'leto', 'jessica'] } } }
      },
      numViolations: 0
    },
    {
      title: 'invalid if',
      value: { a: 3, b: 'glossu' },
      schema: {
        type: 'object',
        if: { properties: { a: { const: 5 } } },
        then: { properties: { b: { enum: ['paul', 'leto', 'jessica'] } } }
      },
      numViolations: 0
    },
    {
      title: 'invalid then',
      value: { a: 5, b: 'glossu' },
      schema: {
        type: 'object',
        if: { properties: { a: { const: 5 } } },
        then: { properties: { b: { enum: ['paul', 'leto', 'jessica'] } } }
      },
      numViolations: 1
    },
    // if else
    {
      title: 'valid if else',
      value: { a: 5, b: 'paul' },
      schema: {
        type: 'object',
        if: { properties: { a: { const: 4 } } },
        else: { properties: { b: { enum: ['paul', 'leto', 'jessica'] } } }
      },
      numViolations: 0
    },
    {
      title: 'invalid if',
      value: { a: 3, b: 'glossu' },
      schema: {
        type: 'object',
        if: { properties: { a: { const: 3 } } },
        else: { properties: { b: { enum: ['paul', 'leto', 'jessica'] } } }
      },
      numViolations: 0
    },
    {
      title: 'invalid else',
      value: { a: 3, b: 'glossu' },
      schema: {
        type: 'object',
        if: { properties: { a: { const: 5 } } },
        else: { properties: { b: { enum: ['paul', 'leto', 'jessica'] } } }
      },
      numViolations: 1
    },
    // multiple validations
    {
      title: 'valid maximum and minimum',
      value: 5,
      schema: { type: 'number', minimum: 4, maximum: 6 },
      numViolations: 0
    },
    {
      title: 'invalid maximum and minimum',
      value: 3,
      schema: { type: 'number', minimum: 4, maximum: 6 },
      numViolations: 1
    }
  ])('matches $title', ({ value, schema, context, numViolations }) => {
    expect(findViolations(value, schema, context)).toHaveLength(numViolations)
  })

  it('resolves absolute $data from nested object', () => {
    const value = { a: { b: 5 } }
    const schema = {
      type: 'object',
      properties: {
        a: {
          type: 'object',
          properties: { b: { type: 'number', const: { $data: '/c/d/e' } } }
        }
      }
    }
    const context = { c: { d: { e: 5 } } }
    expect(findViolations(value, schema, context)).toHaveLength(0)
  })

  describe('given enrichProps()', () => {
    const enrichProps = vi.fn()
    const schema = {
      type: 'object',
      properties: {
        count: { type: 'number', enum: [1, 2] },
        seats: { type: 'string' }
      },
      if: { properties: { count: { const: 2 } } }
    }
    const then = {
      required: ['opponent1'],
      properties: { opponent1: { pattern: 'paul|leto|jessica' } }
    }
    const elseClause = {
      required: ['color'],
      properties: { color: { enum: ['green', 'blue'] } }
    }

    beforeEach(() => {
      vi.resetAllMocks()
    })

    it('invokes enrichProps on valid then', () => {
      expect(
        findViolations(
          { count: 2, opponent1: 'leto' },
          { ...schema, then, else: elseClause },
          undefined,
          enrichProps
        )
      ).toHaveLength(0)
      expect(enrichProps).toHaveBeenCalledWith(then)
      expect(enrichProps).toHaveBeenCalledTimes(1)
    })

    it('invokes enrichProps on invalid then', () => {
      expect(
        findViolations(
          { count: 2, opponent1: 'feyd' },
          { ...schema, then, else: elseClause },
          undefined,
          enrichProps
        )
      ).toHaveLength(1)
      expect(enrichProps).toHaveBeenCalledWith(then)
      expect(enrichProps).toHaveBeenCalledTimes(1)
    })

    it('invokes enrichProps on valid slse', () => {
      expect(
        findViolations(
          { count: 1, color: 'blue' },
          { ...schema, then, else: elseClause },
          undefined,
          enrichProps
        )
      ).toHaveLength(0)
      expect(enrichProps).toHaveBeenCalledWith(elseClause)
      expect(enrichProps).toHaveBeenCalledTimes(1)
    })

    it('invokes enrichProps on invalid else', () => {
      expect(
        findViolations(
          { count: 1, opponent1: 'paul' },
          { ...schema, then, else: elseClause },
          undefined,
          enrichProps
        )
      ).toHaveLength(1)
      expect(enrichProps).toHaveBeenCalledWith(elseClause)
      expect(enrichProps).toHaveBeenCalledTimes(1)
    })

    it('does no invoke enrichProps on missing then', () => {
      expect(
        findViolations(
          { count: 2, opponent1: 'paul' },
          { ...schema, else: elseClause },
          undefined,
          enrichProps
        )
      ).toHaveLength(0)
      expect(enrichProps).not.toHaveBeenCalled()
    })

    it('does no invoke enrichProps on missing else', () => {
      expect(
        findViolations(
          { count: 1, opponent1: 'paul' },
          { ...schema, then },
          undefined,
          enrichProps
        )
      ).toHaveLength(0)
      expect(enrichProps).not.toHaveBeenCalled()
    })

    it('invokes enrichProps multiple times', () => {
      const nestedThen = {
        ...then,
        if: { properties: { opponent1: { const: 'paul' } } },
        then: elseClause
      }
      expect(
        findViolations(
          { count: 2, opponent1: 'paul', color: 'green' },
          { ...schema, then: nestedThen },
          undefined,
          enrichProps
        )
      ).toHaveLength(0)
      expect(enrichProps).toHaveBeenNthCalledWith(1, nestedThen)
      expect(enrichProps).toHaveBeenNthCalledWith(2, elseClause)
      expect(enrichProps).toHaveBeenCalledTimes(2)
    })

    it('invokes enrichProps for then on failing other condition', () => {
      expect(
        findViolations(
          { count: 2, opponent1: 'leto' },
          { ...schema, then, required: ['seats'] },
          undefined,
          enrichProps
        )
      ).toHaveLength(1)
      expect(enrichProps).toHaveBeenCalledWith(then)
      expect(enrichProps).toHaveBeenCalledTimes(1)
    })

    it('invokes enrichProps for else on failing other condition', () => {
      expect(
        findViolations(
          { count: 1, color: 'red' },
          { ...schema, else: elseClause, required: ['seats'] },
          undefined,
          enrichProps
        )
      ).toHaveLength(2)
      expect(enrichProps).toHaveBeenCalledWith(elseClause)
      expect(enrichProps).toHaveBeenCalledTimes(1)
    })
  })
})
