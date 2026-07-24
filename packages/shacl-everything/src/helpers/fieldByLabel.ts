import { within } from "storybook/test";

// Every property renders as a `.form-element` (see FormElement) carrying its own sh:name label,
// so a story's assertions can be scoped to "the field labelled X" rather than the whole canvas.
export function fieldByLabel(canvasElement: HTMLElement, label: string): HTMLElement {
  const labelElement = within(canvasElement).getByText(label);
  const field = labelElement.closest(".form-element");
  if (!(field instanceof HTMLElement)) {
    throw new Error(`No .form-element found for label "${label}"`);
  }
  return field;
}
