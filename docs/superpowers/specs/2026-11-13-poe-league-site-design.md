# PoE 3.30 "Covens of Umbra" community site — design

Date: 2026-11-13
Status: awaiting approval

## Intent

A community fan site that helps players get through the Path of Exile 3.30
league, Covens of Umbra (launched 2026-11-13). It answers three questions a
player has at league start:

1. **What changed, and what does it mean for how I play?** (Changelog)
2. **What should I play, and why does that build work?** (Builds)
3. **What do I do right now in the campaign?** (Leveling)

Readers range from first-league newbies to veterans. Every page must read
"general first, detail on demand": a veteran skims the top layer, a newbie
clicks into popups and expandable sections. The site is English first, with
Vietnamese added in a later phase for readers with weak English.

## Goals

- Three main tabs: Changelog, Builds, Leveling.
- Changelog: a rewritten article of the official 3.30.0 patch notes in three
  sections (Big changes, Small changes, What's new), every change carrying an
  "Impact" popup that explains the effect on playstyle, items, mechanics and
  previously popular builds. Real game images next to each change.
- Builds: 10–12 league starters and several high-budget endgame builds. Each
  explains the core mechanic, the mandatory items and combinations, and the
  progression from level 1 to endgame.
- Leveling: level 1 through Act 10 and the first three Labyrinths, as flow
  charts and tabbed sections with quest impact (must do, optional, skip) and
  rewards.
- Fast, lightweight, smooth. Dark and light themes. EN/VI language toggle.
- Each article has its own shareable, search-friendly URL.
- Git commits from the first step.

## Non-goals

**Page weight (owner's decision, 2026-11-13):** the earlier "under 50 KB of
JavaScript per page" budget is lifted. Quality comes before size: rich
imagery and real animation are wanted, and pages may be much larger. The
page must still feel fast, so images stay lazy-loaded and compressed, and
nothing blocks the first paint.

- No backend, accounts, comments, or database.
- No in-site passive tree renderer or Path of Building importer. Link out to
  PoB codes and tree planners instead.
- No trade or price integration.
- No Ruthless-specific guides. Ruthless patch-note changes are summarised in
  one Small-changes entry.
- No Vietnamese content in this phase. Only the structure for it.
- No publishing in this phase. The output stays host-agnostic.

## Anti-goals (these would make it a failure even if it works)

- An "AI look": gradients, glassmorphism, glowing blobs, emoji as icons.
- Checklist-style leveling steps (a tick-box per step).
- Patch notes pasted as a wall of text, or impacts that just restate the note.
- Guide text copied from other sites. Research is synthesised and sources are
  linked.
- Presenting day-one theory as proven fact.
- Hotlinked images that can break, or heavy JavaScript.

## Constraints and facts found

- Official notes: https://www.pathofexile.com/forum/view-thread/4013680
  (downloadable; about 700 lines of changes across 20 sections).
- 3.30 is an endgame-heavy patch: Scarabs removed and replaced by Threads,
  Atlas tree fully reworked, item generation reworked, Incursion/Atziri and
  Harvest reworked, Mirage made core. Character balance changes are light
  (6 skill gems, 2 supports, 4 ascendancies), so most 3.29 starters carry over.
- GGG's image CDN (web.poecdn.com) serves item and gem icons. poewiki blocks
  automated access.
- The machine has git and winget, but no Node.js. The owner approved
  installing Node.js LTS.
- The assistant cannot watch videos. Build research uses written guides,
  Reddit, forum threads, and video titles and descriptions.

## Approaches

| | A. Astro static site | B. Hand-written HTML/CSS/JS | C. React single-page app |
|---|---|---|---|
| Setup | Install Node.js | Nothing | Install Node.js |
| Pages | Content files compiled to finished HTML | Duplicated by hand, or assembled in the browser from JSON | Assembled in the browser |
| Reader speed | Near-zero JavaScript | Spinners if browser-assembled | Heaviest |
| Sharing and search | Real page per article | Weak if browser-assembled | Weak |
| Two languages | Built-in locale routes | Hand-rolled | Library needed |

**Picked: A (Astro), by the owner on 2026-11-13.** With 15+ long articles in
two languages, B becomes copy-paste or a slow client-rendered site, and C is
heavier and worse for a reading site. The cost of A is one Node.js install.

## Design

### Stack (assistant's calls)

- Astro (current stable), static output, TypeScript, no UI framework.
- Interactivity in small vanilla scripts: native `<dialog>` for impact popups,
  `<details>` for expandable depth, a tab controller for leveling.
- Astro view transitions for smooth page changes.
- Fonts self-hosted through Fontsource. No requests to third-party servers at
  runtime.
- Content validated by schemas (Astro content collections with zod), so a
  malformed entry fails the build instead of rendering broken.

### Site map

```
/                             redirects to /en/3.30/
/en/                          redirects to the current league, /en/3.30/
/en/3.30/                     home: league summary, launch facts, entry cards
/en/3.30/changelog/           the changelog article
/en/3.30/builds/              build index (starters, endgame)
/en/3.30/builds/<slug>/       one build article
/en/3.30/leveling/            overview: whole-campaign flow, how to use it
/en/3.30/leveling/act-1/ …    one page per act (act-1 to act-10)
/en/3.30/leveling/labs/       the first three Labyrinths
/vi/3.30/…                    same tree, filled in a later phase
```

Act pages are separate URLs but presented as tabs: the tab bar is shared and
view transitions make switching feel instant.

**The site is reused each league (owner's decision).** The league version is
part of every URL and content lives in one folder per league. When 3.31
arrives, a new folder is added, `/en/` points to it, and 3.30 stays online as
an archive so shared links keep working. A league switcher appears in the
header once a second league exists. Nothing in layout or components may
hard-code "3.30" or "Covens of Umbra"; both come from a league config.

### Layout sketch

```
┌──────────────────────────────────────────────────────────────┐
│ Covens of Umbra 3.30   Changelog  Builds  Leveling   EN|VI ◐ │
├──────────────────────────────────────────────────────────────┤
│ CHANGELOG                                                    │
│ [Big changes] [Small changes] [What's new]   filter: Atlas ▾ │
│                                                              │
│ ┌────┐ Scarabs are gone. Threads replace them.     REWORK    │
│ │icon│ You now add league mechanics to a map with            │
│ └────┘ Threads, up to eight per map...                       │
│        Impact ▸   Official text ▸                            │
│ ──────────────────────────────────────────────────────────── │
│ ┌────┐ League mechanics no longer spawn randomly   REMOVED   │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
        clicking "Impact" opens:
        ┌───────────────────────────────────────┐
        │ Impact: Scarabs → Threads           ✕ │
        │ What it means for you   …             │
        │ Who gains / who loses   …             │
        │ Builds and items affected …           │
        │ What to do at league start …          │
        │ Confidence: confirmed | prediction    │
        └───────────────────────────────────────┘
```

### Changelog

- One entry per meaningful change, grouped where the official notes list many
  lines for one idea (for example, all "Item Quantity removed" lines are one
  entry).
- Entry data: id, section (`big`, `small`, `new`), category (Endgame, Atlas,
  Loot, League mechanics, Items, Skills, Ascendancy, Mercenaries, Quality of
  life), title, verdict tag (Buff, Nerf, Rework, New, Removed), plain-language
  summary, image, impact (what it means, who gains and loses, builds and items
  affected, what to do, confidence), and the official text it is based on.
- Section order on the page: Big changes, Small changes, What's new, as the
  owner specified. A sticky section bar and a category filter sit on top.
- Bug fixes and microtransaction notes are folded into one collapsed entry.
- Each impact states whether it is confirmed by the notes or a prediction.

### Builds

- Index page: cards split into League starters and Endgame, each showing
  class, main skill icon, budget, playstyle tags, and a "last verified" date.
- Article structure, top to bottom:
  1. Header: name, ascendancy, tags, budget, ratings (clear, bossing,
     survivability, ease), last verified date, confidence label.
  2. The idea in 60 seconds: three or four sentences.
  3. How it works: a small diagram of the mechanic chain (skill → how damage
     scales → how it survives).
  4. Mandatory pieces: items, gems and keystones with icons. Each has an
     expandable "why this is mandatory".
  5. Progression timeline: Acts 1–3, Acts 4–10, early maps, red maps, endgame.
     Each stage says what you use, what changes, and the trigger to move on.
     Newbie-level detail sits in expandables.
  6. What 3.30 changed for this build, linking to changelog entries.
  7. Strengths, weaknesses, who should not play it.
  8. Sources: guides, PoB links, threads, videos.
- **Builds target softcore trade league (owner's decision).** Each article
  carries a short note on whether it also works in SSF and in Hardcore.
- Budget is a relative tier with a rough range, since there is no price feed:
  Starter (playable on self-found and a few Chaos Orbs), Low (under about
  5 Divine), Medium (5–50 Divine), High (50–300 Divine), Extreme (mirror-tier
  gear). Ranges are marked as estimates in a day-one economy. (Assistant's
  call.)
- Before writing builds 2 onward, the assistant proposes the full roster to
  the owner for approval. (Assistant's call.)
- Game terms are rendered with the game's own colours (unique, gem, currency)
  and an icon chip.
- The first build is chosen after research as the starter with the strongest
  community consensus for 3.30. The assistant names it and the reason before
  writing.

### Leveling

- An overview page shows the whole campaign as one horizontal flow: acts,
  level ranges, the three labs, and where skill points and key gems come from.
- Each act page has:
  - an "at a glance" strip: level in and out, skill points available, boss,
    key rewards;
  - a route flow chart drawn in HTML and SVG: zones as nodes in travel order,
    with side branches for optional quests. Nodes are tagged Must, Worth it,
    or Skip;
  - clicking a node opens a panel with the quest, the reward, the reason for
    the tag, boss tips, and newbie notes;
  - short prose sections for boss fights and gear and gem checkpoints.
- **One shared route for all classes (owner's decision).** Where a quest
  reward differs by class, the node panel shows a small per-class table.
  Skill setups for a specific build belong in that build's article, not here.
- No tick-boxes. Position in the guide comes from the URL and the tab bar.
- Labs page: when to run each of the three labs, level and resistance targets,
  trial locations, Izaro basics.
- 3.30 campaign changes are called out where they apply (Wildwood in Act 7,
  Mirage in Act 9, Scrolls of Wisdom for gold, Item Tiers from Act 6).

### Visual design (assistant's calls, reviewed in the first slice)

- Flat colour, thin borders, small corner radii, no gradients or shadows
  heavier than a hairline.
- Dark theme: near-black neutral background, blue-purple buttons and links.
- Light theme: warm off-white background, strong blue buttons and links.
- Theme follows the system setting by default, the toggle overrides it, and
  the choice is remembered. An inline script applies it before paint so there
  is no flash.
- A serif display face for headings and a neutral sans for body text.
- Motion: view transitions between pages, popups that ease in under 200 ms,
  and all of it disabled under `prefers-reduced-motion`.
- Loading: a thin progress bar at the top during navigation, and placeholder
  boxes behind images. A static site has no other async work, so there are no
  decorative spinners.
- Works at phone width.

### Images

- Source: GGG's CDN and the official site, plus poedb where the CDN lacks an
  asset. Downloaded into the repo, converted to WebP, lazy-loaded.
- A manifest records the source URL of every image.
- Changes with no icon of their own (the Atlas rework, item generation) use
  the closest real game asset: a related item or currency icon, or official
  announcement art. No drawn or generated stand-ins. The owner can supply
  in-game screenshots later and they slot into the same manifest.
  (Assistant's call.)
- The footer carries a fan-site notice: not affiliated with or endorsed by
  Grinding Gear Games; game content and images belong to Grinding Gear Games.

### Languages

- Routes under `/en/` and `/vi/`. Interface strings in one file per language.
  Content in one folder per language.
- The toggle goes to the same page in the other language. If a Vietnamese page
  does not exist yet, it shows the English page with a notice.
- Vietnamese rule for the later phase: game terms (item names, mechanics,
  skills, common community words) stay in English.

### Honesty about sources

- Every build article and every predicted impact carries a confidence label
  and a "last verified" date.
- Sources are linked. Nothing is quoted at length.
- The owner reviews reading flow and visuals, not game accuracy. So every
  mechanical claim is checked against the official notes or two independent
  sources before it is written as confirmed; anything else is labelled a
  prediction. (Assistant's call.)
- Third-party guides get details wrong. Example found during research: one
  3.30 guide applied a Ruthless-only Chieftain nerf to the normal game. The
  official notes win every conflict.

### Keeping it current (assistant's call)

All content is plain data and text files, one per entry or article. Hotfix
notes and meta shifts are handled by editing those files on the owner's
request and bumping the "last verified" date. There is no automated update
job in this phase.

## Delivery

Phase 1 is the review slice. Later phases start after the owner approves the
reading flow.

1. **Foundation:** install Node.js, scaffold Astro, themes, layout, navigation,
   language structure, popup and expandable components, image pipeline.
2. **Changelog:** the full article.
3. **Build 1:** one league starter.
4. **Leveling slice:** overview and Acts 1–2.
   → owner review
5. Remaining starters and endgame builds; Acts 3–10 and labs.
6. Vietnamese.
7. Publish to a free static host (Cloudflare Pages or GitHub Pages).

## Checks

- The build fails on invalid content or type errors.
- Internal links resolve.
- Each page is checked in a browser in both themes at desktop and phone width.
- Page weight target: under 50 KB of JavaScript per page, images lazy-loaded.

## Left to the builder

- Exact fonts, colour values, and spacing scale.
- File layout inside the Astro project.
- How changes are grouped into entries, and which entries count as Big.
- The flow chart's drawing technique.
