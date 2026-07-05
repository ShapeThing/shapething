import { defineCollection, z } from "astro:content";

import { glob } from "astro/loaders";

const schema = z.object({
    title: z.string(),
    order: z.number().optional(),
  })

const guides = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs/guides/" }),
  schema,
});

const deepDives = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs/deep-dives/" }),
  schema,
});

const references = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/docs/references/" }),
  schema,
});

export const collections = { guides, deepDives, references };
