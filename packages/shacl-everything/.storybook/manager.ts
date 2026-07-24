import React from "react";
import { addons } from "storybook/manager-api";
import "./addons/graph-inspector/register.tsx";

addons.setConfig({
  layout: {
    navSize: 400,
  },
});
