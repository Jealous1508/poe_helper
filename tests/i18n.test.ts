import { describe, expect, it } from 'vitest';
import { defaultLocale, locales, pagePath, switchLocalePath, t } from '../src/i18n';

describe('defaultLocale', () => {
  // The site is for Vietnamese players; English is the language it is
  // written in first, which is a different thing. Pinned here because the
  // only place it shows is the redirect from "/", which no test can see.
  it('sends an undecided reader to the Vietnamese pages', () => {
    expect(defaultLocale).toBe('vi');
    expect(locales).toContain(defaultLocale);
    expect(pagePath(defaultLocale, '3.30')).toBe('/vi/3.30/');
  });
});

describe('pagePath', () => {
  it('joins locale, league and segments with a trailing slash', () => {
    expect(pagePath('en', '3.30', 'builds', 'toxic-rain-pathfinder')).toBe('/en/3.30/builds/toxic-rain-pathfinder/');
  });
  it('returns the league home when no segments are given', () => {
    expect(pagePath('vi', '3.30')).toBe('/vi/3.30/');
  });
});

describe('switchLocalePath', () => {
  it('swaps only the locale segment', () => {
    expect(switchLocalePath('/en/3.30/leveling/act-1/', 'vi')).toBe('/vi/3.30/leveling/act-1/');
  });
  it('keeps the path when it is already in the target locale', () => {
    expect(switchLocalePath('/vi/3.30/', 'vi')).toBe('/vi/3.30/');
  });
});

describe('t', () => {
  it('falls back to English when the locale has no translation', () => {
    expect(t('en', 'nav.builds')).toBe('Builds');
    expect(t('vi', 'nav.builds')).toBe('Builds');
  });
  it('returns the key itself when nothing matches', () => {
    expect(t('en', 'no.such.key')).toBe('no.such.key');
  });
});
