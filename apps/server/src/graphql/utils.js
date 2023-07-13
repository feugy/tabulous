// @ts-check
import mercurius from 'mercurius'

const { ErrorWithProps } = mercurius

/** @typedef {import('../plugins/graphql').GraphQLContext} GraphQLAnonymousContext*/
/** @typedef {Omit<GraphQLAnonymousContext, 'player'> & { player: NonNullable<GraphQLAnonymousContext['player']> }} GraphQLContext*/
/** @typedef {ReturnType<import('mercurius').PubSub['subscribe']>} PubSubQueue*/

/**
 * @template Source, Context, Args
 * @typedef {import('mercurius').IFieldResolver<Source, Context, Args>} Resolver
 */

/**
 * Wraps a graphQL resolver with a function checking the existing of a `player` in the graphQL context.
 * The wrapped function can be registered as a graphQL resolver.
 * It will throws an 401 error when invoked without player.
 * @template Source, Args
 * @param {Resolver<Source, GraphQLContext, Args>} resolver - graphQL resolver function
 * @returns {Resolver<Source, GraphQLContext, Args>} the wrapped graphQL resolver function
 */
export function isAuthenticated(resolver) {
  return (obj, args, context, info) => {
    if (!context.player) {
      throw new ErrorWithProps('Unauthorized', { code: 401 })
    }
    return resolver(obj, args, context, info)
  }
}

/**
 * Wraps a graphQL resolver with a function checking `isAdmin` property of the player in graphQL context.
 * The wrapped function can be registered as a graphQL resolver.
 * It will throws an 403 error when current player is not an admin.
 * @template Source, Args
 * @param {Resolver<Source, GraphQLContext, Args>} resolver - graphQL resolver function
 * @returns {Resolver<Source, GraphQLContext, Args>} the wrapped graphQL resolver function
 */
export function isAdmin(resolver) {
  return isAuthenticated((obj, args, context, info) => {
    if (!context.player.isAdmin) {
      throw new ErrorWithProps('Forbidden', { code: 403 })
    }
    return resolver(obj, args, context, info)
  })
}
