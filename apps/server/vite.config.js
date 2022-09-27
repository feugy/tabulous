import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000
  }
})
