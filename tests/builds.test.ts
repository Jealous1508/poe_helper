import { describe, expect, it } from 'vitest';
import { getBuilds, parseBuild } from '../src/lib/builds';

const base = () => ({
  name: 'Test Build',
  class: 'Ranger',
  ascendancy: 'Pathfinder',
  role: 'starter',
  budget: 'starter',
  mainSkill: 'Toxic Rain',
  image: 'toxic-rain',
  tags: ['bow'],
  ratings: { clear: 4, bossing: 3, survivability: 3, ease: 5 },
  verified: '2026-11-13',
  confidence: 'proven',
  modes: { ssf: 'Works.', hardcore: 'Risky.' },
  idea: 'The idea.',
  chain: [{ label: 'Skill', text: 'Does a thing.' }],
  mandatory: [{ term: 'Toxic Rain', why: 'It is the skill.' }],
  stages: [{ id: 'acts-1-3', title: 'Acts 1–3', levels: '1–33', uses: 'Stuff.', changes: 'Things.', moveOn: 'Level 12.', details: [] }],
  patch: [{ entry: 'pathfinder-flask-changes', note: 'A note.' }],
  strengths: ['Fast'],
  weaknesses: ['Squishy'],
  avoidIf: 'You hate bows.',
  sources: [{ title: 'Guide', url: 'https://example.com', kind: 'guide' }],
});
const ctx = { league: '3.30', changelogIds: new Set(['pathfinder-flask-changes']) };
const file = (data: unknown) => ({ where: 'builds/3.30/en/test-build.yaml', data });

describe('parseBuild', () => {
  it('accepts a complete build and takes the slug from the file name', () => {
    expect(parseBuild('test-build', file(base()), ctx).slug).toBe('test-build');
  });

  it('rejects ratings outside 1 to 5', () => {
    const bad = { ...base(), ratings: { clear: 6, bossing: 3, survivability: 3, ease: 5 } };
    expect(() => parseBuild('test-build', file(bad), ctx)).toThrow(/test-build\.yaml/);
  });

  it('rejects a patch link to a changelog entry that does not exist', () => {
    const bad = { ...base(), patch: [{ entry: 'no-such-entry', note: 'x' }] };
    expect(() => parseBuild('test-build', file(bad), ctx)).toThrow(/no-such-entry/);
  });

  it('rejects a mandatory piece that is not in the term registry', () => {
    const bad = { ...base(), mandatory: [{ term: 'Made Up Item', why: 'x' }] };
    expect(() => parseBuild('test-build', file(bad), ctx)).toThrow(/Made Up Item/);
  });

  it('rejects a source without an http link', () => {
    const bad = { ...base(), sources: [{ title: 'x', url: 'not a url', kind: 'guide' }] };
    expect(() => parseBuild('test-build', file(bad), ctx)).toThrow();
  });
});

describe('getBuilds', () => {
  it('loads at least one starter build for 3.30', () => {
    const { builds } = getBuilds('3.30', 'en');
    expect(builds.some((b) => b.role === 'starter')).toBe(true);
  });
  it('serves every build in Vietnamese too, translated or fallen back', () => {
    const en = getBuilds('3.30', 'en').builds.map((x) => x.slug);
    const vi = getBuilds('3.30', 'vi').builds.map((x) => x.slug);
    expect(vi).toEqual(en);
  });
});
