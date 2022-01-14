import { configureToolshot } from '@atelier-wb/toolshot'
import { join } from 'path'

configureToolshot({
  folder: join(__dirname, '..'),
  timeout: 10e3,
  include: '^((?!Game).)*\\.tools\\.svelte$'
})