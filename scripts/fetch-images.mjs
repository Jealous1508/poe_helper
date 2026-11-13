// Downloads every image in src/data/images.json that is not on disk yet,
// converts it to WebP and records its size. Safe to re-run.
//
// A manifest entry names where the picture comes from, one of:
//   "<id>": { "trade": "Exact Item Name" }   official trade-site icon (currency, fragments, essences, ...)
//   "<id>": { "poedb": "Page_Name" }         icon looked up on that poedb.tw page (gems, uniques, new items)
//   "<id>": { "source": "https://..." }      direct image URL
// Optional: "league": "3.30" (folder, defaults to "shared"), "maxWidth": 1600, "credit": "..."
// The script fills in "source", "file", "width" and "height".
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

let tradeIcons;
async function iconFromTrade(name) {
  if (!tradeIcons) {
    const data = await (await get('https://www.pathofexile.com/api/trade/data/static')).json();
    tradeIcons = new Map();
    for (const group of data.result) {
      for (const entry of group.entries) if (entry.image) tradeIcons.set(entry.text.toLowerCase(), entry.image);
    }
  }
  const path = tradeIcons.get(name.toLowerCase());
  if (!path) throw new Error(`"${name}" is not in the official trade data`);
  return path.startsWith('http') ? path : `https://web.poecdn.com${path}`;
}

async function iconFromPoedb(page) {
  const html = await (await get(`https://poedb.tw/us/${page}`)).text();
  const decode = (url) => url.replaceAll('&amp;', '&');
  // Brand-new items are shown with the official promo picture.
  const promo = html.match(/<img[^>]+src="(https:\/\/[^"]+\/promo\/[^"]*\/items\/[^"]+)"/);
  if (promo) return decode(promo[1]);
  // The page's share image is the item icon when it points into 2DItems.
  const og = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (og && og[1].includes('/2DItems/')) return og[1];
  const inline = html.match(/<img[^>]+src="(https:\/\/[^"]+\/2DItems\/(?!Effects\/)[^"]+)"/);
  if (inline) return decode(inline[1]);
  if (og) return og[1];
  throw new Error(`no icon found on poedb page "${page}"`);
}

let done = 0;
for (const [id, entry] of Object.entries(manifest)) {
  const file = entry.file ?? `img/${entry.league ?? 'shared'}/${id}.webp`;
  const target = join('public', file);
  // Already done: on disk, and measured (images) or marked as a video.
  const complete = entry.video ? Boolean(entry.bytes) : Boolean(entry.width && entry.height);
  if (entry.file && existsSync(target) && complete) continue;
  try {
    if (!entry.source) {
      if (entry.trade) entry.source = await iconFromTrade(entry.trade);
      else if (entry.poedb) {
        entry.source = await iconFromPoedb(entry.poedb);
        await sleep(250);
      } else throw new Error('entry needs "trade", "poedb" or "source"');
    }
    const input = Buffer.from(await (await get(entry.source)).arrayBuffer());
    if (entry.video) {
      // Videos are stored as they come: no conversion, no dimensions probe.
      const target = join('public', entry.file ?? `video/${entry.league ?? 'shared'}/${id}.webm`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, input);
      entry.file = (entry.file ?? `video/${entry.league ?? 'shared'}/${id}.webm`);
      entry.bytes = input.length;
      done += 1;
      console.log(`ok   ${id}  video  ${(input.length / 1024).toFixed(0)} KB`);
      continue;
    }
    let pipeline = sharp(input);
    if (entry.maxWidth) pipeline = pipeline.resize({ width: entry.maxWidth, withoutEnlargement: true });
    const { data, info } = await pipeline.webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, data);
    Object.assign(entry, { file, width: info.width, height: info.height });
    done += 1;
    console.log(`ok   ${id}  ${info.width}x${info.height}  ${(data.length / 1024).toFixed(1)} KB  ${entry.source.split('/').pop().split('?')[0]}`);
    await sleep(120);
  } catch (error) {
    failures.push(`${id}: ${error.message}`);
    console.log(`FAIL ${id}: ${error.message}`);
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${done} downloaded, ${failures.length} failed, ${Object.keys(manifest).length} total`);
if (failures.length) process.exit(1);
