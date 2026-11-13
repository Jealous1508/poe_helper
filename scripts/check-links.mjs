// Checks that every internal link and asset reference in the built site
// points at a file that exists in dist/. Run after `astro build`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function resolves(url) {
  let path = url.split('#')[0].split('?')[0];
  if (!path.startsWith(base)) return false;
  path = decodeURIComponent(path.slice(base.length));
  const target = join(DIST, path);
  if (path === '' || path.endsWith('/')) return existsSync(join(target, 'index.html'));
  return existsSync(target) || existsSync(join(target, 'index.html'));
}

const pages = walk(DIST).filter((file) => file.endsWith('.html'));
const broken = [];
let checked = 0;

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = match[1].replaceAll('&amp;', '&');
    if (/^(https?:|mailto:|data:|javascript:)/.test(url)) continue;
    checked += 1;
    if (url.startsWith('#')) {
      if (url.length > 1 && !ids.has(url.slice(1))) broken.push(`${page}: missing anchor ${url}`);
      continue;
    }
    if (!url.startsWith('/')) {
      broken.push(`${page}: relative link ${url} (use pagePath or assetPath)`);
      continue;
    }
    if (!resolves(url)) broken.push(`${page}: ${url}`);
  }
}

if (broken.length) {
  console.error(`link check: ${broken.length} broken of ${checked} links in ${pages.length} pages`);
  for (const line of broken.slice(0, 40)) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`link check: ${checked} links in ${pages.length} pages, all resolve`);
