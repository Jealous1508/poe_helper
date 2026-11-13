// Catches content markup that reached the page unrendered: `**bold**` and
// `[[Game Term]]` printed as themselves.
//
// This happens when a field is added to the YAML and printed with {value}
// instead of going through <Rich>. Nothing fails — the build is clean, the
// tests pass, and the page quietly shows asterisks and double brackets to
// the reader. Run after `astro build`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Visible text only: no scripts, styles or attribute values. */
function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

const patterns = [
  { name: 'unrendered term', re: /\[\[[^\]\n]{1,60}\]\]/g },
  { name: 'unrendered bold', re: /\*\*[^*\n]{1,80}\*\*/g },
];

const pages = walk(DIST).filter((file) => file.endsWith('.html'));
const found = [];

for (const page of pages) {
  const text = visibleText(readFileSync(page, 'utf8'));
  for (const { name, re } of patterns) {
    for (const match of text.matchAll(re)) found.push(`${page}: ${name} ${match[0].slice(0, 60)}`);
  }
}

if (found.length) {
  console.error(`markup check: ${found.length} unrendered span(s) in ${pages.length} pages`);
  for (const line of found.slice(0, 20)) console.error(`  ${line}`);
  console.error('  A field is being printed with {value} instead of <Rich text={value} />.');
  process.exit(1);
}
console.log(`markup check: ${pages.length} pages, no unrendered markup`);
