import virtual from '@rollup/plugin-virtual'
import { defineConfig } from 'vite'
import sassGlobImports from 'vite-plugin-sass-glob-import'

// This only compiles the sass.
// I wanted to have globbing.
export default defineConfig({
  plugins: [
    virtual({
      styles: `
        import './lib/scss/style.scss';
      `
    }),
    sassGlobImports()
  ],
  build: {
    lib: {
      entry: 'styles',
      name: 'Styles',
      formats: ['es'],
      fileName: () => 'styles.js'
    },
    rollupOptions: {
      input: {
        main: 'styles'
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {}
    }
  }
})
