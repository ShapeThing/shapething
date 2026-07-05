import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.astro/**',
      '**/.turbo/**',
      '**/storybook-static/**',
      '**/public/**',
      'packages/shacl-renderer/lib/scss',
      'packages/shacl-renderer/lib/style.css',
      'packages/shacl-renderer/lib/widgets/facets/CountFacet/multirangeslider.js',
      'packages/typed-sparql/tests/**/*.d.ts'
    ]
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  { languageOptions: { globals: globals.browser } },
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
]
