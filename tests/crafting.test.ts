import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leagues } from '../src/config/leagues';
import {
  craftCategories,
  craftGroups,
  examplesOf,
  familyShare,
  getCraftData,
  getCrafting,
  parseExample,
  slotsOf,
  tierWeight,
  type CraftExample,
  type CraftFamily,
  type CraftGuide,
} from '../src/lib/crafting';

describe('the crafting data', () => {
  it('has every category, each in a known group, with bases and a modifier pool', () => {
    expect(craftCategories.length).toBeGreaterThanOrEqual(27);
    for (const category of craftCategories) {
      const data = getCraftData(category.id);
      expect(craftGroups, category.id).toContain(data.group);
      expect(data.bases.length, category.id).toBeGreaterThan(0);
      expect(data.prefix.length + data.suffix.length, category.id).toBeGreaterThan(0);
    }
  });

  it('gives every base a pool that exists and an icon that is on disk', () => {
    for (const category of craftCategories) {
      const data = getCraftData(category.id);
      const pools = new Set(data.pools.map((pool) => pool.id));
      for (const base of data.bases) {
        expect(pools.has(base.pool), `${category.id}: ${base.name}`).toBe(true);
        expect(base.icon, `${category.id}: ${base.name} has no icon`).toBeDefined();
        expect(existsSync(`public/${base.icon!.file}`), base.icon!.file).toBe(true);
      }
    }
  });

  it('numbers tiers from the best down, and never lets a higher tier need a lower item level', () => {
    for (const category of craftCategories) {
      const data = getCraftData(category.id);
      for (const family of [...data.prefix, ...data.suffix]) {
        family.tiers.forEach((tier, index) => {
          expect(tier.tier, `${category.id}: ${family.label}`).toBe(index + 1);
          if (index > 0) expect(tier.ilvl, `${category.id}: ${family.label}`).toBeLessThanOrEqual(family.tiers[index - 1].ilvl);
        });
      }
    }
  });

  it('knows the item level of the best physical damage on a two-handed mace', () => {
    // A fact any crafter can check in the game: Merciless needs item level 83.
    const family = getCraftData('two-hand-maces').prefix.find((entry) => entry.label === '#% increased Physical Damage')!;
    expect(family.tiers[0]).toMatchObject({ name: 'Merciless', ilvl: 83 });
  });
});

describe('weights', () => {
  const family = (key: string, weights: (number | Record<string, number>)[], on?: string[]): CraftFamily => ({
    key,
    group: key,
    label: key,
    tags: [],
    on,
    tiers: weights.map((weight, index) => ({ name: `${key}${index}`, ilvl: 80 - index * 20, text: [key], weight, tier: index + 1 })),
  });
  const life = family('life', [100, 300]);
  const armour = family('armour', [{ str: 600 }], ['str']);
  const all = [life, armour];

  it('reads a weight for a pool, and zero where the pool cannot roll it', () => {
    expect(tierWeight(life, life.tiers[0], 'dex')).toBe(100);
    expect(tierWeight(armour, armour.tiers[0], 'str')).toBe(600);
    expect(tierWeight(armour, armour.tiers[0], 'dex')).toBe(0);
  });

  it('shares out one side of the pool, pool by pool', () => {
    expect(familyShare(all, life, 'str')).toBeCloseTo(400 / 1000);
    expect(familyShare(all, armour, 'str')).toBeCloseTo(600 / 1000);
    expect(familyShare(all, life, 'dex')).toBe(1);
  });

  it('leaves out the tiers an item level cannot reach', () => {
    // At item level 70 only the lower life tier (needs 60) can roll.
    expect(familyShare(all, life, 'dex', 70)).toBe(1);
    expect(familyShare(all, life, 'str', 70)).toBeCloseTo(300 / 300);
    expect(familyShare(all, armour, 'str', 70)).toBe(0);
  });
});

describe('parseExample', () => {
  const methods = new Set(['currency', 'bench']);
  const data = (extra: Record<string, unknown> = {}) => ({
    category: 'two-hand-maces',
    title: 'A first mace',
    level: 1,
    summary: 'A mace.',
    goal: 'A mace that hits.',
    base: 'Karui Maul',
    itemLevel: 60,
    baseWhy: 'Because.',
    methods: ['currency'],
    result: { prefixes: [{ text: '120% increased Physical Damage' }], suffixes: [] },
    needs: [{ item: 'Orb of Alchemy', amount: '1' }],
    cost: 'Cheap.',
    odds: 'Good.',
    steps: [
      { title: 'One', do: 'Do it.', why: 'Because.' },
      { title: 'Two', do: 'Do it again.', why: 'Because.' },
    ],
    verified: '2026-11-18',
    sources: [{ title: 'Game data', url: 'https://repoe-fork.github.io/', kind: 'data' }],
    ...extra,
  });
  const parse = (stem: string, extra: Record<string, unknown> = {}) =>
    parseExample(stem, { where: `craft-examples/3.30/en/${stem}.yaml`, data: data(extra) }, methods);

  it('takes the slug from the file name and defaults a modifier to rolled', () => {
    const example = parse('two-hand-maces--first-mace');
    expect(example.slug).toBe('first-mace');
    expect(example.result.prefixes[0].how).toBe('rolled');
    expect(example.result.rarity).toBe('rare');
  });

  it('rejects a file name without a category, and one that disagrees with the file', () => {
    expect(() => parse('first-mace')).toThrow(/<category>--<slug>/);
    expect(() => parse('helmets--first-mace')).toThrow(/helmets.*two-hand-maces/);
  });

  it('rejects a base that is not in the category, naming it', () => {
    expect(() => parse('two-hand-maces--x', { base: 'Royal Burgonet' })).toThrow(/"Royal Burgonet" is not in two-hand-maces/);
  });

  it('rejects a tool the overview does not define', () => {
    expect(() => parse('two-hand-maces--x', { methods: ['sorcery'] })).toThrow(/method "sorcery"/);
  });

  it('rejects an item with four prefixes', () => {
    const four = Array.from({ length: 4 }, () => ({ text: 'x' }));
    expect(() => parse('two-hand-maces--x', { result: { prefixes: four, suffixes: [] } })).toThrow(/more than 3/);
  });
});

describe('slots', () => {
  it('gives equipment three, jewels two and flasks one', () => {
    expect([slotsOf('armour'), slotsOf('two-hand'), slotsOf('jewel'), slotsOf('flask')]).toEqual([3, 3, 2, 1]);
  });
});

/** What must not differ between the two languages of one guide. */
function guideFacts(guide: CraftGuide) {
  return {
    icon: guide.icon,
    breakpoints: guide.basics.itemLevel.breakpoints.map((point) => point.ilvl),
    types: guide.basics.bases.types.map((type) => type.pools),
    picks: guide.basics.bases.picks.map((pick) => pick.base),
    tools: guide.tools.map((tool) => tool.method),
    prefixes: guide.reading.prefixes.key.map((entry) => entry.mod),
    suffixes: guide.reading.suffixes.key.map((entry) => entry.mod),
    order: guide.approach.order.length,
    special: guide.special.map((entry) => entry.mod),
    mistakes: guide.mistakes.length,
    verified: guide.verified,
    sources: guide.sources.map((source) => source.url),
  };
}
function exampleFacts(example: CraftExample) {
  const state = (s: CraftExample['result'] | undefined) =>
    s && { rarity: s.rarity, implicits: s.implicits, prefixes: s.prefixes, suffixes: s.suffixes };
  return {
    level: example.level,
    base: example.base,
    itemLevel: example.itemLevel,
    methods: example.methods,
    result: state(example.result),
    needs: example.needs.length,
    steps: example.steps.map((step) => ({ check: Boolean(step.check), fail: Boolean(step.fail), state: state(step.state) })),
    variations: Boolean(example.variations),
    mistakes: example.mistakes.length,
    verified: example.verified,
    sources: example.sources.map((source) => source.url),
  };
}

describe('the published crafting guides', () => {
  for (const league of leagues) {
    const en = getCrafting(league.id, 'en');
    const vi = getCrafting(league.id, 'vi');
    if (!en || !vi) continue;

    it(`${league.id}: everything is translated`, () => {
      expect(vi.overviewIsFallback).toBe(false);
      expect(vi.guides.filter((guide) => guide.isFallback).map((guide) => guide.id)).toEqual([]);
      expect(vi.examples.filter((example) => example.isFallback).map((example) => `${example.category}--${example.slug}`)).toEqual([]);
    });

    it(`${league.id}: the two languages describe every guide and example with the same facts`, () => {
      expect(vi.overview.methods.map((m) => [m.id, m.level, m.icons])).toEqual(en.overview.methods.map((m) => [m.id, m.level, m.icons]));
      expect(vi.guides.map((guide) => guide.id)).toEqual(en.guides.map((guide) => guide.id));
      for (const [index, guide] of en.guides.entries()) expect(guideFacts(vi.guides[index]), guide.id).toEqual(guideFacts(guide));
      const key = (example: CraftExample) => `${example.category}--${example.slug}`;
      const viByKey = new Map(vi.examples.map((example) => [key(example), example]));
      for (const example of en.examples) expect(exampleFacts(viByKey.get(key(example))!), key(example)).toEqual(exampleFacts(example));
    });

    it(`${league.id}: every guide has examples, starting easy and ending hard`, () => {
      for (const guide of en.guides) {
        const levels = examplesOf(en, guide.id).map((example) => example.level);
        expect(levels.length, guide.id).toBeGreaterThanOrEqual(3);
        expect(Math.min(...levels), `${guide.id}: needs an entry-level example`).toBeLessThanOrEqual(2);
      }
    });

    it(`${league.id}: every kind of base in a category is explained by the guide`, () => {
      for (const guide of en.guides) {
        const covered = new Set(guide.basics.bases.types.flatMap((type) => type.pools));
        for (const pool of getCraftData(guide.id).pools) expect(covered.has(pool.id), `${guide.id}: pool "${pool.id}" is not covered by any base type`).toBe(true);
      }
    });
  }
});

/**
 * Every string in the crafting content, with the path that leads to it.
 * Lets a test check game terms and stray markup without rendering a page.
 */
function strings(value: unknown, path: string[] = []): { path: string[]; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item) => strings(item, path));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => strings(item, [...path, key]));
  return [];
}
// Fields that are printed as they are written. Markdown or a [[Term]] in one
// of these would show up on the page as raw symbols.
const PLAIN_KEYS = new Set(['name', 'short', 'icon', 'title', 'summary', 'base', 'mod', 'aim', 'source', 'for', 'amount', 'term', 'url', 'kind', 'where', 'slug', 'id', 'group', 'category', 'verified']);
function isPlain(path: string[]): boolean {
  if (path.includes('result') || path.includes('state')) return true; // item snapshots are game text
  const key = path.at(-1)!;
  if (key === 'where') return !path.includes('special'); // special[].where is prose; `where` elsewhere is a file path
  if (key === 'summary' && path.includes('memoryStrands')) return false; // the one summary that is prose
  if (key === 'note' && path.includes('needs')) return true;
  if (key === 'source' && !path.includes('special')) return false;
  return PLAIN_KEYS.has(key);
}

describe('the text of the crafting guides', () => {
  for (const league of leagues) {
    for (const locale of ['en', 'vi'] as const) {
      const loaded = getCrafting(league.id, locale);
      if (!loaded) continue;
      const documents = [loaded.overview, ...loaded.guides, ...loaded.examples];

      it(`${league.id}/${locale}: every [[Term]] is in the registry`, async () => {
        const { getTerms } = await import('../src/lib/terms');
        const terms = getTerms(league.id);
        const unknown: string[] = [];
        for (const doc of documents) {
          for (const { text } of strings(doc)) {
            for (const match of text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
              if (!terms.has(match[1].trim().toLowerCase())) unknown.push(`${doc.where}: [[${match[1]}]]`);
            }
          }
        }
        expect(unknown).toEqual([]);
      });

      it(`${league.id}/${locale}: plain fields hold no markup`, () => {
        const stray: string[] = [];
        for (const doc of documents) {
          for (const { path, text } of strings(doc)) {
            if (isPlain(path) && /\[\[|\*\*/.test(text)) stray.push(`${doc.where}: ${path.join('.')}: ${text.slice(0, 50)}`);
          }
        }
        expect(stray).toEqual([]);
      });
    }
  }
});

/**
 * Does a line written on an item snapshot ("172% increased Physical Damage")
 * fit a modifier tier from the data ("(170-179)% increased Physical Damage")?
 * Every number has to sit inside the tier's range.
 */
function fits(written: string, tier: string[]): boolean {
  const parts = written.split(' / ').map((part) => part.trim());
  if (parts.length !== tier.length) return false;
  return parts.every((part, index) => {
    const ranges: [number, number][] = [];
    // Escape the tier text for use as a pattern, then turn each "(low-high)"
    // range (now escaped) into a capture group and remember its bounds.
    const escaped = tier[index]
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\((-?[\d.\\]+)-(-?[\d.\\]+)\\\)/g, (_, low: string, high: string) => {
        // A decimal point inside the range was escaped too: "2\.6".
        ranges.push([Number(low.replaceAll('\\', '')), Number(high.replaceAll('\\', ''))]);
        return '(-?[\\d.]+)';
      });
    const match = new RegExp(`^${escaped}$`).exec(part);
    return match !== null && ranges.every(([low, high], i) => Number(match[i + 1]) >= Math.min(low, high) && Number(match[i + 1]) <= Math.max(low, high));
  });
}

describe('item snapshots in the examples', () => {
  for (const league of leagues) {
    const en = getCrafting(league.id, 'en');
    if (!en) continue;

    it(`${league.id}: every modifier drawn on an item exists for that base at that item level`, () => {
      const problems: string[] = [];
      for (const example of en.examples) {
        const data = getCraftData(example.category);
        const base = data.bases.find((entry) => entry.name === example.base)!;
        const natural = (side: 'prefix' | 'suffix') => [
          ...[...data[side], ...data.influence.flatMap((influence) => influence[side]), ...data.delve[side]]
            .filter((family) => !family.on || family.on.includes(base.pool))
            .flatMap((family) => family.tiers.filter((tier) => tier.ilvl <= example.itemLevel).map((tier) => tier.text)),
          // Cluster jewel notables hang off the enchantment, not the base.
          ...(data.cluster?.mods ?? []).filter((mod) => mod.affix === side && mod.ilvl <= example.itemLevel).map((mod) => mod.text),
        ];
        const bench = (side: string) => data.bench.filter((entry) => entry.affix === side).flatMap((entry) => entry.tiers.map((tier) => tier.text));
        const essence = (side: string) =>
          data.essences.filter((entry) => entry.class === base.class).flatMap((entry) => entry.tiers.filter((tier) => tier.affix === side).map((tier) => tier.text));
        const veiled = (side: string) => data.veiled.filter((entry) => entry.affix === side).flatMap((entry) => entry.tiers.map((tier) => tier.text));

        const states = [example.result, ...example.steps.map((step) => step.state)].filter((state) => state !== undefined);
        for (const state of states) {
          for (const side of ['prefix', 'suffix'] as const) {
            for (const affix of state[side === 'prefix' ? 'prefixes' : 'suffixes']) {
              // A modifier written as "Veiled Prefix" is one that has not been unveiled yet.
              if (/^Veiled (Prefix|Suffix)$/.test(affix.text)) continue;
              const sources =
                affix.how === 'crafted' ? bench(side)
                : affix.how === 'essence' ? essence(side)
                : affix.how === 'veiled' ? veiled(side)
                : [...natural(side), ...essence(side), ...veiled(side), ...bench(side)];
              if (!sources.some((tier) => fits(affix.text, tier))) {
                problems.push(`${example.where}: ${side} "${affix.text}" (${affix.how}) fits no tier of ${example.base} at item level ${example.itemLevel}`);
              }
            }
          }
        }
      }
      expect(problems).toEqual([]);
    });
  }
});
