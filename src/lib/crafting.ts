import { z } from 'zod';
import type { Locale } from '../i18n';
import { getChangelogIds } from './changelog';
import { loadYamlDir, resolveFiles, type YamlFile } from './content';
import index from '../data/crafting/index.json';

/**
 * The Item Crafting Guide.
 *
 * Two kinds of thing meet here. The *data* (every base item and every
 * modifier it can roll) is generated from the public game-data export by
 * `scripts/build-crafting-data.mjs` and lives in `src/data/crafting/`. The
 * *writing* (how to think about a category, and worked examples) is YAML in
 * `src/content/crafting/` and `src/content/craft-examples/`, in both
 * languages. The writing is checked against the data: a guide cannot
 * recommend a base that does not exist.
 */

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const craftGroups = ['armour', 'jewellery', 'one-hand', 'two-hand', 'jewel', 'flask'] as const;
export type CraftGroup = (typeof craftGroups)[number];

export interface CraftBase {
  id: string;
  name: string;
  class: string;
  dropLevel: number;
  req: Record<string, number>;
  stats: Record<string, number | number[]>;
  implicits: string[];
  size: [number, number];
  tags: string[];
  pool: string;
  icon?: { file: string; width: number; height: number };
}
export interface CraftTier {
  tier?: number;
  name: string;
  ilvl: number;
  text: string[];
  /** One number when every pool agrees, otherwise the weight per pool. */
  weight: number | Record<string, number>;
  essenceOnly?: boolean;
}
export interface CraftFamily {
  key: string;
  group: string;
  label: string;
  tags: string[];
  /** Pools that can roll it; absent means all of them. */
  on?: string[];
  tiers: CraftTier[];
}
export interface CraftData {
  id: string;
  group: CraftGroup;
  classes: string[];
  pools: { id: string; tags: string[]; bases: number }[];
  bases: CraftBase[];
  prefix: CraftFamily[];
  suffix: CraftFamily[];
  influence: { id: string; prefix: CraftFamily[]; suffix: CraftFamily[] }[];
  delve: { prefix: CraftFamily[]; suffix: CraftFamily[] };
  eldritch: { exarch: CraftFamily[]; eater: CraftFamily[] };
  corrupted: CraftFamily[];
  essences: { essence: string; class: string; tiers: { name: string; level: number; capsOtherModsAt?: number; affix: string; text: string[]; corruptionOnly?: boolean }[] }[];
  bench: { key: string; group: string; affix: string; label: string; master: string; classes?: string[]; tiers: { rank: number; text: string[]; cost: { currency: string; n: number }[] }[] }[];
  veiled: { key: string; group: string; affix: string; label: string; tiers: { name: string; ilvl: number; text: string[] }[] }[];
  /**
   * Cluster jewels only. Their notables depend on the jewel's enchantment,
   * not on its base, so they are listed here with a weight per enchantment.
   */
  cluster?: {
    sizes: { base: string; size: string; minSkills: number; maxSkills: number }[];
    enchants: { tag: string; name: string; text: string[]; sizes: string[] }[];
    mods: { text: string[]; notable?: string; ilvl: number; affix: 'prefix' | 'suffix'; group: string; weights: Record<string, number> }[];
  };
}

const dataFiles = import.meta.glob<CraftData>('/src/data/crafting/*.json', { import: 'default', eager: true });

/** Every category the data knows, in display order. */
export const craftCategories = index as { id: string; group: CraftGroup; classes: string[]; bases: number; pools: number; prefixes: number; suffixes: number }[];

export function getCraftData(category: string): CraftData {
  const data = dataFiles[`/src/data/crafting/${category}.json`];
  if (!data) throw new Error(`crafting: no data for category "${category}". Run "node scripts/build-crafting-data.mjs".`);
  return data;
}

/** Weight of one tier in one pool; 0 when that pool cannot roll it. */
export function tierWeight(family: CraftFamily, tier: CraftTier, pool: string): number {
  if (family.on && !family.on.includes(pool)) return 0;
  return typeof tier.weight === 'number' ? tier.weight : (tier.weight[pool] ?? 0);
}

/**
 * How much of one side's total weight a modifier family takes in a pool, at
 * an item level. This is the chance that a single random prefix (or suffix)
 * is from this family, before anything else is on the item.
 */
export function familyShare(families: CraftFamily[], family: CraftFamily, pool: string, ilvl = 100): number {
  const sum = (f: CraftFamily) => f.tiers.reduce((s, tier) => s + (tier.ilvl <= ilvl ? tierWeight(f, tier, pool) : 0), 0);
  const total = families.reduce((s, f) => s + sum(f), 0);
  return total === 0 ? 0 : sum(family) / total;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** How something got onto the item. Decides the colour of an affix line. */
export const affixSources = ['rolled', 'crafted', 'essence', 'fractured', 'veiled', 'influence', 'fossil', 'harvest', 'beast', 'eldritch', 'corrupted'] as const;
export type AffixSource = (typeof affixSources)[number];

/** Difficulty of an example, 1 (first craft ever) to 5 (mirror-tier thinking). */
export const craftLevels = [1, 2, 3, 4, 5] as const;

const rich = z.string().min(1);
const source = z
  .object({
    title: z.string().min(1),
    url: z.string().regex(/^https?:\/\//, 'must be an http(s) link'),
    kind: z.enum(['guide', 'video', 'thread', 'official', 'data']),
    note: z.string().optional(),
  })
  .strict();

const affix = z.object({ text: z.string().min(1), how: z.enum(affixSources).default('rolled') }).strict();
/** A snapshot of an item: what sits in its three prefix and three suffix slots. */
const itemState = z
  .object({
    rarity: z.enum(['normal', 'magic', 'rare']).default('rare'),
    /** e.g. "Shaper", "Fractured", "Searing Exarch and Eater of Worlds". */
    note: z.string().optional(),
    implicits: z.array(z.string().min(1)).default([]),
    prefixes: z.array(affix).default([]),
    suffixes: z.array(affix).default([]),
  })
  .strict();
export type ItemState = z.infer<typeof itemState>;

const overviewSchema = z
  .object({
    intro: rich,
    /** What counts as a permanent tool, and what this guide leaves out. */
    scope: rich,
    /** How an item is built: the ideas every category guide relies on. */
    anatomy: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), title: z.string().min(1), text: rich }).strict()).min(1),
    /** The toolbox. Category guides and examples refer to these by id. */
    methods: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]+$/),
            name: z.string().min(1),
            /** 1 = you will use it on day one, 5 = endgame only. */
            level: z.number().int().min(1).max(5),
            summary: z.string().min(1),
            text: rich,
            /** Image manifest ids of the currency involved. */
            icons: z.array(z.string().min(1)).default([]),
            /** What it is the right tool for, and what it is not. */
            good: rich,
            bad: rich.optional(),
          })
          .strict(),
      )
      .min(1),
    memoryStrands: z.object({ summary: rich, text: rich, rules: z.array(rich).min(1), advice: rich }).strict(),
    /** What this patch changed for crafters. `entry` is a changelog id. */
    patch: z.array(z.object({ entry: z.string().optional(), note: rich }).strict()),
    glossary: z.array(z.object({ term: z.string().min(1), text: rich }).strict()),
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sources: z.array(source).min(1),
  })
  .strict();
export type CraftOverview = z.infer<typeof overviewSchema> & { where: string };

const keyMod = z.object({ mod: z.string().min(1), why: rich, aim: z.string().optional() }).strict();
const guideSchema = z
  .object({
    name: z.string().min(1),
    /** One line for the category card. */
    short: z.string().min(1),
    /** Name of the base whose icon stands for the category. */
    icon: z.string().min(1),
    intro: rich,
    basics: z
      .object({
        itemLevel: z
          .object({
            text: rich,
            /** The item levels that matter, lowest first. */
            breakpoints: z.array(z.object({ ilvl: z.number().int().min(1).max(100), unlocks: rich }).strict()).min(1),
          })
          .strict(),
        bases: z
          .object({
            text: rich,
            /** The kinds of base in this category and what each is for. */
            types: z.array(z.object({ title: z.string().min(1), pools: z.array(z.string()).default([]), text: rich }).strict()).min(1),
            /** Bases worth crafting on. `base` is a base name from the data. */
            picks: z.array(z.object({ base: z.string().min(1), for: z.string().min(1), why: rich }).strict()).min(1),
            /** What the choice of base decides before any currency is spent. */
            impact: rich,
          })
          .strict(),
      })
      .strict(),
    /** The tools that matter for this category, with what is particular here. */
    tools: z.array(z.object({ method: z.string().min(1), note: rich }).strict()).min(1),
    memoryStrands: rich,
    reading: z
      .object({
        intro: rich,
        prefixes: z.object({ text: rich, key: z.array(keyMod).min(1) }).strict(),
        suffixes: z.object({ text: rich, key: z.array(keyMod).min(1) }).strict(),
      })
      .strict(),
    approach: z
      .object({
        principle: rich,
        /** The order to work in, as a route. */
        order: z.array(z.object({ title: z.string().min(1), text: rich }).strict()).min(2),
        finishing: rich,
        stopping: rich,
      })
      .strict(),
    /** Modifiers that do not come from plain rolling, and where they do come from. */
    special: z.array(z.object({ mod: z.string().min(1), source: z.string().min(1), where: rich }).strict()).min(1),
    mistakes: z.array(rich).min(1),
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sources: z.array(source).min(1),
  })
  .strict();
export type CraftGuide = z.infer<typeof guideSchema> & { id: string; group: CraftGroup; where: string; isFallback?: boolean };

const exampleSchema = z
  .object({
    category: z.string().min(1),
    title: z.string().min(1),
    level: z.number().int().min(1).max(5),
    /** One line for the card. */
    summary: z.string().min(1),
    goal: rich,
    /** Base name from the data, and the item level the craft needs. */
    base: z.string().min(1),
    itemLevel: z.number().int().min(1).max(100),
    /** Why that item level and that base, in a sentence or two. */
    baseWhy: rich,
    methods: z.array(z.string().min(1)).min(1),
    /** The finished item. */
    result: itemState,
    /** What to have in the stash before starting. Amounts are rough. */
    needs: z.array(z.object({ item: z.string().min(1), amount: z.string().min(1), note: z.string().optional() }).strict()).min(1),
    /** How expensive and how reliable, in words. No prices: they move. */
    cost: rich,
    odds: rich,
    steps: z
      .array(
        z
          .object({
            title: z.string().min(1),
            do: rich,
            why: rich,
            /** What to look for before moving on. */
            check: rich.optional(),
            /** What to do when the step goes wrong. */
            fail: rich.optional(),
            /** The item after this step. */
            state: itemState.optional(),
          })
          .strict(),
      )
      .min(2),
    variations: rich.optional(),
    mistakes: z.array(rich).default([]),
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sources: z.array(source).min(1),
  })
  .strict();
export type CraftExample = z.infer<typeof exampleSchema> & { slug: string; where: string; isFallback?: boolean };

function fail(file: YamlFile, error: z.ZodError): never {
  const issue = error.issues[0];
  throw new Error(`${file.where}: field "${issue.path.join('.')}": ${issue.message}`);
}

const baseNames = (category: string) => new Set(getCraftData(category).bases.map((base) => base.name));

export function parseOverview(file: YamlFile, changelogIds: Set<string>): CraftOverview {
  const parsed = overviewSchema.safeParse(file.data);
  if (!parsed.success) fail(file, parsed.error);
  const ids = parsed.data.methods.map((m) => m.id);
  const twice = ids.find((id, i) => ids.indexOf(id) !== i);
  if (twice) throw new Error(`${file.where}: method "${twice}" is defined twice`);
  for (const change of parsed.data.patch) {
    if (change.entry && !changelogIds.has(change.entry)) throw new Error(`${file.where}: links to changelog entry "${change.entry}", which does not exist`);
  }
  return { ...parsed.data, where: file.where };
}

export function parseGuide(id: string, file: YamlFile, methodIds: Set<string>): CraftGuide {
  const meta = craftCategories.find((category) => category.id === id);
  if (!meta) throw new Error(`${file.where}: "${id}" is not a crafting category`);
  const parsed = guideSchema.safeParse(file.data);
  if (!parsed.success) fail(file, parsed.error);
  const guide = parsed.data;
  const data = getCraftData(id);
  const names = baseNames(id);
  const pools = new Set(data.pools.map((pool) => pool.id));
  if (!names.has(guide.icon)) throw new Error(`${file.where}: icon "${guide.icon}" is not a base in this category`);
  for (const pick of guide.basics.bases.picks) {
    if (!names.has(pick.base)) throw new Error(`${file.where}: recommends the base "${pick.base}", which is not in this category`);
  }
  for (const type of guide.basics.bases.types) {
    for (const pool of type.pools) if (!pools.has(pool)) throw new Error(`${file.where}: base type "${type.title}" names pool "${pool}", which does not exist`);
  }
  for (const tool of guide.tools) {
    if (!methodIds.has(tool.method)) throw new Error(`${file.where}: uses method "${tool.method}", which the overview does not define`);
  }
  return { ...guide, id, group: meta.group, where: file.where };
}

export function parseExample(stem: string, file: YamlFile, methodIds: Set<string>): CraftExample {
  const match = /^([a-z0-9-]+)--([a-z0-9-]+)$/.exec(stem);
  if (!match) throw new Error(`${file.where}: an example file is named <category>--<slug>.yaml`);
  const parsed = exampleSchema.safeParse(file.data);
  if (!parsed.success) fail(file, parsed.error);
  const example = parsed.data;
  if (example.category !== match[1]) throw new Error(`${file.where}: the file name says ${match[1]} but the category field says ${example.category}`);
  if (!craftCategories.some((category) => category.id === example.category)) throw new Error(`${file.where}: "${example.category}" is not a crafting category`);
  if (!baseNames(example.category).has(example.base)) throw new Error(`${file.where}: the base "${example.base}" is not in ${example.category}`);
  for (const method of example.methods) {
    if (!methodIds.has(method)) throw new Error(`${file.where}: uses method "${method}", which the overview does not define`);
  }
  // Three prefixes and three suffixes is the rule for equipment; jewels and
  // flasks hold fewer, and the guide for those says so in words.
  for (const state of [example.result, ...example.steps.map((step) => step.state)]) {
    if (state && (state.prefixes.length > 3 || state.suffixes.length > 3)) throw new Error(`${file.where}: an item cannot have more than 3 prefixes or 3 suffixes`);
  }
  return { ...example, slug: match[2], where: file.where };
}

interface Loaded {
  overview: CraftOverview;
  overviewIsFallback: boolean;
  guides: CraftGuide[];
  examples: CraftExample[];
}
const cache = new Map<string, Loaded | undefined>();

/** Everything written for one league in one language; undefined if nothing is. */
export function getCrafting(league: string, locale: Locale): Loaded | undefined {
  const key = `${league}:${locale}`;
  if (cache.has(key)) return cache.get(key);
  const byLocale = loadYamlDir('crafting', league);
  if (!byLocale.en?.overview) {
    cache.set(key, undefined);
    return undefined;
  }
  const { files, fellBack } = resolveFiles(byLocale, locale);
  const overview = parseOverview(files.overview, getChangelogIds(league));
  const methodIds = new Set(overview.methods.map((method) => method.id));
  const order = new Map(craftCategories.map((category, i) => [category.id, i]));
  const guides = Object.entries(files)
    .filter(([stem]) => stem !== 'overview')
    .map(([stem, file]) => ({ ...parseGuide(stem, file, methodIds), isFallback: fellBack.has(stem) }))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);

  const exampleFiles = loadYamlDir('craft-examples', league);
  const examples: CraftExample[] = [];
  if (exampleFiles.en) {
    const resolved = resolveFiles(exampleFiles, locale);
    for (const [stem, file] of Object.entries(resolved.files)) {
      const example = { ...parseExample(stem, file, methodIds), isFallback: resolved.fellBack.has(stem) };
      if (!guides.some((guide) => guide.id === example.category)) throw new Error(`${file.where}: there is no guide for the category "${example.category}" yet`);
      examples.push(example);
    }
  }
  examples.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
  const loaded = { overview, overviewIsFallback: fellBack.has('overview'), guides, examples };
  cache.set(key, loaded);
  return loaded;
}

/** The examples of one category, easiest first. */
export function examplesOf(loaded: Loaded, category: string): CraftExample[] {
  return loaded.examples.filter((example) => example.category === category);
}

const STANDARD_POOLS = ['all', 'standard', 'str', 'dex', 'int', 'str_dex', 'str_int', 'dex_int', 'str_dex_int', 'ward'];

/**
 * A name for every modifier pool of a category. The attribute pools have
 * fixed names; anything particular to a category is named by the guide, in
 * the base type that covers it.
 */
export function poolNames(guide: CraftGuide, data: CraftData, name: (key: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pool of data.pools) {
    const type = guide.basics.bases.types.find((entry) => entry.pools.includes(pool.id));
    if (STANDARD_POOLS.includes(pool.id)) out[pool.id] = name(`craft.pool.name.${pool.id}`);
    else out[pool.id] = type?.title ?? data.bases.filter((base) => base.pool === pool.id).map((base) => base.name).join(', ');
  }
  return out;
}

/** Slots per side: equipment has three, jewels two, flasks one. */
export function slotsOf(group: CraftGroup): number {
  return group === 'jewel' ? 2 : group === 'flask' ? 1 : 3;
}
