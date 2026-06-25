import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      'lib/scss',
      'storybook-static',
      'dist',
      'public',
      'lib/style.css',
      'eslint.config.js',
      'lib/widgets/facets/CountFacet/multirangeslider.js'
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
  ...tseslint.configs.recommended
]
