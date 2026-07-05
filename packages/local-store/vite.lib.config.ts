import { isAbsolute } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist',
    lib: {
      entry: {
        LocalStore: 'lib/LocalStore.ts'
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      // Nothing outside this package's own source should be bundled;
      // consumers resolve dependencies from their own node_modules.
      external: id => !id.startsWith('.') && !isAbsolute(id)
    }
  }
})
