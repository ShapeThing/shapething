import { addons, types } from "storybook/manager-api";
import { SUBMIT_PREVIEW_ADDON_ID, SUBMIT_PREVIEW_PANEL_ID } from "./constants.ts";
import { SubmitPreviewPanel } from "./Panel.tsx";
import React from "react";

addons.register(SUBMIT_PREVIEW_ADDON_ID, () => {
  addons.add(SUBMIT_PREVIEW_PANEL_ID, {
    type: types.PANEL,
    title: "Submit",
    match: ({ viewMode }) => viewMode === "story",
    render: ({ active }) => <SubmitPreviewPanel active={!!active} />,
  });
});
