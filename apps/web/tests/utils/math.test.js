import {
  buildEnclosedCircle,
  buildGroundRectangle,
  intersectCircles,
  intersectRectangles,
  intersectRectangleWithCircle,
  projectToGround
} from '@src/utils'
import { describe, expect, it } from 'vitest'

describe('mathematical utilities', () => {
  describe('projectToGround()', () => {
    it('returns origin on missing point', () => {
      expect(projectToGround()).toEqual({ x: 0, y: 0 })
    })

    it('projects points to the ground', () => {
      expect(projectToGround({ x: 10, y: 11, z: 12 })).toEqual({
        x: 10,
        y: 12
      })
      expect(projectToGround({ x: -1, y: 2, z: -3 })).toEqual({
        x: -1,
        y: -3
      })
      expect(projectToGround({ x: 5, y: -3, z: -5 })).toEqual({
        x: 5,
        y: -5
      })
    })
  })

  describe('buildGroundRectangle()', () => {
    it('builds a rectangle out of a bounding box', () => {
      expect(
        buildGroundRectangle({
          minimumWorld: { x: 1, y: 2, z: 3 },
          maximumWorld: { x: 4, y: 5, z: 6 }
        })
      ).toEqual({
        min: { x: 1, y: 3 },
        max: { x: 4, y: 6 }
      })
    })

    it('handles no input', () => {
      expect(buildGroundRectangle()).toEqual({
        min: { x: 0, y: 0 },
        max: { x: 0, y: 0 }
      })
    })
  })

  describe('buildEnclosedCircle()', () => {
    it('builds a circle within a square', () => {
      expect(
        buildEnclosedCircle({ min: { x: -1, y: -2 }, max: { x: 1, y: 0 } })
      ).toEqual({ center: { x: 0, y: -1 }, radius: 1 })
    })

    it('builds a circle within rectangles', () => {
      expect(
        buildEnclosedCircle({ min: { x: -2, y: -2 }, max: { x: 1, y: -1 } })
      ).toEqual({ center: { x: -0.5, y: -1.5 }, radius: 0.5 })
      expect(
        buildEnclosedCircle({ min: { x: 2, y: -1 }, max: { x: 4, y: 3 } })
      ).toEqual({ center: { x: 3, y: 1 }, radius: 1 })
    })

    it('handles no input', () => {
      expect(buildEnclosedCircle()).toEqual({
        center: { x: 0, y: 0 },
        radius: 0
      })
    })
  })

  describe('intersectRectangles()', () => {
    const box = { min: { x: 0, y: 0 }, max: { x: 2, y: 1 } }
    it.each([
      {
        title: 'a box intersecting on the right',
        otherBox: { min: { x: 1.5, y: 0 }, max: { x: 2.5, y: 2 } },
        result: true
      },
      {
        title: 'a box intersecting on the left',
        otherBox: { min: { x: -0.5, y: -1.5 }, max: { x: 0.5, y: 0.5 } },
        result: true
      },
      {
        title: 'a box intersecting at the top',
        otherBox: { min: { x: 0.5, y: 0.5 }, max: { x: 1.5, y: 2.5 } },
        result: true
      },
      {
        title: 'a box intersecting at the bottom',
        otherBox: { min: { x: -0.5, y: -1.5 }, max: { x: 2.5, y: 0.5 } },
        result: true
      },
      {
        title: 'an enclosing box',
        otherBox: { min: { x: -0.5, y: -1.5 }, max: { x: 2.5, y: 3.5 } },
        result: true
      },
      {
        title: 'an enclosed box',
        otherBox: { min: { x: 0.5, y: 0.5 }, max: { x: 0.75, y: 0.75 } },
        result: true
      },
      {
        title: 'a box on the right',
        otherBox: { min: { x: 3, y: 0 }, max: { x: 4, y: 2 } },
        result: false
      },
      {
        title: 'a box on the left',
        otherBox: { min: { x: -2, y: -1 }, max: { x: -1, y: 2 } },
        result: false
      },
      {
        title: 'a box at the top',
        otherBox: { min: { x: -1, y: 2 }, max: { x: 1, y: 3 } },
        result: false
      },
      {
        title: 'a box at the bottom',
        otherBox: { min: { x: -1, y: -2 }, max: { x: 1, y: -1 } },
        result: false
      },
      {
        title: 'a box with the same right edge',
        otherBox: { min: { x: 2, y: 0 }, max: { x: 3, y: 2 } },
        result: true
      },
      {
        title: 'a box with the same left edge',
        otherBox: { min: { x: -1, y: -1.5 }, max: { x: 0, y: 0.5 } },
        result: true
      },
      {
        title: 'a box with the same top edge',
        otherBox: { min: { x: 0.5, y: 1 }, max: { x: 1.5, y: 2 } },
        result: true
      },
      {
        title: 'a box with the same bottom edge',
        otherBox: { min: { x: -0.5, y: -1 }, max: { x: 2.5, y: 0 } },
        result: true
      }
    ])('returns $result with $title', ({ otherBox, result }) => {
      expect(intersectRectangles(box, otherBox)).toBe(result)
    })
  })

  describe('intersectCircles()', () => {
    const circle = { center: { x: 1, y: 1 }, radius: 2 }
    it.each([
      {
        title: 'a circle intersecting on the top right',
        otherCircle: { center: { x: 3.5, y: 2 }, radius: 1.5 },
        result: true
      },
      {
        title: 'a circle intersecting on the bottom left',
        otherCircle: { center: { x: -1, y: -1 }, radius: 1.5 },
        result: true
      },
      {
        title: 'a circle intersecting at the bottom right',
        otherCircle: { center: { x: 2, y: -2 }, radius: 2 },
        result: true
      },
      {
        title: 'a circle intersecting at the top left',
        otherCircle: { center: { x: -0, y: 4 }, radius: 2 },
        result: true
      },
      {
        title: 'an enclosing circle',
        otherCircle: { center: { x: -2, y: -1 }, radius: 10 },
        result: true
      },
      {
        title: 'an enclosed circle',
        otherCircle: { center: { x: 1.5, y: 1 }, radius: 1 },
        result: true
      },
      {
        title: 'a circle on the top right',
        otherCircle: { center: { x: 3, y: 4 }, radius: 1.5 },
        result: false
      },
      {
        title: 'a circle on the bottom left',
        otherCircle: { center: { x: -1, y: -2 }, radius: 1.5 },
        result: false
      }
    ])('returns $result with $title', ({ otherCircle, result }) => {
      expect(intersectCircles(circle, otherCircle)).toBe(result)
    })
  })

  describe('intersectRectangleWithCircle()', () => {
    const rectangle = { min: { x: 2, y: 1 }, max: { x: 6, y: 3 } }
    it.each([
      {
        title: 'a circle intersecting on the bottom left',
        circle: { center: { x: 1, y: 0 }, radius: 2 },
        result: true
      },
      {
        title: 'a circle intersecting on the bottom right',
        circle: { center: { x: 7, y: 0 }, radius: 2 },
        result: true
      },
      {
        title: 'a circle intersecting on the top left',
        circle: { center: { x: 1, y: 4 }, radius: 2 },
        result: true
      },
      {
        title: 'a circle intersecting on the top right',
        circle: { center: { x: 7, y: 4 }, radius: 2 },
        result: true
      },
      {
        title: 'a circle intersecting on the top',
        circle: { center: { x: 3, y: 4 }, radius: 1 },
        result: true
      },
      {
        title: 'a circle intersecting on the left',
        circle: { center: { x: 7, y: 2 }, radius: 1 },
        result: true
      },
      {
        title: 'a circle intersecting on the right',
        circle: { center: { x: 1, y: 2 }, radius: 1 },
        result: true
      },
      {
        title: 'a circle intersecting on the bottom',
        circle: { center: { x: 5, y: 0 }, radius: 1 },
        result: true
      },
      {
        title: 'a circle intersecting on the bottom left',
        circle: { center: { x: 1, y: 0 }, radius: 1 },
        result: false
      },
      {
        title: 'a circle intersecting on the bottom right',
        circle: { center: { x: 7, y: 0 }, radius: 1 },
        result: false
      },
      {
        title: 'a circle intersecting on the top left',
        circle: { center: { x: 1, y: 4 }, radius: 1 },
        result: false
      },
      {
        title: 'a circle intersecting on the top right',
        circle: { center: { x: 7, y: 4 }, radius: 1 },
        result: false
      },
      {
        title: 'a circle enclosing the rectangle',
        circle: { center: { x: 4, y: 2 }, radius: 6 },
        result: true
      },
      {
        title: 'a circle enclosed into the rectangle',
        circle: { center: { x: 4, y: 2 }, radius: 0.75 },
        result: true
      }
    ])('returns $result with $title', ({ circle, result }) => {
      expect(intersectRectangleWithCircle(rectangle, circle)).toBe(result)
    })
  })
})
