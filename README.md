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
| `npm run check:markup` | Catches `**bold**` or `[[Term]]` that reached a page unrendered |
| `npm run verify` | All of the above. Run this before committing. |

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
the game's colour with its icon. Every term must exist in the registry,
otherwise the build fails and names the file and the term. Use
`[[Toxic Rain|the skill]]` to show different text.

The registry is `src/content/terms/3.30.yaml` plus any
`src/content/terms/3.30.<name>.yaml` shard beside it; they are merged, and a
name defined twice fails the build naming both files. Shards exist so that
several people writing different articles at the same time do not have to
edit one large file.

### Icons for new terms

A writer adds terms without an `image:`, because the image manifest is a
single shared file. The icons are attached afterwards, in one pass:

```bash
node scripts/attach-icons.mjs plan && npm run images && node scripts/attach-icons.mjs prune
```

`plan` points every icon-less term at a poedb icon, `npm run images`
downloads what exists, and `prune` removes the references that did not
arrive. Plenty of names have no poedb page; those terms render as plain
coloured text, which is fine. Both phases are safe to re-run.

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

## Publishing

The build is plain files in `dist/`, so any free static host will serve it.
Two settings decide the URLs, both read from the environment at build time:

| Variable | Example | What it is |
|---|---|---|
| `SITE_URL` | `https://you.github.io` | The origin, used for absolute URLs |
| `BASE_PATH` | `/poe-guide/` | The sub-path, or `/` at a domain root |

`.github/workflows/deploy.yml` publishes to **GitHub Pages** on every push
to `master`. Turn it on once under Settings → Pages → Source: *GitHub
Actions*; it fills both variables in itself. The workflow runs
`npm run verify` first, so a broken link or an unknown game term fails the
build instead of reaching the site.

For Cloudflare Pages or Netlify instead: build command `npm run build`,
output directory `dist`, and set `SITE_URL` to the domain they give you.
Leave `BASE_PATH` unset — both serve at the root.

Images are committed to the repo, so no host needs network access to
poedb or the trade API at build time.

## The donate button

`src/config/site.ts` holds it. `donate.momo` is the MoMo number shown with
a copy button; `donate.url` is there if you ever add a link-based option
such as Ko-fi. Set either, both or neither — the note shows whatever is
there. The button lives beside the site name in the header and as one line
in the footer, and it never interrupts reading.

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
