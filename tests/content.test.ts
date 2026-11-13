import { describe, expect, it } from 'vitest';
import { resolveFiles, resolveLocale, type YamlFile } from '../src/lib/content';

const file = (stem: string, locale: string): YamlFile => ({ where: `k/3.30/${locale}/${stem}.yaml`, data: { stem, locale } });

describe('resolveFiles', () => {
  // A translation lands one file at a time. A locale that has some files but
  // not others must still serve every page, falling back per file.
  it('uses the wanted locale per file and English for the rest', () => {
    const { files, fellBack } = resolveFiles(
      { en: { a: file('a', 'en'), b: file('b', 'en') }, vi: { a: file('a', 'vi') } },
      'vi',
    );
    expect(Object.keys(files).sort()).toEqual(['a', 'b']);
    expect(files.a.where).toContain('/vi/');
    expect(files.b.where).toContain('/en/');
    expect(fellBack.has('a')).toBe(false);
    expect(fellBack.has('b')).toBe(true);
  });

  it('serves every English file when the locale has nothing', () => {
    const { files, fellBack } = resolveFiles({ en: { a: file('a', 'en') } }, 'vi');
    expect(Object.keys(files)).toEqual(['a']);
    expect(fellBack.has('a')).toBe(true);
  });

  it('ignores a translated file that English does not have', () => {
    const { files } = resolveFiles({ en: { a: file('a', 'en') }, vi: { a: file('a', 'vi'), ghost: file('ghost', 'vi') } }, 'vi');
    expect(Object.keys(files)).toEqual(['a']);
  });

  it('never reports a fallback when asked for English', () => {
    const { fellBack } = resolveFiles({ en: { a: file('a', 'en') }, vi: { a: file('a', 'vi') } }, 'en');
    expect(fellBack.size).toBe(0);
  });

  it('throws when there is no English content at all', () => {
    expect(() => resolveFiles({}, 'en')).toThrow();
  });
});

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
