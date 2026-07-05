// https://vitejs.dev/config/
// Vite 8 import-analysis incorrectly rewrites `import(` in class method
// definitions (not just dynamic import() calls). @rdfjs/sink-map defines a
// method named `import`; switching it to computed property syntax avoids the
// transform while keeping the method callable as `.import()`.
export const fixRdfjsSinkMap = {
    name: 'fix-rdfjs-sink-map-import-method',
    enforce: 'pre' as const,
    transform(code: string) {
        if (!code.includes('import(key') && !code.includes('import (key')) return
        return code.replace(/\bimport\s*\(key,\s*input,\s*options\)/, "['import'](key, input, options)")
    }
}