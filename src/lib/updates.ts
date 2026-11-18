import { z } from 'zod';
import type { Locale } from '../i18n';
import { getChangelogIds } from './changelog';
import { loadYamlDir, resolveFiles, type YamlFile } from './content';

/**
 * Updates: what Grinding Gear Games has shipped or announced since launch.
 *
 * One file per official post, in `src/content/updates/<league>/<locale>/`,
 * named `<date>-<slug>.yaml`. Adding the next one is a matter of dropping a
 * file in (English first, then its Vietnamese twin); the tab, the home page
 * and the cross-links on the changelog and build pages pick it up.
 */

/** What sort of post it is. */
export const updateKinds = ['patch', 'hotfix', 'announcement'] as const;
export type UpdateKind = (typeof updateKinds)[number];

/**
 * Whether you are playing with it yet. The distinction matters more than it
 * looks: a developer post describing next week's patch reads exactly like
 * patch notes, and a reader who takes it for live will plan around numbers
 * that are not in the game.
 */
export const updateStatuses = ['live', 'announced'] as const;
export type UpdateStatus = (typeof updateStatuses)[number];

/**
 * How a single line lands on players, not on monsters: a monster that hits
 * less hard is a buff. `info` is for a statement that changes nothing yet.
 */
export const pointKinds = ['buff', 'nerf', 'rework', 'new', 'fix', 'info'] as const;

const point = z
  .object({
    kind: z.enum(pointKinds),
    text: z.string().min(1),
    /** Id of a later update that acted on this line. Says "followed up", never "done". */
    followUp: z.string().min(1).optional(),
  })
  .strict();

const schema = z
  .object({
    /** Calendar date of the official post, as the official forum shows it. */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Position among the posts of one day: 1 is the first of the day. */
    order: z.number().int().min(1).default(1),
    kind: z.enum(updateKinds),
    status: z.enum(updateStatuses),
    /** The official name of the post, e.g. "3.30.0b Hotfix 3". Stays English. */
    title: z.string().min(1),
    /** One line saying what it amounts to, in our words. */
    headline: z.string().min(1),
    /** A short paragraph (rich text). */
    summary: z.string().min(1),
    /** The changes, rewritten. */
    points: z.array(point).min(1),
    /** Changes that belong together, e.g. one group per league mechanic. */
    sections: z.array(z.object({ title: z.string().min(1), points: z.array(point).min(1) }).strict()).min(1).optional(),
    /** What it means for someone playing (rich text). */
    meaning: z.string().min(1).optional(),
    /** For an announcement: when the developers say it ships, in their words. */
    eta: z.string().min(1).optional(),
    /** Changelog entries this amends. */
    entries: z.array(z.string().min(1)).default([]),
    /** Build guides this touches, by slug. */
    builds: z.array(z.string().min(1)).default([]),
    /** Lines quoted from the official post. Kept few, and never translated. */
    official: z.array(z.string().min(1)).default([]),
    source: z.object({ title: z.string().min(1), url: z.string().regex(/^https:\/\//, 'must be an https link') }).strict(),
    /** Day we last checked the official post. */
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export type Update = z.infer<typeof schema> & { id: string; where: string; isFallback?: boolean };
export type UpdatePoint = z.infer<typeof point>;

export interface UpdateContext {
  changelogIds: Set<string>;
  buildSlugs: Set<string>;
}

/** Validate one update file. The id is the file name. */
export function parseUpdate(id: string, file: YamlFile, ctx: UpdateContext): Update {
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(id)) {
    throw new Error(`${file.where}: an update file is named <yyyy-mm-dd>-<slug>.yaml`);
  }
  const parsed = schema.safeParse(file.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${file.where}: field "${issue.path.join('.')}": ${issue.message}`);
  }
  const update = parsed.data;
  if (!id.startsWith(update.date)) {
    throw new Error(`${file.where}: the file name says ${id.slice(0, 10)} but the date field says ${update.date}`);
  }
  // An announcement is a promise with a date attached; a live change has none.
  if (update.status === 'live' && update.eta) throw new Error(`${file.where}: a live update has no eta`);
  for (const entry of update.entries) {
    if (!ctx.changelogIds.has(entry)) throw new Error(`${file.where}: links to changelog entry "${entry}", which does not exist`);
  }
  for (const slug of update.builds) {
    if (!ctx.buildSlugs.has(slug)) throw new Error(`${file.where}: links to build "${slug}", which does not exist`);
  }
  return { ...update, id, where: file.where };
}

/** Every line of an update, grouped or not. */
export function allPoints(update: Pick<Update, 'points' | 'sections'>): UpdatePoint[] {
  return [...update.points, ...(update.sections ?? []).flatMap((section) => section.points)];
}

/** Newest first; within a day, the later post first. */
export function sortUpdates(updates: Update[]): Update[] {
  return [...updates].sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order || b.id.localeCompare(a.id));
}

/** A follow-up has to point at an update that exists, and at a later one. */
export function checkFollowUps(updates: Update[]): void {
  const byId = new Map(updates.map((u) => [u.id, u]));
  for (const update of updates) {
    for (const line of allPoints(update)) {
      if (!line.followUp) continue;
      const target = byId.get(line.followUp);
      if (!target) throw new Error(`${update.where}: follow-up "${line.followUp}" is not an update`);
      const later = target.date > update.date || (target.date === update.date && target.order > update.order);
      if (!later) throw new Error(`${update.where}: follow-up "${line.followUp}" is not later than the update it follows`);
    }
  }
}

/** The updates that touch one changelog entry or one build, in the order given. */
export function updatesFor(updates: Update[], target: { entry?: string; build?: string }): Update[] {
  return updates.filter(
    (u) =>
      (target.entry !== undefined && u.entries.includes(target.entry)) ||
      (target.build !== undefined && u.builds.includes(target.build)),
  );
}

/** Day of the league an update fell on; launch day is day 1. */
export function leagueDay(date: string, launchDate: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${launchDate}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

const cache = new Map<string, { updates: Update[]; isFallback: boolean }>();

export function getUpdates(league: string, locale: Locale): { updates: Update[]; isFallback: boolean } {
  const key = `${league}:${locale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const byLocale = loadYamlDir('updates', league);
  if (!byLocale.en) return { updates: [], isFallback: false };
  const { files, fellBack } = resolveFiles(byLocale, locale);
  const ctx: UpdateContext = {
    changelogIds: getChangelogIds(league),
    buildSlugs: new Set(Object.keys(loadYamlDir('builds', league).en ?? {})),
  };
  const updates = sortUpdates(
    Object.entries(files).map(([id, file]) => ({ ...parseUpdate(id, file, ctx), isFallback: fellBack.has(id) })),
  );
  checkFollowUps(updates);
  const result = { updates, isFallback: updates.some((u) => u.isFallback) };
  cache.set(key, result);
  return result;
}
