/* eslint-disable no-unused-vars */
import { default as Repositories } from '@tabulous/server/src/repositories'
import type { Redis } from 'ioredis'

// Applies a migration, given repositories instances and initialized Redis client.
export type Apply = (
  repositories: typeof Repositories,
  redis: Redis
) => Promise<void>
