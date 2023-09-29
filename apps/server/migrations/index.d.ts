/* eslint-disable no-unused-vars */
import type { Redis } from 'ioredis'

import * as Repositories from '../src/repositories'

// Applies a migration, given repositories instances and initialized Redis client.
export type Apply = (
  repositories: typeof Repositories,
  redis: Redis
) => Promise<void>
