// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://rajeevsahu.me',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      // Light/dark code themes; global.css switches to the dark one under `.dark`.
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'light',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
