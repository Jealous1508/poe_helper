# Path of Exile league guide

A fan-made guide site for Path of Exile leagues. The current league is 3.30,
Covens of Umbra. Three sections: **Changelog**, **Builds** and **Leveling**.

The site is static: it builds to plain HTML and runs on any free host.

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:4321.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with live reload |
| `npm run build` | Builds the site into `dist/` |
| `npm run preview` | Serves the built site |
| `npm run check` | TypeScript and Astro diagnostics |
| `npm test` | Unit tests |
| `npm run images` | Downloads any images missing from the manifest |
| `npm run check:links` | Checks every internal link in `dist/` |
| `npm run verify` | check + test + build + link check. Run this before committing. |

## Where the content lives

All content is YAML under `src/content/`, one folder per league and language:

```
src/content/
  changelog/3.30/en/{meta,big,small,new}.yaml   one file per section
  builds/3.30/en/<slug>.yaml                    one file per build
  leveling/3.30/en/{overview,act-1,act-2}.yaml  one file per act
  home/3.30/en/home.yaml
  terms/3.30.yaml                               the game-term registry
```

Nothing in `src/pages`, `src/layouts` or `src/components` mentions a league by
name. The league list is `src/config/leagues.ts`; add an entry there and a
content folder beside the existing one to start the next league. Old leagues
keep working at their own URLs.

### Writing text

Long fields accept Markdown plus `[[Game Term]]`, which renders the term in
the game's colour with its icon. Every term must exist in
`src/content/terms/3.30.yaml`, otherwise the build fails and names the file
and the term. Use `[[Toxic Rain|the skill]]` to show different text.

### Adding an image

1. Add an entry to `src/data/images.json`:
   - `{ "trade": "Exact Item Name" }` for currency and fragments, taken from
     the official trade data.
   - `{ "poedb": "Page_Name" }` for gems, uniques and new items.
   - `{ "source": "https://..." }` for a direct URL.
   - Add `"league": "3.30"` to file it under that league, and `"video": true`
     for a video.
2. Run `npm run images`. It downloads, converts to WebP and records the size.
3. Reference the id from content or a component.

The manifest records the source URL of every file, and a test fails if an
entry has no file on disk.

## Conventions worth keeping

- **Say where a claim comes from.** Changelog entries carry the official
  lines they are based on and a confidence label. Build articles list their
  sources. Where sources disagree, the text says so.
- **The official patch notes win** over any third-party guide.
- No gradients, no emoji as icons.
- Dark and light themes both have to look right, and the theme must not flash
  on load.
- Everything readable at 375 px wide, with no horizontal page scroll.
- The site works without JavaScript: the leveling panels are all in the HTML,
  and the impact popups use the native Popover API.

## Not affiliated with Grinding Gear Games

This is a fan site. Path of Exile content, item names and images belong to
Grinding Gear Games.
