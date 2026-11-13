import en from './en.json';
import vi from './vi.json';

export const locales = ['en', 'vi'] as const;
export type Locale = (typeof locales)[number];

/**
 * Where `/` sends a reader who has not chosen a language.
 *
 * Vietnamese, because that is who the site is for. English is still the
 * language every page is written in first, and the one a missing
 * translation falls back to — that is a separate job from this one.
 */
export const defaultLocale: Locale = 'vi';

export const localeNames: Record<Locale, string> = { en: 'English', vi: 'Tiếng Việt' };

const dictionaries: Record<Locale, Record<string, string>> = { en, vi };

/** UI string lookup. Falls back to English, then to the key itself. */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let text = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function base(): string {
  const b = import.meta.env.BASE_URL ?? '/';
  return b.endsWith('/') ? b : `${b}/`;
}

/** Base-aware internal URL, always with a trailing slash. */
export function pagePath(locale: Locale, league: string, ...segments: string[]): string {
  return `${base()}${[locale, league, ...segments].join('/')}/`;
}

/** Base-aware URL for a file in `public/`. */
export function assetPath(file: string): string {
  return `${base()}${file.replace(/^\//, '')}`;
}

/** Same page in another language. */
export function switchLocalePath(pathname: string, target: Locale): string {
  const b = base();
  const rest = pathname.startsWith(b) ? pathname.slice(b.length) : pathname.replace(/^\//, '');
  const parts = rest.split('/');
  if ((locales as readonly string[]).includes(parts[0])) parts[0] = target;
  else parts.unshift(target);
  return `${b}${parts.join('/')}`;
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
