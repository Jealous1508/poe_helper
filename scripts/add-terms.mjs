// Adds game terms to the registry and queues their icons for download.
//
//   node scripts/add-terms.mjs <league> <kind> "Name" "Another Name" ...
//   node scripts/add-terms.mjs 3.30 gem "Cyclone" "Ice Nova"
//
// kind is one of the registry's term kinds (gem, support, unique, currency,
// item, keystone, notable, mechanic, npc, zone, class).
//
// For each name it:
//   1. skips it if the registry already has it,
//   2. adds an images.json entry pointing at that name's poedb page,
//   3. appends the term to src/content/terms/<league>.yaml.
//
// Then run `npm run images` to fetch the icons, and `npm run verify`.
// Any icon that fails to download is reported by that step, and the term
// can be edited by hand to drop the image.
import { readFileSync, writeFileSync } from 'node:fs';

const [league, kind, ...names] = process.argv.slice(2);
if (!league || !kind || names.length === 0) {
  console.error('usage: node scripts/add-terms.mjs <league> <kind> "Name" ...');
  process.exit(2);
}

const KINDS = ['gem', 'support', 'unique', 'currency', 'item', 'keystone', 'notable', 'mechanic', 'npc', 'zone', 'class'];
if (!KINDS.includes(kind)) {
  console.error(`unknown kind "${kind}". One of: ${KINDS.join(', ')}`);
  process.exit(2);
}

const termsPath = `src/content/terms/${league}.yaml`;
const manifestPath = 'src/data/images.json';
const terms = readFileSync(termsPath, 'utf8').split('\r\n').join('\n');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

/** "Shavronne's Wrappings" -> "shavronnes-wrappings" */
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** "Shavronne's Wrappings" -> "Shavronnes_Wrappings" (poedb page names) */
const poedbPage = (name) => name.replace(/['’]/g, '').replace(/\s+/g, '_');

const existing = new Set([...terms.matchAll(/^- \{ name: ([^,]+),/gm)].map((m) => m[1].trim().toLowerCase()));
const added = [];
const skipped = [];

for (const name of names) {
  if (existing.has(name.toLowerCase())) {
    skipped.push(name);
    continue;
  }
  const id = slug(name);
  if (!manifest[id]) manifest[id] = { poedb: poedbPage(name) };
  added.push(`- { name: ${name.includes(':') || name.includes("'") ? `"${name.replace(/"/g, '\\"')}"` : name}, kind: ${kind}, image: ${id} }`);
  existing.add(name.toLowerCase());
}

if (added.length) {
  writeFileSync(termsPath, `${terms.trimEnd()}\n${added.join('\n')}\n`);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(`added ${added.length}, already present ${skipped.length}`);
if (added.length) console.log(added.join('\n'));
if (skipped.length) console.log(`skipped: ${skipped.join(', ')}`);
if (added.length) console.log('\nnow run: npm run images');
