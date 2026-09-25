// @ts-check

import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// SITE_URL and BASE_PATH are filled in automatically by the GitHub Pages
// workflow (.github/workflows/deploy.yml). Locally the site is served at "/".
export default defineConfig({
	site: process.env.SITE_URL || 'https://alexanderdpark.github.io',
	base: process.env.BASE_PATH || '/',
	integrations: [sitemap()],
	build: {
		inlineStylesheets: 'always',
	},
});
