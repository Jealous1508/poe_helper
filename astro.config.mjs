import { defineConfig } from 'astro/config';

// `base` and `site` are set at publish time through env vars so the same
// build works on any static host (root domain or sub-path).
export default defineConfig({
  // The deployed origin is the default so that preview cards carry a real
  // URL without anyone having to set an environment variable on the host.
  site: process.env.SITE_URL || 'https://poe-helper.jealouselse.workers.dev',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
