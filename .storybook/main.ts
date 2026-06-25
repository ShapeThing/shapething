import type { StorybookConfig } from '@storybook/react-vite'
import { fixRdfjsSinkMap } from '../fixRdfjsSinkMap'

const config: StorybookConfig = {
  stories: ['../*.mdx', '../lib/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-vitest',
    '@storybook/addon-docs',
    '@chromatic-com/storybook',
    '@storybook/addon-a11y'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  async viteFinal(config) {
    config.plugins = [fixRdfjsSinkMap, ...(config.plugins ?? [])]
    return config
  }
}
export default config
