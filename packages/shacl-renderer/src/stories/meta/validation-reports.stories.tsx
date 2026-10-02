import type { StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import ShaclRenderer, { type ShaclRendererProps } from "@/outputs/render/render.tsx";
import { fixtureUrl } from "@/helpers/argsByTestFile.ts";
import { testingEnvironment } from "@/environment.ts";

type Story = StoryObj<ShaclRendererProps>;

// mode: "report" - a SHACL validation report rendered with each result inline under the property
// it's about. Only the report is required; the shapes and the data each add detail (property
// names and precise messages; resource labels and the remaining values).
export default {
  title: "Shapes and Ontologies/Validation reports",
  component: ShaclRenderer,
  args: testingEnvironment,
  parameters: {
    maxWidth: "1000px",
  },
};

const example = (file: string) => fixtureUrl(`./examples/validation-report/${file}`, import.meta.url);

export const reportOnly: Story = {
  name: "Report only",
  args: { mode: "report", validationReport: example("report.ttl") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText(/3\W*errors/)).toBeVisible();
    // Without shapes, properties are named after their sh:resultPath (capitalized by CSS)...
    expect(await canvas.findByText("birth Date")).toBeVisible();
    // ...the reported values come from the report itself...
    expect(await canvas.findByText("2031-04-01")).toBeVisible();
    // ...and a message is generic unless the report carries its own.
    expect(canvas.getByText("Is too large")).toBeVisible();
  },
};

export const reportWithShapes: Story = {
  name: "Report and shapes",
  args: { mode: "report", validationReport: example("report.ttl"), shapesGraph: example("shapes.ttl") },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The shapes' own sh:name, and messages built from their parameters.
    expect(await canvas.findByText("Birth date")).toBeVisible();
    expect(canvas.getByText(/Must be at most\W*2026-01-01/)).toBeVisible();
    expect(canvas.getByText("Is required")).toBeVisible();
    // The email property shape is a blank node - matched by its sh:path, so it still gets its name.
    expect(canvas.getByText("Email")).toBeVisible();
  },
};

export const reportWithShapesAndData: Story = {
  name: "Report, shapes and data",
  args: {
    mode: "report",
    validationReport: example("report.ttl"),
    shapesGraph: example("shapes.ttl"),
    dataGraph: example("data.ttl"),
    interfaceLanguage: "en-GB",
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hendrik = (await canvas.findByRole("heading", { name: "Hendrik" })).closest("section")!;
    const anonymous = canvas.getByRole("heading", { name: "Anonymous person" }).closest("section")!;

    // Hendrik's violations sort him first.
    expect(hendrik.compareDocumentPosition(anonymous) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // The postal code's own sh:message, nested under the address it's about (sh:detail).
    const address = await within(hendrik as HTMLElement).findByText("Breestraat 1, Amersfoort");
    expect(address).toBeVisible();
    expect(
      within(hendrik as HTMLElement).getByText("Use a Dutch postal code, like 1234 AB"),
    ).toBeVisible();

    // The report's own value, not the data's since-fixed one.
    expect(within(hendrik as HTMLElement).getByText("hendrik.example.org")).toBeVisible();
    expect(within(hendrik as HTMLElement).queryByText("hendrik@example.org")).toBeNull();

    // Only the affected properties are shown - Hendrik's name is fine, so it's absent.
    expect(within(hendrik as HTMLElement).queryByText("Name")).toBeNull();
    // ...while the anonymous person's missing name is shown, with no value.
    expect(within(anonymous as HTMLElement).getByText("Name")).toBeVisible();
    expect(within(anonymous as HTMLElement).getByText("Is required")).toBeVisible();
    // A placeholder in the value's place, so the missing value itself is visible.
    expect(within(anonymous as HTMLElement).getByText("No value has been given")).toBeVisible();
  },
};

export const reportInDutch: Story = {
  name: "Report, shapes and data (Dutch interface)",
  args: {
    mode: "report",
    validationReport: example("report.ttl"),
    shapesGraph: example("shapes.ttl"),
    dataGraph: example("data.ttl"),
    interfaceLanguage: "nl-NL",
    contentLanguage: "nl",
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText(/3\W*fouten/)).toBeVisible();
    expect(canvas.getByText("Geboortedatum")).toBeVisible();
    expect(canvas.getByText("Gebruik een Nederlandse postcode, zoals 1234 AB")).toBeVisible();
    expect(canvas.getByText("Is verplicht")).toBeVisible();
    expect(canvas.getByText("Er is geen waarde opgegeven")).toBeVisible();
  },
};

// A property with several values that each have results of their own: every value gets its own row,
// its messages right below it, so each message is clearly about that one value. Only the values the
// report names are shown (the report takes precedence over the data), so the valid
// hendrik@example.org isn't listed.
export const severalValuesWithDifferentResults: Story = {
  name: "Several values, each with its own result",
  args: {
    mode: "report",
    validationReport: example("multiple-values-report.ttl"),
    shapesGraph: example("shapes.ttl"),
    dataGraph: example("multiple-values-data.ttl"),
    interfaceLanguage: "en-GB",
  } as ShaclRendererProps,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText("hendrik.example.org");
    const rows = canvas
      .getAllByText("Email")
      .map((label) => label.closest(".st-form-element") as HTMLElement);
    expect(rows).toHaveLength(2);

    // Each row holds one value, with only its own message.
    const [malformed, tooLong] = rows;
    expect(within(malformed).getByText("hendrik.example.org")).toBeVisible();
    expect(malformed).toHaveTextContent(/Does not match the pattern/);
    expect(malformed).not.toHaveTextContent(/characters long/);
    expect(
      await within(tooLong).findByText("hendrik.jansen.from.amersfoort@example.org"),
    ).toBeVisible();
    expect(tooLong).toHaveTextContent(/Must be at most\W*30\W*characters long/);
    expect(tooLong).not.toHaveTextContent(/Does not match the pattern/);

    expect(canvas.queryByText("hendrik@example.org")).toBeNull();
  },
};

// Expected reports from the W3C SHACL test suite (examples/shacl-test-suite/, copied verbatim).
// Each test file holds its data, its shapes and its expected report in one graph - so the same
// file is passed as all three.
const testSuite = (testName: string) => {
  const file = fixtureUrl(`./examples/shacl-test-suite/${testName}.ttl`, import.meta.url);
  return { mode: "report" as const, validationReport: file, shapesGraph: file, dataGraph: file };
};

export const personExample: Story = {
  name: "W3C test suite: core/complex/personexample",
  args: testSuite("personexample"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText(/4\W*errors/)).toBeVisible();
    // Alice, Bob and Calvin - Calvin's two results share one section.
    expect(canvasElement.querySelectorAll(".st-report-mode__focus-node")).toHaveLength(3);
    // sh:closed: Calvin's birth date isn't declared by the shape at all.
    expect(canvas.getByText("Is not allowed here")).toBeVisible();
    expect(canvas.getByText(/Does not match the pattern/)).toBeVisible();
  },
};

export const minCount: Story = {
  name: "W3C test suite: core/property/minCount-001",
  args: testSuite("minCount-001"),
};

export const message: Story = {
  name: "W3C test suite: core/misc/message-001",
  args: testSuite("message-001"),
};

export const customSeverity: Story = {
  name: "W3C test suite: core/misc/severity-002",
  args: testSuite("severity-002"),
};

export const conforming: Story = {
  name: "W3C test suite: core/property/minCount-002 (conforms)",
  args: testSuite("minCount-002"),
  play: async ({ canvasElement }) => {
    expect(await within(canvasElement).findByText("No problems found")).toBeVisible();
  },
};
