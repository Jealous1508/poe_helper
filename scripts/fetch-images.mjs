// Downloads every image in src/data/images.json that is not on disk yet,
// converts it to WebP and records its size. Safe to re-run.
//
// Manifest entry:  "<id>": { "source": "<image url>" }
//             or:  "<id>": { "poedb": "<poedb.tw page name>" }   (icon is looked up on that page)
// Optional:        "league": "3.30" (folder, defaults to "shared"), "maxWidth": 1600, "credit": "..."
// The script fills in "source" (for poedb entries), "file", "width" and "height".
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const MANIFEST = 'src/data/images.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const failures = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

async function iconFromPoedb(page) {
  const html = await (await get(`https://poedb.tw/us/${page}`)).text();
  const og = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (og) return og[1];
  const img = html.match(/<img[^>]+src="(https:\/\/[^"]+(?:\/2DItems\/|\/promo\/[^"]*\/items\/)[^"]+)"/);
  if (img) return img[1].replaceAll('&amp;', '&');
  throw new Error(`no icon found on poedb page "${page}"`);
}

let done = 0;
for (const [id, entry] of Object.entries(manifest)) {
  const file = entry.file ?? `img/${entry.league ?? 'shared'}/${id}.webp`;
  const target = join('public', file);
  if (entry.file && existsSync(target) && entry.width) continue;
  try {
    if (!entry.source) {
      if (!entry.poedb) throw new Error('entry has neither "source" nor "poedb"');
      entry.source = await iconFromPoedb(entry.poedb);
      await sleep(250);
    }
    const input = Buffer.from(await (await get(entry.source)).arrayBuffer());
    let pipeline = sharp(input);
    if (entry.maxWidth) pipeline = pipeline.resize({ width: entry.maxWidth, withoutEnlargement: true });
    const { data, info } = await pipeline.webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    Object.assign(entry, { file, width: info.width, height: info.height });
    done += 1;
    console.log(`ok   ${id}  ${info.width}x${info.height}  ${(data.length / 1024).toFixed(1)} KB`);
    await sleep(150);
  } catch (error) {
    failures.push(`${id}: ${error.message}`);
    console.log(`FAIL ${id}: ${error.message}`);
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${done} downloaded, ${failures.length} failed, ${Object.keys(manifest).length} total`);
if (failures.length) process.exit(1);
