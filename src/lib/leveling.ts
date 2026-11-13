import { z } from 'zod';
import type { Locale } from '../i18n';
import { loadYamlDir, resolveLocale, type YamlFile } from './content';

export const nodeTags = ['travel', 'must', 'worth', 'skip'] as const;
export type NodeTag = (typeof nodeTags)[number];

const nodeSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    kind: z.enum(['town', 'zone', 'boss', 'side']),
    /** What to do here: pass through, required, optional but worth it, or skip. */
    tag: z.enum(nodeTags),
    /** For side areas: the id of the earlier node they branch off. */
    branchFrom: z.string().optional(),
    waypoint: z.boolean().optional(),
    /** Area level. */
    level: z.number().int().positive().optional(),
    /** Short label on the node, e.g. "+1 passive point". */
    badge: z.string().optional(),
    /** One or two sentences: what to do here. */
    summary: z.string().min(1),
    quest: z.string().optional(),
    reward: z.string().optional(),
    /** Why the tag is what it is. */
    why: z.string().optional(),
    /** Layout and boss tips. */
    tips: z.string().optional(),
    /** Extra explanation for first-time players. */
    newbie: z.string().optional(),
    /** Reward options that differ by class. */
    classRewards: z.array(z.object({ class: z.string().min(1), reward: z.string().min(1) }).strict()).optional(),
    classRewardsNote: z.string().optional(),
    image: z.string().optional(),
  })
  .strict();

export type RouteNode = z.infer<typeof nodeSchema>;

const actSchema = z
  .object({
    number: z.number().int().min(1).max(10),
    title: z.string().min(1),
    town: z.string().min(1),
    levelIn: z.number().int().positive(),
    levelOut: z.number().int().positive(),
    skillPoints: z.number().int().min(0),
    skillPointsNote: z.string().optional(),
    boss: z.string().min(1),
    keyRewards: z.array(z.string().min(1)),
    intro: z.string().min(1),
    nodes: z.array(nodeSchema).min(1),
    sections: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) }).strict()),
    /** What this patch changed for the act (rich text). */
    patchNotes: z.array(z.string().min(1)).default([]),
    sources: z.array(z.object({ title: z.string().min(1), url: z.string().regex(/^https?:\/\//) }).strict()).default([]),
  })
  .strict();

export type Act = z.infer<typeof actSchema> & { slug: string; where: string };

const overviewSchema = z
  .object({
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    intro: z.string().min(1),
    stops: z.array(
      z.object({
        slug: z.string().regex(/^act-\d+$/),
        label: z.string().min(1),
        town: z.string().min(1),
        levels: z.string().min(1),
        boss: z.string().min(1),
        points: z.string().min(1),
        /** Things that happen in or after this act: labs, penalties, unlocks. */
        markers: z.array(z.object({ kind: z.enum(['lab', 'penalty', 'unlock']), text: z.string().min(1) }).strict()).default([]),
      }).strict(),
    ).length(10),
    labs: z.array(
      z.object({ name: z.string().min(1), areaLevel: z.number().int(), trials: z.string().min(1), when: z.string().min(1), ready: z.string().min(1) }).strict(),
    ),
    principles: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) }).strict()),
    legend: z.array(z.object({ tag: z.enum(nodeTags), text: z.string().min(1) }).strict()),
  })
  .strict();

export type Overview = Omit<z.infer<typeof overviewSchema>, 'stops'> & {
  stops: (z.infer<typeof overviewSchema>['stops'][number] & { available: boolean })[];
  where: string;
};

/** Validate one act file, including the shape of the route graph. */
export function parseAct(slug: string, file: YamlFile, _league: string): Act {
  const parsed = actSchema.safeParse(file.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${file.where}: field "${issue.path.join('.')}": ${issue.message}`);
  }
  const act = parsed.data;
  if (act.levelOut <= act.levelIn) throw new Error(`${file.where}: levelOut must be higher than levelIn`);
  const seen = new Set<string>();
  for (const node of act.nodes) {
    if (seen.has(node.id)) throw new Error(`${file.where}: duplicate node id "${node.id}"`);
    if (node.kind === 'side' && !node.branchFrom) throw new Error(`${file.where}: side node "${node.id}" needs branchFrom`);
    if (node.branchFrom && !seen.has(node.branchFrom)) {
      throw new Error(`${file.where}: node "${node.id}" has branchFrom "${node.branchFrom}", which is not an earlier node`);
    }
    seen.add(node.id);
  }
  return { ...act, slug, where: file.where };
}

function actFiles(league: string, locale: Locale) {
  const { data, isFallback } = resolveLocale(loadYamlDir('leveling', league), locale);
  return { data, isFallback };
}

export function getActs(league: string, locale: Locale): { acts: Act[]; isFallback: boolean } {
  const { data, isFallback } = actFiles(league, locale);
  const acts = Object.entries(data)
    .filter(([stem]) => /^act-\d+$/.test(stem))
    .map(([stem, file]) => parseAct(stem, file, league))
    .sort((a, b) => a.number - b.number);
  return { acts, isFallback };
}

const labsSchema = z
  .object({
    intro: z.string().min(1),
    /** The three Labyrinths, in order. */
    labs: z.array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        name: z.string().min(1),
        areaLevel: z.number().int().positive(),
        requires: z.string().min(1),
        when: z.string().min(1),
        ready: z.string().min(1),
        reward: z.string().min(1),
        trials: z.array(z.object({ zone: z.string().min(1), act: z.number().int(), trap: z.string().min(1) }).strict()),
        notes: z.array(z.string().min(1)).default([]),
      }).strict(),
    ).min(1),
    /** How the place works: Izaro, Darkshrines, traps, the one-death rule. */
    rules: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) }).strict()),
    traps: z.array(z.object({ name: z.string().min(1), body: z.string().min(1) }).strict()).default([]),
    sources: z.array(z.object({ title: z.string().min(1), url: z.string().regex(/^https?:\/\//) }).strict()).default([]),
  })
  .strict();

export type Labs = z.infer<typeof labsSchema> & { where: string };

/** The Labyrinth page, or undefined if it has not been written for this league. */
export function getLabs(league: string, locale: Locale): { labs: Labs; isFallback: boolean } | undefined {
  const { data, isFallback } = actFiles(league, locale);
  const file = data.labs;
  if (!file) return undefined;
  const parsed = labsSchema.safeParse(file.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${file.where}: field "${issue.path.join('.')}": ${issue.message}`);
  }
  return { labs: { ...parsed.data, where: file.where }, isFallback };
}

export function hasLabs(league: string): boolean {
  return Boolean(loadYamlDir('leveling', league).en?.labs);
}

export function getOverview(league: string, locale: Locale): { overview: Overview; isFallback: boolean } {
  const { data, isFallback } = actFiles(league, locale);
  const file = data.overview;
  if (!file) throw new Error(`leveling/${league}: missing overview.yaml`);
  const parsed = overviewSchema.safeParse(file.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${file.where}: field "${issue.path.join('.')}": ${issue.message}`);
  }
  const written = new Set(Object.keys(data));
  const stops = parsed.data.stops.map((stop) => ({ ...stop, available: written.has(stop.slug) }));
  return { overview: { ...parsed.data, stops, where: file.where }, isFallback };
}
