import { parse } from 'yaml';
import { locales, type Locale } from '../i18n';

export interface Resolved<T> {
  data: T;
  locale: Locale;
  isFallback: boolean;
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
