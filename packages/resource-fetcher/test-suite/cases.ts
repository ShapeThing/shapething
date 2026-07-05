import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

interface TestCase {
  name: string;
  path: string;
  iri: string;
  steps: number;
  input: string;
  output: string;
  shapeIri?: string;
  shapeDefinition?: string;
}


async function readFileIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return undefined;
  }
}

export async function discoverTestCases(baseDir: string): Promise<TestCase[]> {
  const testCases: TestCase[] = [];
  const entries = [];

  // Get all directories in test-suite
  for (const entry of await readdir(baseDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      entries.push(entry.name);
    }
  }

  // Filter based on .skip and .only
  const hasOnly = entries.some((name) => name.includes(".only"));

  for (const name of entries) {
    // Skip directories with .skip
    if (name.includes(".skip")) {
      continue;
    }

    // If there's a .only directory, only run those
    if (hasOnly && !name.includes(".only")) {
      continue;
    }

    // Skip the test-suite.ts file itself
    if (name === "test-suite.ts") {
      continue;
    }

    const testPath = join(baseDir, name);
    const iri = await readFileIfExists(join(testPath, "iri.txt"));
    const stepsText = await readFileIfExists(join(testPath, "steps.txt"));
    const input = await readFileIfExists(join(testPath, "input.ttl"));
    const output = await readFileIfExists(join(testPath, "output.ttl"));
    const shapeIri = await readFileIfExists(join(testPath, "shape-iri.txt"));
    const shapeDefinition = await readFileIfExists(join(testPath, "shape.ttl"));

    testCases.push({
      name: name.replace(".only", ""),
      path: testPath,
      iri: iri?.trim() ?? "",
      steps: stepsText ? parseInt(stepsText.trim()) : 0,
      input: input ?? "",
      output: output ?? "",
      shapeIri: shapeIri?.trim(),
      shapeDefinition,
    });
  }

  return testCases;
}
