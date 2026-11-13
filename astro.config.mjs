import { defineConfig } from 'astro/config';

// `base` and `site` are set at publish time through env vars so the same
// build works on any static host (root domain or sub-path).
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
