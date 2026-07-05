import { isAbsolute } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler']
      }
    })
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    lib: {
      entry: {
        index: 'lib/index.tsx',
        webcomponent: 'lib/webcomponent.tsx',
        rdfToData: 'lib/tools/data/rdfToData.ts',
        dataToRdf: 'lib/tools/data/dataToRdf.ts',
        faker: 'lib/tools/faker/faker.ts',
        type: 'lib/tools/type/type.ts',
        resolveRdfInput: 'lib/core/resolveRdfInput.ts'
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      // Nothing outside this package's own source should be bundled;
      // consumers resolve dependencies from their own node_modules.
      external: (id) => !id.startsWith('.') && !isAbsolute(id)
    }
  },
  resolve: {
    alias: {
      'node:events': 'events'
    }
  }
})
