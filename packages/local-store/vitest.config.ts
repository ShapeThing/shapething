import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'preview',
      instances: [
      { browser: 'chrome' },
      ],
    },
  },
})
