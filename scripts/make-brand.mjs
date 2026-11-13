// Builds the icons and the social share card.
//
// Run it when the mark in public/favicon.svg or the league art changes:
//   node scripts/make-brand.mjs
//
// The output is committed, because the text is rendered with whatever fonts
// the machine has and a build server has different ones. Generating it here
// and checking it in means the card looks the same wherever the site is
// deployed from.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const LEAGUE = '3.30';
const ART = `public/img/${LEAGUE}/league-grim-fate.webp`;
const W = 1200;
const H = 630;

/** The bottom band that carries the words. Flat, not a gradient: a hard
 *  edge is a decision, a fade over a photo is a smudge. */
const BAND_H = 214;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * `font` is a Pango font description — family, style, then point size, as in
 * "Georgia Bold 60". At 96 dpi a point lands close enough to a pixel that
 * the numbers below mean what they look like.
 */
async function text({ content, font, colour, letterSpacing = 0, width }) {
  const spacing = letterSpacing ? ` letter_spacing="${letterSpacing * 1024}"` : '';
  const markup = `<span foreground="${colour}"${spacing}>${esc(content)}</span>`;
  return sharp({ text: { text: markup, font, dpi: 96, rgba: true, width } }).png().toBuffer();
}

async function shareCard() {
  // A share card is looked at for about a second, often as a thumbnail, so
  // the art is pushed a little: more saturation and contrast than the
  // original, because the dimming that keeps the words readable also flattens
  // everything behind them.
  const art = await sharp(ART)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .modulate({ saturation: 1.18 })
    .linear(1.12, -8)
    .toBuffer();

  // Darken the whole picture rather than only the part under the words: the
  // art stays legible, and nothing about the card looks like a fade.
  const dimmed = await sharp(art)
    .composite([{ input: { create: { width: W, height: H, channels: 4, background: { r: 8, g: 9, b: 12, alpha: 0.3 } } } }])
    .toBuffer();

  const band = {
    create: { width: W, height: BAND_H, channels: 4, background: { r: 14, g: 15, b: 19, alpha: 0.93 } },
  };
  const rule = {
    create: { width: W, height: 3, channels: 4, background: { r: 131, g: 114, b: 245, alpha: 1 } },
  };

  const eyebrow = await text({ content: 'PATH OF EXILE', font: 'Segoe UI Semibold 15', colour: '#b6b2f2', letterSpacing: 5, width: 700 });
  const title = await text({ content: 'Covens of Umbra 3.30', font: 'Georgia Bold 58', colour: '#ffffff', width: 1090 });
  const sub = await text({ content: 'Changelog  ·  Builds  ·  Leveling', font: 'Segoe UI 25', colour: '#cfd2e4', width: 900 });

  const titleMeta = await sharp(title).metadata();
  const subMeta = await sharp(sub).metadata();

  await sharp(dimmed)
    .composite([
      { input: band, top: H - BAND_H, left: 0 },
      { input: rule, top: H - BAND_H, left: 0 },
      { input: eyebrow, top: 44, left: 56 },
      { input: title, top: H - BAND_H + 44, left: 56 },
      { input: sub, top: H - BAND_H + 54 + (titleMeta.height ?? 70), left: 58 },
    ])
    .jpeg({ quality: 86, chromaSubsampling: '4:4:4' })
    // JPEG, not WebP: several of the places people paste a link still do not
    // fetch a WebP preview, and a card nobody sees is worse than a bigger file.
    .toFile('public/share.jpg');

  const out = await sharp('public/share.jpg').metadata();
  console.log(`share.jpg ${out.width}x${out.height}, title ${titleMeta.width}x${titleMeta.height}, sub ${subMeta.width}x${subMeta.height}`);
}

async function icons() {
  const svg = readFileSync('public/favicon.svg');
  for (const size of [32, 180, 512]) {
    const name = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}.png`;
    await sharp(svg, { density: 384 }).resize(size, size).png().toFile(`public/${name}`);
    console.log(`${name} ${size}x${size}`);
  }
  // favicon.ico for the browsers and crawlers that still ask for it by name.
  const ico = await sharp(svg, { density: 384 }).resize(48, 48).png().toBuffer();
  writeFileSync('public/favicon.ico', ico);
  console.log('favicon.ico 48x48 (png payload)');
}

await icons();
await shareCard();
