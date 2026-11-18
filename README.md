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
| `npm run brand` | Rebuilds the icons and the link preview card |
| `npm run verify` | All of the above. Run this before committing. |

## Where the content lives

All content is YAML under `src/content/`, one folder per league and language:

```
src/content/
  changelog/3.30/en/{meta,big,small,new}.yaml   one file per section
  builds/3.30/en/<slug>.yaml                    one file per build
  leveling/3.30/en/{overview,act-1,act-2}.yaml  one file per act
  updates/3.30/en/<date>-<slug>.yaml            one file per official post since launch
  crafting/3.30/en/{overview,<category>}.yaml   the crafting guide: shared basics, one file per item category
  craft-examples/3.30/en/<category>--<slug>.yaml  one worked craft per file
  home/3.30/en/home.yaml
  terms/3.30.yaml                               the game-term registry
```

Nothing in `src/pages`, `src/layouts` or `src/components` mentions a league by
name. The league list is `src/config/leagues.ts`; add an entry there and a
content folder beside the existing one to start the next league. Old leagues
keep working at their own URLs.

### Adding an update

The Updates tab is everything Grinding Gear Games has shipped or announced
since launch. When a new hotfix, patch or developer post appears:

1. Copy the closest existing file in `src/content/updates/3.30/en/` to
   `<yyyy-mm-dd>-<slug>.yaml`, using the date the official forum shows. If
   there is already a post that day, give the new one the next `order`.
2. Set `kind` (`hotfix`, `patch` or `announcement`) and `status`. `live` means
   it is in the game. `announced` means the developers have only said so; give
   it an `eta` in their words. A developer post stays `announced` even after
   the patch lands: add the patch as its own file and point the post's lines
   at it with `followUp: <id of the new file>`.
3. Rewrite the changes as `points`, each tagged by how it lands on a player
   (`buff`, `nerf`, `rework`, `new`, `fix`, `info`). A monster that hits less
   hard is a `buff`. Group a long post with `sections`.
4. List the changelog entries (`entries`) and build guides (`builds`) it
   touches. They get a "Since launch" link back to the update automatically,
   and a name that does not exist fails the build.
5. Write the same file under `vi/`. A test compares the two and fails if the
   facts differ.

The home page shows the newest three on its own. Nothing else needs editing.

### The crafting guide

The Item Crafting Guide is two things that are checked against each other.

**Data**, generated, never edited by hand: `src/data/crafting/<category>.json`
holds every base item of a category and every modifier it can roll, tier by
tier, with item levels and weights. It comes from the public game-data export
(RePoE) and is rebuilt with:

```bash
node scripts/build-crafting-data.mjs --icons
```

The raw export is cached in `.cache/repoe` (not committed). Delete that folder
first to pick up a new patch. `--icons` downloads any base icon that is
missing into `public/img/bases`. `--digest <folder>` also writes a readable
Markdown summary per category, which is what you want open while writing.

**Writing**, in YAML, in both languages: `crafting/<league>/<locale>/overview.yaml`
is the shared "How crafting works" page (the anatomy of an item, the toolbox,
Memory Strands). `crafting/<league>/<locale>/<category>.yaml` is one category
guide, and each `craft-examples/<league>/<locale>/<category>--<slug>.yaml` is
one worked craft, with the item drawn after every step. The schema, with a
comment on every field, is `src/lib/crafting.ts`.

The build refuses writing that the data contradicts: a base that is not in
the category, a modifier pool that does not exist, a tool the overview does
not define. Tests also check that every pool of a category is explained, that
the two languages state the same facts, and that item snapshots never exceed
the slots an item has.

For any chance you quote, use the calculator, which reads the same weights:

```bash
node scripts/craft-odds.mjs two-hand-maces --ilvl 83 --fossil "Jagged Fossil"
```

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

### Cloudflare Pages

This is how the site is deployed. Connect the repository in the Cloudflare
dashboard and use:

| Setting | Value |
|---|---|
| Framework preset | Astro (or None — it changes nothing here) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | none |

Node comes from `.nvmrc`, which pins 22. Without it Cloudflare picks an
older default and the build fails on syntax the toolchain expects to work.

Cloudflare rebuilds on every push to `master`. To run the full checks there
rather than only the build, set the build command to `npm run verify`; it
adds about a minute and turns a broken link or an unknown game term into a
failed deploy instead of a broken page.

### Anywhere else

The build is plain files in `dist/`, so any static host will serve it. Two
settings decide the URLs, both read from the environment at build time:

| Variable | Example | What it is |
|---|---|---|
| `SITE_URL` | `https://poe-helper.pages.dev` | The origin. Feeds Astro's `site`; nothing renders it yet, so it only matters once something needs absolute URLs, such as a sitemap |
| `BASE_PATH` | `/poe-guide/` | The sub-path. Leave it unset at a domain root |

`.github/workflows/deploy.yml` builds and publishes to **GitHub Pages**, and
is set to run only when you start it from the Actions tab — on a push it
would duplicate the Cloudflare build. To use it, first turn Pages on under
Settings → Pages → Source: *GitHub Actions*. The workflow cannot do that
for itself: creating a Pages site needs a token with admin rights, and the
one Actions provides does not have them. It runs `npm run verify` before
publishing, and fills both variables in from the Pages configuration.

Images are committed to the repo, so no host needs network access to
poedb or the trade API at build time.

## Icons and the link preview

`public/favicon.svg` is the mark — a waypoint, since the site is a route
through the campaign. `npm run brand` renders it to the PNG sizes and the
`.ico`, and builds `public/share.jpg`, the 1200×630 card that chat apps and
social sites show when someone pastes a link.

The card is generated, not hand-made: league art from `public/img/<league>/`,
darkened, with the league name on a flat band. Run `npm run brand` after
changing the mark or moving to a new league, and **commit the output** — the
text is drawn with the fonts on the machine that runs it, so generating it
on a build server would quietly change how it looks.

A preview is fetched by someone else's server, so the tags in
`src/layouts/Base.astro` use absolute URLs built from Astro's `site`. That
is why `site` defaults to the deployed origin rather than localhost. The
card is a JPEG on purpose: several popular chat apps still do not fetch a
WebP preview, and a card nobody sees is worse than a slightly bigger file.

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
