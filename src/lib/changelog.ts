import { z } from 'zod';
import type { Locale } from '../i18n';
import { loadYamlDir, resolveLocale, type YamlFile } from './content';

export const sections = ['big', 'small', 'new'] as const;
export type Section = (typeof sections)[number];

export const categories = [
  'league', 'endgame', 'atlas', 'loot', 'mechanics', 'items', 'crafting',
  'skills', 'ascendancy', 'mercenaries', 'campaign', 'qol', 'other',
] as const;
export type Category = (typeof categories)[number];

export const verdicts = ['buff', 'nerf', 'rework', 'new', 'removed', 'mixed'] as const;
export type Verdict = (typeof verdicts)[number];

const entrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lower-case letters, digits and dashes'),
    category: z.enum(categories),
    verdict: z.enum(verdicts),
    title: z.string().min(1),
    /** Plain-language summary of the change (rich text). */
    summary: z.string().min(1),
    /** Short key facts shown as a list under the summary (rich text, inline). */
    points: z.array(z.string().min(1)).optional(),
    /** Image manifest id of the main picture. */
    image: z.string().min(1),
    /** Wide screenshot or artwork shown under the summary. */
    figure: z.object({ image: z.string().min(1), caption: z.string().min(1) }).strict().optional(),
    /** Extra small icons shown in a row. */
    gallery: z.array(z.string().min(1)).optional(),
    impact: z
      .object({
        meaning: z.string().min(1),
        winners: z.string().optional(),
        losers: z.string().optional(),
        affected: z.string().optional(),
        todo: z.string().optional(),
        confidence: z.enum(['confirmed', 'prediction']),
      })
      .strict(),
    /** The official patch-note lines this entry is based on. */
    official: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type ChangelogEntry = z.infer<typeof entrySchema> & { section: Section; where: string };

const metaSchema = z
  .object({
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    intro: z.string().min(1),
    /** Where this article's facts come from, shown under the lede. */
    note: z.string().optional(),
  })
  .strict();
export type ChangelogMeta = z.infer<typeof metaSchema>;

/** Validate the per-section files. The section comes from the file name. */
export function parseChangelog(files: Partial<Record<string, YamlFile>>): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    const file = files[section];
    if (!file) continue;
    const parsed = z.array(entrySchema).safeParse(file.data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(`${file.where}: entry ${String(issue.path[0])}, field "${issue.path.slice(1).join('.')}": ${issue.message}`);
    }
    for (const entry of parsed.data) {
      if (seen.has(entry.id)) throw new Error(`${file.where}: duplicate changelog id "${entry.id}"`);
      seen.add(entry.id);
      entries.push({ ...entry, section, where: file.where });
    }
  }
  return entries;
}

export function getChangelog(league: string, locale: Locale): { entries: ChangelogEntry[]; meta: ChangelogMeta; isFallback: boolean } {
  const { data, isFallback } = resolveLocale(loadYamlDir('changelog', league), locale);
  const metaFile = data.meta;
  if (!metaFile) throw new Error(`changelog/${league}: missing meta.yaml`);
  const meta = metaSchema.safeParse(metaFile.data);
  if (!meta.success) throw new Error(`${metaFile.where}: ${meta.error.message}`);
  return { entries: parseChangelog(data), meta: meta.data, isFallback };
}

/** Ids of every changelog entry in a league, for cross-links from other content. */
export function getChangelogIds(league: string): Set<string> {
  return new Set(getChangelog(league, 'en').entries.map((entry) => entry.id));
}
