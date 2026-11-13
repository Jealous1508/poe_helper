// Attaches icons to game terms that do not have one yet.
//
// Writers add terms without icons, because several of them work in parallel
// and the image manifest is a single shared file. This script does the icon
// pass centrally, afterwards, in two phases:
//
//   node scripts/attach-icons.mjs plan  3.30
//       For every term with no `image:`, queue an icon from that name's
//       poedb page and point the term at it.
//   npm run images
//       Downloads whatever it can. Some names have no poedb page.
//   node scripts/attach-icons.mjs prune 3.30
//       Removes the `image:` from terms whose icon did not arrive, and
//       drops the dead manifest entries. A term without an icon renders
//       as plain coloured text, which is fine.
//
// Both phases are safe to re-run.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [phase, league = '3.30'] = process.argv.slice(2);
if (phase !== 'plan' && phase !== 'prune') {
  console.error('usage: node scripts/attach-icons.mjs <plan|prune> [league]');
  process.exit(2);
}

const TERMS_DIR = 'src/content/terms';
const MANIFEST = 'src/data/images.json';

const termFiles = readdirSync(TERMS_DIR)
  .filter((f) => f === `${league}.yaml` || (f.startsWith(`${league}.`) && f.endsWith('.yaml')))
  .map((f) => join(TERMS_DIR, f));

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

/** "Shavronne's Wrappings" -> "shavronnes-wrappings" */
const slug = (name) =>
  name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** "Shavronne's Wrappings" -> "Shavronnes_Wrappings" */
const page = (name) => name.replace(/['’]/g, '').replace(/\s+/g, '_');

// Terms are one-per-line flow mappings, so a line edit is enough and keeps
// the files readable in a diff.
const TERM_LINE = /^(\s*-\s*\{\s*name:\s*)("?)(.+?)\2(\s*,\s*kind:\s*[a-z]+)(\s*,\s*image:\s*([a-z0-9-]+))?(\s*\})\s*$/;

let planned = 0;
let pruned = 0;
let dropped = 0;

for (const file of termFiles) {
  const text = readFileSync(file, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  let changed = false;

  for (let i = 0; i < lines.length; i += 1) {
    const m = TERM_LINE.exec(lines[i]);
    if (!m) continue;
    const [, head, quote, name, kindPart, , imageId, tail] = m;

    if (phase === 'plan') {
      if (imageId) continue;
      const id = slug(name);
      if (!id) continue;
      if (!manifest[id]) manifest[id] = { poedb: page(name) };
      lines[i] = `${head}${quote}${name}${quote}${kindPart}, image: ${id}${tail}`;
      changed = true;
      planned += 1;
    } else {
      if (!imageId) continue;
      const entry = manifest[imageId];
      const onDisk = entry?.file && existsSync(join('public', entry.file));
      if (onDisk) continue;
      lines[i] = `${head}${quote}${name}${quote}${kindPart}${tail}`;
      changed = true;
      pruned += 1;
    }
  }

  if (changed) writeFileSync(file, lines.join(eol));
}

if (phase === 'prune') {
  // An entry nothing downloaded is dead weight, and the images test fails on it.
  for (const [id, entry] of Object.entries(manifest)) {
    if (!entry.file || !existsSync(join('public', entry.file))) {
      delete manifest[id];
      dropped += 1;
    }
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

if (phase === 'plan') {
  console.log(`queued icons for ${planned} terms across ${termFiles.length} file(s)`);
  if (planned) console.log('now run: npm run images   (then: node scripts/attach-icons.mjs prune)');
} else {
  console.log(`removed ${pruned} icon reference(s) that did not download, dropped ${dropped} manifest entr(ies)`);
}
