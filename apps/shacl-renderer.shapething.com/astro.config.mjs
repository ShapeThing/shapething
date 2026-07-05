// @ts-check
import { defineConfig } from 'astro/config';

import icon from 'astro-icon';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [icon(), react()],
  redirects: {
    "/docs": "/docs/guides/getting-started",
    "/docs/guides": "/docs/guides/getting-started",
  }
});