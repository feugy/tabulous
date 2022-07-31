import { createTransformer } from 'babel-jest'

const env = {
  WEB_USE_GITHUB_PROVIDER: 'true',
  WEB_USE_GOOGLE_PROVIDER: 'true',
  WEB_GRAPHQL_URL: 'https://localhost:3000/graphql',
  WEB_GAME_ASSETS_URL: 'https://localhost:3000/games'
}

// Because Jest is not running ESM, import.meta will not be defined
// We need to patch import.meta.hot, which is strictly for Vite, so it could be ignored.
const factory = {
  createTransformer: (...args) => {
    const transformer = createTransformer(...args)
    const originalProcess = transformer.process
    transformer.process = function (...args) {
      if (args[1].includes('apps/web/') || args[1].includes('.svelte-kit')) {
        args[0] = args[0]
          .replace(/import\.meta\.hot\.on/g, '(function(){})')
          .replace(/import\.meta\.hot/g, 'false')
          .replace(/import\.meta/g, `{ env: ${JSON.stringify(env)} }`)
      }
      return originalProcess(...args)
    }
    return transformer
  }
}

export default factory
