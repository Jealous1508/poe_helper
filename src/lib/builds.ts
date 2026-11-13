import { z } from 'zod';
import type { Locale } from '../i18n';
import { getChangelogIds } from './changelog';
import { loadYamlDir, resolveLocale, type YamlFile } from './content';
import { getTerms } from './terms';

export const budgets = ['starter', 'low', 'medium', 'high', 'extreme'] as const;
export type Budget = (typeof budgets)[number];

const rating = z.number().int().min(1).max(5);

const schema = z
  .object({
    name: z.string().min(1),
    /** One sentence for the build card. */
    tagline: z.string().min(1).optional(),
    class: z.string().min(1),
    ascendancy: z.string().min(1),
    role: z.enum(['starter', 'endgame']),
    budget: z.enum(budgets),
    budgetNote: z.string().optional(),
    /** Term name of the main skill. */
    mainSkill: z.string().min(1),
    /** Image manifest id for the card and header icon. */
    image: z.string().min(1),
    /** Wide artwork behind the header. */
    hero: z.string().optional(),
    tags: z.array(z.string().min(1)),
    ratings: z.object({ clear: rating, bossing: rating, survivability: rating, ease: rating }).strict(),
    verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    confidence: z.enum(['proven', 'predicted', 'mixed']),
    confidenceNote: z.string().optional(),
    modes: z.object({ ssf: z.string().min(1), hardcore: z.string().min(1) }).strict(),
    /** The idea in 60 seconds (rich text). */
    idea: z.string().min(1),
    /** Mechanic chain, drawn as boxes joined by arrows. */
    chain: z.array(z.object({ label: z.string().min(1), text: z.string().min(1) }).strict()).min(1),
    /** Extra explanation under the chain, for readers who want the detail. */
    chainDetails: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) }).strict()).optional(),
    mandatory: z.array(
      z.object({
        term: z.string().min(1),
        level: z.enum(['must', 'recommended']).default('must'),
        why: z.string().min(1),
        detail: z.string().optional(),
      }).strict(),
    ),
    /** Labyrinth order: which ascendancy notable to take and why. */
    labs: z.array(z.object({ lab: z.string().min(1), node: z.string().min(1), why: z.string().min(1) }).strict()).optional(),
    stages: z.array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        title: z.string().min(1),
        levels: z.string().min(1),
        uses: z.string().min(1),
        changes: z.string().min(1),
        moveOn: z.string().min(1),
        /** Gem setups for this stage; gems are term names. */
        links: z.array(z.object({ name: z.string().min(1), gems: z.array(z.string().min(1)).min(1) }).strict()).optional(),
        details: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) }).strict()),
      }).strict(),
    ).min(1),
    /** What this patch changed for the build. `entry` is a changelog id. */
    patch: z.array(z.object({ entry: z.string().optional(), note: z.string().min(1) }).strict()),
    strengths: z.array(z.string().min(1)),
    weaknesses: z.array(z.string().min(1)),
    avoidIf: z.string().min(1),
    sources: z.array(
      z.object({
        title: z.string().min(1),
        url: z.string().regex(/^https?:\/\//, 'must be an http(s) link'),
        kind: z.enum(['guide', 'pob', 'video', 'thread', 'official', 'data']),
        note: z.string().optional(),
      }).strict(),
    ).min(1),
  })
  .strict();

export type Build = z.infer<typeof schema> & { slug: string; where: string };

export interface BuildContext {
  league: string;
  changelogIds: Set<string>;
}

/** Validate one build file. Cross-checks terms and changelog links. */
export function parseBuild(slug: string, file: YamlFile, ctx: BuildContext): Build {
  const parsed = schema.safeParse(file.data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${file.where}: field "${issue.path.join('.')}": ${issue.message}`);
  }
  const build = parsed.data;
  const terms = getTerms(ctx.league);
  const needTerm = (name: string, field: string) => {
    if (!terms.has(name.toLowerCase())) throw new Error(`${file.where}: ${field} names "${name}", which is not in the term registry`);
  };
  needTerm(build.mainSkill, 'mainSkill');
  for (const piece of build.mandatory) needTerm(piece.term, 'mandatory');
  for (const stage of build.stages) for (const link of stage.links ?? []) for (const gem of link.gems) needTerm(gem, `stage "${stage.id}" links`);
  for (const change of build.patch) {
    if (change.entry && !ctx.changelogIds.has(change.entry)) {
      throw new Error(`${file.where}: patch links to changelog entry "${change.entry}", which does not exist`);
    }
  }
  return { ...build, slug, where: file.where };
}

export function getBuilds(league: string, locale: Locale): { builds: Build[]; isFallback: boolean } {
  const byLocale = loadYamlDir('builds', league);
  if (!byLocale.en) return { builds: [], isFallback: locale !== 'en' };
  const { data, isFallback } = resolveLocale(byLocale, locale);
  const ctx = { league, changelogIds: getChangelogIds(league) };
  const builds = Object.entries(data).map(([slug, file]) => parseBuild(slug, file, ctx));
  builds.sort((a, b) => a.name.localeCompare(b.name));
  return { builds, isFallback };
}

export function getBuild(league: string, locale: Locale, slug: string): { build: Build; isFallback: boolean } {
  const { builds, isFallback } = getBuilds(league, locale);
  const build = builds.find((b) => b.slug === slug);
  if (!build) throw new Error(`builds/${league}: no build "${slug}"`);
  return { build, isFallback };
}
