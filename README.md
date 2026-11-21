# rajeevsahu.me

Personal site of Rajeev Sahu, Senior Backend Engineer. Static site built with [Astro](https://astro.build) and Tailwind CSS. No backend and no CMS.

## Develop

Requires Node ≥ 22.23.4 (see `.nvmrc`).

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
npm run preview   # serve the build
npm run check     # type-check .astro/.ts files and content frontmatter
```

## Editing content

| What | Where |
| --- | --- |
| Name, headline, availability, links, metrics, experience, projects, skills | `src/data/profile.ts` |
| "Selected work" cards and case studies | `src/content/work/*.md` |
| Resume PDF | `public/resume.pdf` |
| Link-preview image | `node scripts/og-image.mjs` → `public/og.png` |

To publish a full case study, write the Markdown body of a file in `src/content/work/` and set `caseStudy: true` in its frontmatter. It will appear at `/work/<file-name>/` and the homepage card will link to it.

Set `availability` to `null` in `profile.ts` to hide the "open to roles" badge.

## Deploy

Vercel (framework preset: Astro, output: `dist`). Pushing to `main` deploys.
