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
      'packages/SHACL-renderer/lib/scss',
      'packages/SHACL-renderer/lib/style.css',
      'packages/SHACL-renderer/lib/widgets/facets/CountFacet/multirangeslider.js'
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
