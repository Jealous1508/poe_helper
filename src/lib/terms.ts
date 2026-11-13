import { z } from 'zod';
import { loadYamlFiles } from './content';

export const termKinds = [
  'gem', 'support', 'unique', 'currency', 'item', 'keystone', 'notable', 'mechanic', 'npc', 'zone', 'class',
] as const;
export type TermKind = (typeof termKinds)[number];

export interface Term {
  name: string;
  kind: TermKind;
  /** Image manifest id for the inline icon. */
  image?: string;
}

const schema = z.array(
  z.object({ name: z.string().min(1), kind: z.enum(termKinds), image: z.string().optional() }).strict(),
);

const cache = new Map<string, Map<string, Term>>();

/**
 * Game-term registry for a league, keyed by lower-cased name.
 *
 * The registry is `terms/<league>.yaml` plus any `terms/<league>.<name>.yaml`
 * shard beside it. Shards exist so that several people — or several agents —
 * can add terms for different articles at the same time without overwriting
 * one another's edits in a single large file.
 */
export function getTerms(league: string): Map<string, Term> {
  const cached = cache.get(league);
  if (cached) return cached;
  const files = loadYamlFiles(`terms/${league}.yaml`, `terms/${league}.*.yaml`);
  if (files.length === 0) {
    throw new Error(`No term registry for league "${league}" (expected src/content/terms/${league}.yaml)`);
  }
  const map = new Map<string, Term>();
  const sources = new Map<string, string>();
  for (const file of files) {
    const parsed = schema.safeParse(file.data);
    if (!parsed.success) throw new Error(`${file.where}: ${parsed.error.message}`);
    for (const term of parsed.data) {
      const key = term.name.toLowerCase();
      const already = sources.get(key);
      if (already) throw new Error(`${file.where}: duplicate term "${term.name}", already defined in ${already}`);
      sources.set(key, file.where);
      map.set(key, term);
    }
  }
  cache.set(league, map);
  return map;
}
