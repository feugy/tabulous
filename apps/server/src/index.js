// @ts-check
import { config } from 'dotenv'

import { startServer } from './server.js'
import { loadConfiguration } from './services/configuration.js'

config()

startServer(loadConfiguration())
