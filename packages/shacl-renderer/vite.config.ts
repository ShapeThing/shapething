import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { DynamicPublicDirectory } from 'vite-multiple-assets'
import mkcert from 'vite-plugin-mkcert'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import sassGlobImports from 'vite-plugin-sass-glob-import'
import { fixRdfjsSinkMap } from './fixRdfjsSinkMap'

const reactConfig: Record<string, unknown> = {
  babel: {
    plugins: ['babel-plugin-react-compiler']
  }
}

if (process.env.VITE_DEBUG === 'true') {
  reactConfig.jsxImportSource = '@welldone-software/why-did-you-render'
}

export default defineConfig({
  plugins: [
    fixRdfjsSinkMap,
    sassGlobImports(),
    DynamicPublicDirectory(['public/**', '{\x01,lib}/**/{*.ttl,*.jpg}', '{\x01,translations}/**']),
    mkcert(),
    nodePolyfills({
      include: ['buffer']
    }),
    react(reactConfig)
  ],
  publicDir: false,
  // This is here for the build:storybook
  build: {
    target: 'esnext'
  },
  server: {
    https: {}
  },
  css: {
    preprocessorOptions: {
      scss: {}
    }
  },
  resolve: {
    alias: {
      'node:events': 'events'
    }
  },
  optimizeDeps: {
    include: ['memory-level']
  }
})
