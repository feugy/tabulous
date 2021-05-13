import mercurius from 'mercurius'

const { ErrorWithProps } = mercurius

/**
 * Wraps a graphQL resolver with a function checking the existing of a `player` in the graphQL context.
 * The wrapped function can be registered as a graphQL resolver.
 * It will throws an 401 error when invoked without player.
 * @param {function} resolver - graphQL resolver function
 * @returns {function} the wrapped graphQL resolver function
 */
export function isAuthenticated(resolver) {
  return (obj, args, context) => {
    if (!context.player) {
      throw new ErrorWithProps('Unauthorized', { code: 401 })
    }
    return resolver(obj, args, context)
  }
}
