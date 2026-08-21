export const SUBMIT_PREVIEW_ADDON_ID = "submit-preview";
export const SUBMIT_PREVIEW_PANEL_ID = `${SUBMIT_PREVIEW_ADDON_ID}/panel`;
export const SUBMIT_PREVIEW_EVENT = `${SUBMIT_PREVIEW_ADDON_ID}/update`;

export type SubmitPreviewPayload = {
  storyId: string;
  dataGraph: string;
  additions: string;
  deletions: string;
};
