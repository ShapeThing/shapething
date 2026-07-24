import type { Preview } from "@storybook/react-vite";
import { withGraphInspector } from "./addons/graph-inspector/withGraphInspector.tsx";
import React from "react";

const preview: Preview = {
  decorators: [withGraphInspector],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
};

export default preview;
