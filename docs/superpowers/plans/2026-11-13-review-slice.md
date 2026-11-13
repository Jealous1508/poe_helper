# PoE League Site — Review Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship phase 1 of the design: the site shell with themes and language structure, the full 3.30 changelog, one league starter build (Toxic Rain Pathfinder), and the leveling overview with Acts 1–2.

**Architecture:** Astro static site. All content is YAML under `src/content/<kind>/<league>/<locale>/`, loaded and validated by zod in `src/lib/`. Long text fields are "rich text": Markdown plus `[[Game Term]]` tokens resolved against a term registry at build time. Interactivity uses the native Popover API and `<details>`; scripts exist only for theme, language, filter and the navigation progress bar.

**Tech Stack:** Node.js LTS, Astro (current stable), TypeScript strict, zod, `yaml`, `marked`, `sharp`, vitest, Fontsource.

**Spec:** `docs/superpowers/specs/2026-11-13-poe-league-site-design.md`

## Global Constraints

- No gradients, glassmorphism, glow, or emoji icons anywhere in the UI.
- No UI framework (no React/Vue/Svelte). **Page-size budget lifted by the owner on 2026-11-13: quality over size.** Rich imagery and animation are wanted; keep images lazy-loaded and nothing blocking first paint.
- No runtime requests to third-party hosts: fonts and images are served from the site.
- Fonts must cover Vietnamese: headings Source Serif 4, body Be Vietnam Pro (Fontsource, variable where available).
- Nothing in `src/layouts`, `src/components` or `src/pages` may contain the literal `3.30` or `Covens of Umbra`; both come from `src/config/leagues.ts`.
- Every internal link is built with `pagePath()` so the Astro `base` setting can change at publish time.
- Dark theme: near-black neutral background, blue-purple accent. Light theme: warm off-white background, strong blue accent.
- All motion is disabled under `prefers-reduced-motion: reduce`.
- Leveling has no checkboxes.
- Official patch notes win any conflict with a third-party source. A claim is "confirmed" only if the official notes or two independent sources support it; otherwise it is labelled a prediction.
- No text copied from other guides beyond one short attributed quote.
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. A `[[Term]]` in content that is not in the registry → the build fails naming the file and the term (Task 3 test).
2. A content entry references an image id missing from the manifest, or a manifest file missing on disk → the build fails naming it (Task 4 test).
3. A Vietnamese URL whose content does not exist yet → the page renders the English content with a visible notice, not a 404 (Task 2 test for `resolveLocale`, Task 10 link check covers `/vi/` pages).
4. `localStorage` unavailable or JavaScript disabled → page renders in the system theme, impact popups still open (Popover API needs no script), nothing is hidden behind script (Task 5 browser check with JS off).
5. Phone width (375 px) with long item names and wide flow charts → no horizontal page scroll (Task 10 browser check on every page type).

---

## File Structure

```
astro.config.mjs              site, base, redirects for / and /en/
src/config/leagues.ts         league list and currentLeague
src/i18n/{index.ts,en.json,vi.json}
src/lib/rich.ts               renderRich(): Markdown + [[Term]] → HTML
src/lib/terms.ts              term registry loader
src/lib/images.ts             image manifest lookup
src/lib/content.ts            loadYaml helpers + locale fallback
src/lib/changelog.ts          schema + getChangelog()
src/lib/builds.ts             schema + getBuilds(), getBuild()
src/lib/leveling.ts           schema + getActs(), getAct()
src/content/terms/<league>.yaml
src/content/changelog/<league>/<locale>/{big,small,new}.yaml
src/content/builds/<league>/<locale>/<slug>.yaml
src/content/leveling/<league>/<locale>/{overview,act-1,act-2}.yaml
src/data/images.json          manifest: id → { file, source, width, height }
public/img/<league>/…         downloaded WebP images
scripts/fetch-images.mjs      download + convert + write dimensions
scripts/check-links.mjs       verify internal links in dist/
src/styles/{tokens.css,base.css}
src/layouts/Base.astro
src/components/{Header,Footer,ThemeToggle,LangToggle,ProgressBar,Tag,
                GameImage,Rich,Popup,Detail}.astro
src/components/changelog/{Entry,SectionBar}.astro
src/components/builds/{BuildCard,Ratings,Chain,Mandatory,Stages}.astro
src/components/leveling/{ActTabs,Glance,RouteFlow,NodePanel,CampaignFlow}.astro
src/pages/[locale]/[league]/index.astro
src/pages/[locale]/[league]/changelog.astro
src/pages/[locale]/[league]/builds/{index,[slug]}.astro
src/pages/[locale]/[league]/leveling/{index,[act]}.astro
tests/*.test.ts
.claude/launch.json           dev server for the preview pane
```

---

### Task 1: Toolchain and scaffold

**Files:** Create `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `.claude/launch.json`, `src/pages/index.astro` (temporary), `vitest.config.ts`.

**Produces:** npm scripts `dev`, `build`, `check` (`astro check`), `test` (`vitest run`), `images` (`node scripts/fetch-images.mjs`), `check:links`, and `verify` = `check && test && build && check:links`.

- [ ] Install Node.js LTS: `winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements`. Verify `node -v` prints v22 or newer in a fresh shell.
- [ ] Scaffold Astro minimal template with strict TypeScript into the repo root (keep `docs/`). Add `@astrojs/check`, `typescript`, `vitest`, `zod`, `yaml`, `marked`, `sharp`, `@fontsource-variable/source-serif-4`, `@fontsource-variable/be-vietnam-pro` (fall back to the static `@fontsource/be-vietnam-pro` if no variable package exists).
- [ ] `.gitignore`: `node_modules`, `dist`, `.astro`. `.claude/launch.json`: configuration `site`, `npm run dev`, port 4321.
- [ ] Run `npm run build`. Expected: exit 0 and `dist/index.html` exists.
- [ ] Commit: `chore: scaffold Astro project`.

### Task 2: League config, locales, routing helpers

**Files:** Create `src/config/leagues.ts`, `src/i18n/index.ts`, `src/i18n/en.json`, `src/i18n/vi.json`, `src/lib/content.ts`, `tests/i18n.test.ts`, `tests/content.test.ts`. Modify `astro.config.mjs` (redirects).

**Produces:**
```ts
// leagues.ts
export interface League { id: string; name: string; launchDate: string; patchNotesUrl: string; officialUrl: string }
export const leagues: League[]          // [{ id: '3.30', name: 'Covens of Umbra', launchDate: '2026-11-13', … }]
export const currentLeague: League
// i18n/index.ts
export const locales = ['en', 'vi'] as const
export type Locale = (typeof locales)[number]
export function t(locale: Locale, key: string): string            // falls back to en, then to the key
export function pagePath(locale: Locale, league: string, ...segments: string[]): string  // base-aware, trailing slash
export function switchLocalePath(pathname: string, target: Locale): string
// content.ts
export function resolveLocale<T>(byLocale: Partial<Record<Locale, T>>, wanted: Locale): { data: T; locale: Locale; isFallback: boolean }
export function loadYamlDir(kind: string, league: string): Partial<Record<Locale, Record<string, unknown>>>  // file stem → parsed YAML, via import.meta.glob raw
```

- [ ] Write failing tests:
```ts
expect(pagePath('en', '3.30', 'builds', 'toxic-rain-pathfinder')).toBe('/en/3.30/builds/toxic-rain-pathfinder/')
expect(pagePath('vi', '3.30')).toBe('/vi/3.30/')
expect(switchLocalePath('/en/3.30/leveling/act-1/', 'vi')).toBe('/vi/3.30/leveling/act-1/')
expect(t('vi', 'nav.builds')).toBe(t('en', 'nav.builds'))   // while vi.json is empty
expect(t('en', 'no.such.key')).toBe('no.such.key')
expect(resolveLocale({ en: 1 }, 'vi')).toEqual({ data: 1, locale: 'en', isFallback: true })
expect(resolveLocale({ en: 1, vi: 2 }, 'vi')).toEqual({ data: 2, locale: 'vi', isFallback: false })
expect(() => resolveLocale({}, 'en')).toThrow()
```
- [ ] Run `npm test`. Expected: FAIL (modules missing).
- [ ] Implement. `vi.json` is `{}` in this phase. Redirects: `/` → `/en/<current>/`, `/en/` and `/vi/` → their current league.
- [ ] Run `npm test`. Expected: PASS.
- [ ] Commit: `feat: league config and locale routing helpers`.

### Task 3: Term registry and rich text

**Files:** Create `src/lib/terms.ts`, `src/lib/rich.ts`, `src/content/terms/3.30.yaml`, `src/components/Rich.astro`, `tests/rich.test.ts`.

**Produces:**
```ts
export type TermKind = 'gem' | 'support' | 'unique' | 'currency' | 'item' | 'keystone' | 'notable' | 'mechanic' | 'npc' | 'zone'
export interface Term { name: string; kind: TermKind; image?: string }   // image = manifest id
export function getTerms(league: string): Map<string, Term>               // keyed by lower-cased name
export function renderRich(text: string, terms: Map<string, Term>, where: string): string
```
`[[Name]]` renders `<span class="term term--<kind>">` with an inline icon when the term has an image. `[[Name|shown text]]` overrides the label. `<Rich text league where />` wraps `renderRich` and outputs with `set:html`.

- [ ] Write failing tests:
```ts
const terms = new Map([['toxic rain', { name: 'Toxic Rain', kind: 'gem' }]])
expect(renderRich('Use [[Toxic Rain]] early.', terms, 'x')).toContain('<span class="term term--gem">Toxic Rain</span>')
expect(renderRich('[[toxic rain|TR]]', terms, 'x')).toContain('>TR</span>')
expect(renderRich('**bold** and [link](https://a.b)', terms, 'x')).toMatch(/<strong>bold<\/strong>.*<a href="https:\/\/a\.b"/s)
expect(() => renderRich('[[Nope]]', terms, 'builds/x.yaml')).toThrow(/builds\/x\.yaml.*Nope/)
expect(renderRich('<script>x</script>', terms, 'x')).not.toContain('<script>')
```
- [ ] Run `npm test`. Expected: FAIL.
- [ ] Implement with `marked`; escape raw HTML in source text; external links get `rel="noopener" target="_blank"`.
- [ ] Run `npm test`. Expected: PASS.
- [ ] Commit: `feat: term registry and rich text renderer`.

### Task 4: Image manifest and fetch script

**Files:** Create `src/data/images.json`, `scripts/fetch-images.mjs`, `src/lib/images.ts`, `src/components/GameImage.astro`, `tests/images.test.ts`.

**Produces:**
```ts
export interface ImageInfo { file: string; source: string; width: number; height: number; credit?: string }
export function getImage(id: string, where: string): ImageInfo   // throws naming `where` and `id` if absent
```
`<GameImage id size? alt />` renders `<img loading="lazy" decoding="async" width height>` inside a fixed-size placeholder box so layout never shifts.

- [ ] Write failing tests: `getImage('missing-id', 'changelog/big.yaml')` throws matching `/changelog\/big\.yaml.*missing-id/`; a second test reads `src/data/images.json` and asserts every `file` exists under `public/`.
- [ ] Run `npm test`. Expected: FAIL.
- [ ] Implement `scripts/fetch-images.mjs`: for each manifest entry without a file on disk, download `source` with a browser User-Agent, convert to WebP with `sharp`, write to `public/img/<league>/<id>.webp`, store width and height back into the manifest. Skips entries already present. Exits non-zero listing any download that failed.
- [ ] Seed the manifest with three entries (league key art, one currency icon, one gem icon), run `npm run images`, then `npm test`. Expected: PASS and three WebP files on disk.
- [ ] Commit: `feat: image manifest and fetch pipeline`.

### Task 5: Design tokens, layout, theme and language toggles

**Files:** Create `src/styles/tokens.css`, `src/styles/base.css`, `src/layouts/Base.astro`, `src/components/{Header,Footer,ThemeToggle,LangToggle,ProgressBar,Tag,Popup,Detail}.astro`, `src/pages/[locale]/[league]/index.astro`. Delete the temporary `src/pages/index.astro`.

**Produces:**
- `Base.astro` props: `{ locale: Locale; league: League; title: string; description: string; section?: 'changelog' | 'builds' | 'leveling'; isFallback?: boolean }`. Renders header, optional fallback notice (`t(locale, 'notice.fallback')`), slot, footer with the fan-site notice.
- `Popup.astro` props `{ id: string; title: string }`, default slot = body. Renders `<div popover id>`; openers elsewhere use `<button popovertarget={id}>`.
- `Detail.astro` props `{ summary: string }`, slot = body. A styled `<details>`.
- `Tag.astro` props `{ kind: string; label: string }`.
- Theme: `data-theme="dark|light"` on `<html>`, set by an inline head script from `localStorage['theme']` or the system preference, wrapped in try/catch. Tokens defined on `:root`, overridden under `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`.
- View transitions via Astro's `ClientRouter`; `ProgressBar` shows a 2 px bar between `astro:before-preparation` and `astro:page-load`.

- [ ] Build tokens, base styles and the components above. Home page shows league name, launch date, links to the official pages, and three entry cards built with `pagePath`.
- [ ] `getStaticPaths` for `[locale]/[league]` returns every locale × league pair.
- [ ] Run `npm run check && npm run build`. Expected: exit 0; `dist/en/3.30/index.html` and `dist/vi/3.30/index.html` exist; `dist/index.html` redirects.
- [ ] Browser check on the dev server: toggle theme (persists across reload, no flash), switch language (vi shows the fallback notice), open a sample Popup with JavaScript disabled, view at 375 px. Screenshot dark and light.
- [ ] Grep check: `rg -n "3\.30|Covens of Umbra" src/layouts src/components src/pages` returns nothing.
- [ ] Commit: `feat: site shell with themes and language toggle`.

### Task 6: Changelog schema and page

**Files:** Create `src/lib/changelog.ts`, `src/components/changelog/{Entry,SectionBar}.astro`, `src/pages/[locale]/[league]/changelog.astro`, `src/content/changelog/3.30/en/{big,small,new}.yaml` (two sample entries each), `tests/changelog.test.ts`.

**Produces:**
```ts
export const categories = ['league', 'endgame', 'atlas', 'loot', 'mechanics', 'items', 'crafting', 'skills', 'ascendancy', 'mercenaries', 'campaign', 'qol'] as const
export const verdicts = ['buff', 'nerf', 'rework', 'new', 'removed', 'mixed'] as const
export interface ChangelogEntry {
  id: string; section: 'big' | 'small' | 'new'; category: (typeof categories)[number]
  verdict: (typeof verdicts)[number]; title: string; summary: string; image: string
  impact: { meaning: string; winners?: string; losers?: string; affected?: string; todo?: string; confidence: 'confirmed' | 'prediction' }
  official: string[]
}
export function getChangelog(league: string, locale: Locale): { entries: ChangelogEntry[]; isFallback: boolean }
```
The section comes from the file name; entry order is file order. Ids are unique across the three files.

- [ ] Write failing tests: schema rejects an entry without `impact.meaning`; rejects duplicate ids across files; `getChangelog('3.30', 'vi').isFallback` is `true`; every entry's `image` resolves through `getImage`.
- [ ] Run `npm test`. Expected: FAIL.
- [ ] Implement loader and page. Page order: Big changes, Small changes, What's new. Sticky `SectionBar` with three anchors and a category filter (`<select>` or chip row; one small script that toggles `hidden` on entries and updates counts). Each `Entry` shows image, title, verdict `Tag`, summary, an underlined "Impact" button opening its `Popup`, and an "Official text" `Detail`. `#<entry id>` deep links scroll to the entry.
- [ ] Run `npm run verify` (link check may be a stub until Task 10). Expected: PASS.
- [ ] Browser check both themes and 375 px; open an impact popup; filter by a category.
- [ ] Commit: `feat: changelog page with impact popups`.

### Task 7: Changelog content

**Files:** Modify `src/content/changelog/3.30/en/{big,small,new}.yaml`, `src/content/terms/3.30.yaml`, `src/data/images.json`.

- [ ] Source of truth: the official thread (URL in `leagues.ts`). Cover every section of the notes. Group related lines into one entry; fold bug fixes and microtransactions into one collapsed Small entry; fold Ruthless into one Small entry.
- [ ] Section assignment. **New:** league mechanic (Fates, Wickerman, Viscera), Threads as an item type, Item Tiers, new skills, new uniques and jewel base, new currencies (Royal Visage, Soul Cores, Divine Vessel as currency, Essence of Trickery), new meta-crafts, challenges. **Big:** Scarabs removed, league mechanics no longer spawn randomly, Atlas tree rework, Shaped Regions and Astrolabes, item generation and Rarity, Quantity replaced by Atlas Drops, fractured item sources removed, Incursion and Atziri, Harvest, Mirage core, Delirium Orbs, Beyond, Betrayal rewards, Bestiary, Gwennen, Orb of Chance economy, Mercenary nerfs, map pool rotation, Heist and Delve leaving the map drop pool. **Small:** everything else.
- [ ] Each impact: what it means in play, who gains and loses, affected builds or items, what to do at league start, and a confidence label. Read community reaction (Reddit, forum replies, news coverage) for the Big entries before writing them.
- [ ] Add one image per entry to the manifest (item, gem or currency icon from GGG's CDN or official art) and run `npm run images`.
- [ ] Run `npm run verify`. Expected: PASS, no unknown terms, no missing images.
- [ ] Browser read-through of the whole page in both themes.
- [ ] Commit: `content: 3.30 changelog`.

### Task 8: Build schema, index and article template

**Files:** Create `src/lib/builds.ts`, `src/components/builds/{BuildCard,Ratings,Chain,Mandatory,Stages}.astro`, `src/pages/[locale]/[league]/builds/{index,[slug]}.astro`, `tests/builds.test.ts`.

**Produces:**
```ts
export interface Build {
  slug: string; name: string; class: string; ascendancy: string
  role: 'starter' | 'endgame'; budget: 'starter' | 'low' | 'medium' | 'high' | 'extreme'
  mainSkill: string; image: string; tags: string[]
  ratings: { clear: number; bossing: number; survivability: number; ease: number }   // 1–5
  verified: string; confidence: 'proven' | 'predicted' | 'mixed'
  modes: { ssf: string; hardcore: string }
  idea: string
  chain: { label: string; text: string }[]
  mandatory: { term: string; why: string; detail?: string }[]
  stages: { id: string; title: string; levels: string; uses: string; changes: string; moveOn: string; details: { title: string; body: string }[] }[]
  patch: { entry?: string; note: string }[]      // entry = changelog id
  strengths: string[]; weaknesses: string[]; avoidIf: string
  sources: { title: string; url: string; kind: 'guide' | 'pob' | 'video' | 'thread' | 'official' }[]
}
export function getBuilds(league: string, locale: Locale): { builds: Build[]; isFallback: boolean }
export function getBuild(league: string, locale: Locale, slug: string): { build: Build; isFallback: boolean }
```

- [ ] Write failing tests: ratings outside 1–5 rejected; `patch[].entry` that is not a changelog id rejected; `mandatory[].term` not in the registry rejected; slug equals file stem.
- [ ] Run `npm test`. Expected: FAIL.
- [ ] Implement loader, index (Starters and Endgame groups) and the article template in the order the spec lists: header, idea, chain diagram, mandatory pieces, stage timeline, patch changes, strengths and weaknesses, sources. The chain is a row of boxes joined by arrows (wraps to a column on phones). Stages are a vertical timeline, each stage open by default with its `details` collapsed.
- [ ] Run `npm run verify`. Expected: PASS with one fixture build.
- [ ] Commit: `feat: build index and article template`.

### Task 9: Toxic Rain Pathfinder article

**Files:** Create `src/content/builds/3.30/en/toxic-rain-pathfinder.yaml`. Modify terms and image manifest. Remove the fixture build.

- [ ] Research at least four independent current sources (a major guide site, a PoB or build archive, Reddit or forum discussion, and the 3.30 notes for Pathfinder: Master Surgeon, Master Alchemist, Master Distiller). Record every source in `sources`.
- [ ] Write every field. Stages: Acts 1–3, Acts 4–10, early maps, red maps, endgame. Mandatory pieces explain why the build fails without each one. `patch` links the Pathfinder changelog entry and any loot or Atlas change that affects gearing.
- [ ] Label anything not confirmed by two sources or the notes as a prediction inside the text, and set `confidence` accordingly.
- [ ] Run `npm run verify`; browser read-through in both themes and at 375 px.
- [ ] Commit: `content: Toxic Rain Pathfinder league starter`.

### Task 10: Leveling schema, overview, act pages, Acts 1–2 content

**Files:** Create `src/lib/leveling.ts`, `src/components/leveling/{ActTabs,Glance,RouteFlow,NodePanel,CampaignFlow}.astro`, `src/pages/[locale]/[league]/leveling/{index,[act]}.astro`, `src/content/leveling/3.30/en/{overview,act-1,act-2}.yaml`, `scripts/check-links.mjs`, `tests/leveling.test.ts`.

**Produces:**
```ts
export interface RouteNode {
  id: string; name: string; kind: 'town' | 'zone' | 'boss' | 'side'
  tag: 'travel' | 'must' | 'worth' | 'skip'
  branchFrom?: string; waypoint?: boolean; summary: string
  quest?: string; reward?: string; why?: string; tips?: string; newbie?: string
  classRewards?: { class: string; reward: string }[]; image?: string
}
export interface Act {
  slug: string; title: string; levelIn: number; levelOut: number; skillPoints: number
  boss: string; keyRewards: string[]; intro: string
  nodes: RouteNode[]; sections: { title: string; body: string }[]; patchNotes: string[]
}
export interface Overview { intro: string; stops: { slug: string; label: string; levels: string; note: string; kind: 'act' | 'lab'; available: boolean }[]; principles: { title: string; body: string }[] }
export function getActs(league: string, locale: Locale): { acts: Act[]; isFallback: boolean }
export function getOverview(league: string, locale: Locale): { overview: Overview; isFallback: boolean }
```

- [ ] Write failing tests: `branchFrom` must name an earlier node; a `side` node requires `branchFrom`; node ids unique per act; `levelOut > levelIn`.
- [ ] Run `npm test`. Expected: FAIL.
- [ ] Implement. `CampaignFlow`: horizontal strip of all ten acts and three labs with level ranges; stops whose content is not written yet render as non-links marked "coming". `ActTabs`: links to act pages, current act highlighted. `RouteFlow`: main route as a vertical spine of zone nodes with connectors, side branches offset to the side and joined to their `branchFrom` node, tag shown by colour and label. Selecting a node shows `NodePanel` beside the flow on desktop and as a `Popup` on phones; the first node is selected by default and all panel content is in the HTML. No checkboxes.
- [ ] Write Act 1 and Act 2 content from the official wiki-level facts, cross-checked against two leveling guides. Tags follow reward value: skill points and required progression are Must, strong optional rewards are Worth it, the rest Skip with the reason.
- [ ] Implement `scripts/check-links.mjs`: every internal `href` and `src` in `dist/**/*.html` resolves to a file in `dist/`; exits non-zero listing failures.
- [ ] Run `npm run verify`. Expected: PASS, including `/vi/` pages.
- [ ] Browser check: both themes, 375 px on every page type (no horizontal page scroll), JavaScript size under 50 KB per page from the network panel.
- [ ] Commit: `feat: leveling guide with Acts 1-2`.

### Task 11: Final review pass

- [ ] Dispatch one fresh reviewer over the whole branch against the spec and the Review Focus list. Fix what it finds.
- [ ] Run `npm run verify`. Expected: PASS.
- [ ] Commit fixes. Report to the owner with the dev server open for review.
