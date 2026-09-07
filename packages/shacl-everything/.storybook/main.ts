import type { StorybookConfig } from "@storybook/react-vite";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import remarkGfm from "remark-gfm";
import { checkBannedContent } from "./checkBannedContent.ts";
import { copyStoryFixtures } from "./copyStoryFixtures.ts";

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    getAbsolutePath("@chromatic-com/storybook"),
    getAbsolutePath("@storybook/addon-vitest"),
    getAbsolutePath("@storybook/addon-a11y"),
    {
      name: getAbsolutePath("@storybook/addon-docs"),
      // GFM (tables, strikethrough, task lists, ...) isn't enabled by MDX3 out of the box -
      // without this, a Markdown pipe-table in a .mdx doc renders as a plain paragraph.
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
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
