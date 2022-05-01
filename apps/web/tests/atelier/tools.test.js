import { configureToolshot } from '@atelier-wb/toolshot'
import { join } from 'path'

configureToolshot({
  folder: join(__dirname, '..'),
  timeout: 10000,
  include: '^((?!Game).)*\\.tools\\.svelte$'
})
