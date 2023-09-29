// @ts-check
import { addAbsoluteAsset, isRelativeAsset } from '@tabulous/game-utils'
import Ajv from 'ajv/dist/2020.js'

/**
 * Unique AJV instance used for game parameter validation.
 */
export const ajv = new Ajv({
  $data: true,
  allErrors: true,
  strictSchema: false
})

/**
 * Loads a game descriptor's parameter schema.
 * If defined, enriches any image found;
 * @param {object} args - arguments, including:
 * @param {?Pick<import('@tabulous/types').GameDescriptor, 'askForParameters'>} args.descriptor - game descriptor.
 * @param {import('@tabulous/types').StartedGame} args.game - current game's data.
 * @param {import('@tabulous/types').Player} args.player - player for which descriptor is retrieved.
 * @returns {Promise<?import('@tabulous/types').GameParameters<?>>} the parameter schema, or null.
 */
export async function getParameterSchema({ descriptor, game, player }) {
  const schema = await descriptor?.askForParameters?.({ game, player })
  if (!schema || !ajv.validateSchema(schema)) {
    return null
  }
  for (const property of Object.values(schema.properties)) {
    if (property.metadata?.images) {
      for (const [name, image] of Object.entries(property.metadata.images)) {
        if (isRelativeAsset(image) && game.kind) {
          property.metadata.images[name] = addAbsoluteAsset(
            image,
            game.kind,
            'image'
          )
        }
      }
    }
  }
  return schema ? { ...game, schema } : null
}
