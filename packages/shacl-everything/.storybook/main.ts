import type { StorybookConfig } from "@storybook/react-vite";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { checkBannedContent } from "./checkBannedContent.ts";
import { copyStoryFixtures } from "./copyStoryFixtures.ts";

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: [
    // "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-a11y"),
    getAbsolutePath("@storybook/addon-docs"),
  ],
  framework: getAbsolutePath("@storybook/react-vite"),
  async viteFinal(config) {
    const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../src");
    config.plugins ??= [];
    config.plugins.push(checkBannedContent(srcDir), copyStoryFixtures(srcDir));
    return config;
  },
};
export default config;
