import { describe, expect, it } from 'vitest';
import { resolveLocale } from '../src/lib/content';

describe('resolveLocale', () => {
  it('falls back to English and says so', () => {
    expect(resolveLocale({ en: 1 }, 'vi')).toEqual({ data: 1, locale: 'en', isFallback: true });
  });
  it('uses the wanted locale when present', () => {
    expect(resolveLocale({ en: 1, vi: 2 }, 'vi')).toEqual({ data: 2, locale: 'vi', isFallback: false });
  });
  it('throws when there is no English content either', () => {
    expect(() => resolveLocale({}, 'en')).toThrow();
  });
});
