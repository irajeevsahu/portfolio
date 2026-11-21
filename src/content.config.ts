import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Each file in src/content/work is a "Selected work" card on the homepage.
// Set `caseStudy: true` once the Markdown body is written to publish /work/<slug>.
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    org: z.string(),
    year: z.string(),
    summary: z.string(),
    outcome: z.string(),
    stack: z.array(z.string()),
    order: z.number(),
    caseStudy: z.boolean().default(false),
  }),
});

export const collections = { work };
