import { parse } from 'yaml';
import { locales, type Locale } from '../i18n';

export interface Resolved<T> {
  data: T;
  locale: Locale;
  isFallback: boolean;
}

export interface ResolvedFiles {
  /** One entry per English file, each in the best language available. */
  files: Record<string, YamlFile>;
  /** Stems that had to fall back to English. */
  fellBack: Set<string>;
}

/**
 * Resolve a content directory one file at a time.
 *
 * A translation arrives file by file, so a locale usually has some of the
 * pages and not others. Choosing a language for the whole directory would
 * make the untranslated pages disappear; this picks per file instead, and
 * English decides which pages exist.
 */
export function resolveFiles(
  byLocale: Partial<Record<Locale, Record<string, YamlFile>>>,
  wanted: Locale,
): ResolvedFiles {
  const english = byLocale.en;
  if (english === undefined) throw new Error('No content found for this page in any language');
  const translated = wanted === 'en' ? undefined : byLocale[wanted];
  const files: Record<string, YamlFile> = {};
  const fellBack = new Set<string>();
  for (const [stem, file] of Object.entries(english)) {
    const own = translated?.[stem];
    files[stem] = own ?? file;
    if (!own) fellBack.add(stem);
  }
  if (wanted === 'en') fellBack.clear();
  return { files, fellBack };
}

/** Pick content for a locale, falling back to English. */
export function resolveLocale<T>(byLocale: Partial<Record<Locale, T>>, wanted: Locale): Resolved<T> {
  const own = byLocale[wanted];
  if (own !== undefined) return { data: own, locale: wanted, isFallback: false };
  const english = byLocale.en;
  if (english === undefined) throw new Error('No content found for this page in any language');
  return { data: english, locale: 'en', isFallback: true };
}

const rawFiles = import.meta.glob<string>('/src/content/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface YamlFile {
  /** Path relative to src/content, used in error messages. */
  where: string;
  data: unknown;
}

/**
 * Load every YAML file of one content kind for one league.
 * Layout: src/content/<kind>/<league>/<locale>/<stem>.yaml
 */
export function loadYamlDir(kind: string, league: string): Partial<Record<Locale, Record<string, YamlFile>>> {
  const out: Partial<Record<Locale, Record<string, YamlFile>>> = {};
  for (const locale of locales) {
    const prefix = `/src/content/${kind}/${league}/${locale}/`;
    for (const [path, raw] of Object.entries(rawFiles)) {
      if (!path.startsWith(prefix)) continue;
      const stem = path.slice(prefix.length).replace(/\.yaml$/, '');
      if (stem.includes('/')) continue;
      (out[locale] ??= {})[stem] = { where: path.replace('/src/content/', ''), data: parse(raw) };
    }
  }
  return out;
}

/** Load one YAML file that is not split by locale, e.g. the term registry. */
export function loadYamlFile(relPath: string): YamlFile | undefined {
  const raw = rawFiles[`/src/content/${relPath}`];
  return raw === undefined ? undefined : { where: relPath, data: parse(raw) };
}

/**
 * Load a base file plus any shards matching a `*` pattern, in a stable
 * order: the base first, then the shards by name.
 */
export function loadYamlFiles(basePath: string, shardPattern: string): YamlFile[] {
  const [prefix, suffix] = shardPattern.split('*');
  const out: YamlFile[] = [];
  const base = loadYamlFile(basePath);
  if (base) out.push(base);
  const shards = Object.keys(rawFiles)
    .map((path) => path.replace('/src/content/', ''))
    .filter((rel) => rel !== basePath && rel.startsWith(prefix) && rel.endsWith(suffix))
    .sort();
  for (const rel of shards) {
    const file = loadYamlFile(rel);
    if (file) out.push(file);
  }
  return out;
}
