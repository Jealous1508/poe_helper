import { describe, expect, it } from 'vitest';
import { getChangelog, parseChangelog } from '../src/lib/changelog';
import { getImage } from '../src/lib/images';

const entry = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  category: 'endgame',
  verdict: 'rework',
  title: 'A change',
  summary: 'What changed.',
  image: 'chaos-orb',
  impact: { meaning: 'What it means.', confidence: 'confirmed' },
  official: ['The official line.'],
  ...extra,
});
const file = (data: unknown, where = 'changelog/x.yaml') => ({ where, data });

describe('parseChangelog', () => {
  it('takes the section from the file name and keeps file order', () => {
    const entries = parseChangelog({
      big: file([entry('a'), entry('b')]),
      small: file([entry('c')]),
      new: file([entry('d')]),
    });
    expect(entries.map((e) => `${e.section}:${e.id}`)).toEqual(['big:a', 'big:b', 'small:c', 'new:d']);
  });

  it('rejects an entry without an impact explanation, naming the file', () => {
    const broken = entry('a', { impact: { confidence: 'confirmed' } });
    expect(() => parseChangelog({ big: file([broken], 'changelog/3.30/en/big.yaml') })).toThrow(/changelog\/3\.30\/en\/big\.yaml/);
  });

  it('rejects duplicate ids across files', () => {
    expect(() => parseChangelog({ big: file([entry('same')]), small: file([entry('same')]) })).toThrow(/duplicate.*same/i);
  });

  it('rejects an unknown category', () => {
    expect(() => parseChangelog({ big: file([entry('a', { category: 'nonsense' })]) })).toThrow();
  });
});

describe('getChangelog', () => {
  it('serves the same entries in Vietnamese, translated or fallen back', () => {
    const en = getChangelog('3.30', 'en');
    const vi = getChangelog('3.30', 'vi');
    expect(vi.entries.map((e) => e.id)).toEqual(en.entries.map((e) => e.id));
    expect(en.isFallback).toBe(false);
  });

  it('has entries in all three sections, each with a downloaded image', () => {
    const { entries } = getChangelog('3.30', 'en');
    for (const section of ['big', 'small', 'new']) {
      expect(entries.some((e) => e.section === section)).toBe(true);
    }
    for (const e of entries) expect(() => getImage(e.image, e.id)).not.toThrow();
  });
});
