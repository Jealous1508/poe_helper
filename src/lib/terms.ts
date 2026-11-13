import { z } from 'zod';
import { loadYamlFile } from './content';

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

/** Game-term registry for a league, keyed by lower-cased name. */
export function getTerms(league: string): Map<string, Term> {
  const cached = cache.get(league);
  if (cached) return cached;
  const file = loadYamlFile(`terms/${league}.yaml`);
  if (!file) throw new Error(`No term registry for league "${league}" (expected src/content/terms/${league}.yaml)`);
  const parsed = schema.safeParse(file.data);
  if (!parsed.success) throw new Error(`${file.where}: ${parsed.error.message}`);
  const map = new Map<string, Term>();
  for (const term of parsed.data) {
    const key = term.name.toLowerCase();
    if (map.has(key)) throw new Error(`${file.where}: duplicate term "${term.name}"`);
    map.set(key, term);
  }
  cache.set(league, map);
  return map;
}
