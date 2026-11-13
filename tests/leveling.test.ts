import { describe, expect, it } from 'vitest';
import { getActs, getOverview, parseAct } from '../src/lib/leveling';

const node = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Zone ${id}`,
  kind: 'zone',
  tag: 'travel',
  summary: 'Walk through.',
  ...extra,
});
const act = (nodes: unknown[], extra: Record<string, unknown> = {}) => ({
  number: 1,
  title: 'Act 1',
  town: 'Town',
  levelIn: 1,
  levelOut: 13,
  skillPoints: 2,
  boss: 'Boss',
  keyRewards: ['A flask'],
  intro: 'Intro.',
  nodes,
  sections: [],
  ...extra,
});
const file = (data: unknown) => ({ where: 'leveling/3.30/en/act-1.yaml', data });

describe('parseAct', () => {
  it('accepts a main route with a side branch off an earlier node', () => {
    const parsed = parseAct('act-1', file(act([node('a'), node('b', { kind: 'side', tag: 'worth', branchFrom: 'a' }), node('c')])), '3.30');
    expect(parsed.slug).toBe('act-1');
    expect(parsed.nodes).toHaveLength(3);
  });

  it('rejects a side node without branchFrom', () => {
    expect(() => parseAct('act-1', file(act([node('a'), node('b', { kind: 'side' })])), '3.30')).toThrow(/branchFrom/);
  });

  it('rejects branchFrom that points at a later or unknown node', () => {
    expect(() => parseAct('act-1', file(act([node('a', { kind: 'side', branchFrom: 'b' }), node('b')])), '3.30')).toThrow(/branchFrom/);
  });

  it('rejects duplicate node ids', () => {
    expect(() => parseAct('act-1', file(act([node('a'), node('a')])), '3.30')).toThrow(/duplicate/i);
  });

  it('rejects an act that ends at a lower level than it starts', () => {
    expect(() => parseAct('act-1', file(act([node('a')], { levelIn: 13, levelOut: 5 })), '3.30')).toThrow(/level/i);
  });
});

describe('leveling content', () => {
  it('returns the written acts in numeric order, starting at Act 1', () => {
    const acts = getActs('3.30', 'en').acts;
    expect(acts.length).toBeGreaterThan(0);
    expect(acts[0].number).toBe(1);
    expect(acts.map((a) => a.number)).toEqual([...acts.map((a) => a.number)].sort((x, y) => x - y));
    expect(acts.every((a) => a.slug === `act-${a.number}`)).toBe(true);
  });
  it('overview lists ten acts, and every written act is marked available', () => {
    const { overview } = getOverview('3.30', 'en');
    expect(overview.stops).toHaveLength(10);
    const written = new Set(getActs('3.30', 'en').acts.map((a) => a.slug));
    for (const stop of overview.stops) expect(stop.available).toBe(written.has(stop.slug));
  });
  it('falls back to English for Vietnamese', () => {
    expect(getActs('3.30', 'vi').isFallback).toBe(true);
  });
});
