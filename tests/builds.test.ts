import { describe, expect, it } from 'vitest';
import { budgets, getBuilds, parseBuild, stagePhase } from '../src/lib/builds';

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

  // Alphabetical order tells a reader nothing. A new player reads the
  // starter list from the top, so the gentlest build belongs there; the
  // endgame list is read by budget, so it starts at the cheapest.
  it('lists starters easiest first', () => {
    const eases = getBuilds('3.30', 'en').builds.filter((b) => b.role === 'starter').map((b) => b.ratings.ease);
    expect(eases).toEqual([...eases].sort((a, b) => b - a));
  });

  it('lists endgame builds cheapest first', () => {
    const ranks = getBuilds('3.30', 'en').builds.filter((b) => b.role === 'endgame').map((b) => budgets.indexOf(b.budget));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('breaks a tie by name, so the order never wobbles between builds', () => {
    const starters = getBuilds('3.30', 'en').builds.filter((b) => b.role === 'starter');
    for (let i = 1; i < starters.length; i += 1) {
      const prev = starters[i - 1];
      const here = starters[i];
      if (prev.ratings.ease === here.ratings.ease) expect(prev.name.localeCompare(here.name)).toBeLessThan(0);
    }
  });
});

describe('the two languages', () => {
  // A translation drifts silently: nothing fails when a Vietnamese file ends
  // up with a different ascendancy, a gem the English does not list, or a
  // rating nobody meant to change. These fields are keys and data rather
  // than prose, so they have to match, and this is the only thing that
  // notices when they stop.
  const keys = ['class', 'ascendancy', 'role', 'budget', 'mainSkill', 'image', 'hero', 'verified', 'confidence'] as const;
  const names = (value: unknown) =>
    [...new Set([...JSON.stringify(value).matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1].toLowerCase()))].sort();

  it('describe every build with the same facts', () => {
    const en = getBuilds('3.30', 'en').builds;
    const vi = getBuilds('3.30', 'vi').builds;
    expect(vi.map((b) => b.slug)).toEqual(en.map((b) => b.slug));

    for (const [i, build] of en.entries()) {
      const other = vi[i];
      if (other.isFallback) continue; // not translated yet; English is shown as-is
      for (const key of keys) expect(other[key], `${build.slug}.${key}`).toEqual(build[key]);
      expect(other.ratings, `${build.slug}.ratings`).toEqual(build.ratings);
      expect(other.mandatory.map((m) => [m.term, m.level]), `${build.slug}.mandatory`).toEqual(build.mandatory.map((m) => [m.term, m.level]));
      expect(other.stages.map((s) => [s.id, s.image, s.links?.map((l) => l.gems)]), `${build.slug}.stages`).toEqual(build.stages.map((s) => [s.id, s.image, s.links?.map((l) => l.gems)]));
      expect(other.patch.map((p) => p.entry), `${build.slug}.patch`).toEqual(build.patch.map((p) => p.entry));
      expect(other.sources.map((s) => [s.url, s.kind]), `${build.slug}.sources`).toEqual(build.sources.map((s) => [s.url, s.kind]));
      // Game terms are registry keys, so both languages must name the same
      // ones; which words wrap them is the translator's business.
      expect(names(other), `${build.slug} terms`).toEqual(names(build));
      // labs[].node is deliberately not compared: a couple of them are
      // sentences rather than notable names ("the other of the two"), and
      // those read as nonsense left in English.
      expect(other.labs?.map((l) => l.lab), `${build.slug}.labs order`).toEqual(build.labs?.map((l) => l.lab));
      // The endgame sections: a translation has the same ones, the same
      // length, and puts every stage in the same half of the article.
      expect(other.stages.map(stagePhase), `${build.slug}.stage phases`).toEqual(build.stages.map(stagePhase));
      expect(Boolean(other.powerCurve), `${build.slug}.powerCurve`).toEqual(Boolean(build.powerCurve));
      expect(Boolean(other.play), `${build.slug}.play`).toEqual(Boolean(build.play));
      expect(other.upgrades?.length, `${build.slug}.upgrades`).toEqual(build.upgrades?.length);
      expect(other.deaths?.length, `${build.slug}.deaths`).toEqual(build.deaths?.length);
      expect(other.troubleshooting?.length, `${build.slug}.troubleshooting`).toEqual(build.troubleshooting?.length);
    }
  });
});

describe('stagePhase', () => {
  const stage = (id: string, phase?: 'early' | 'endgame') =>
    ({ id, phase, title: 't', levels: 'l', uses: 'u', changes: 'c', moveOn: 'm', details: [] }) as Parameters<typeof stagePhase>[0];

  it('puts the acts and the first maps in the early half', () => {
    for (const id of ['acts-1-3', 'acts-4-10', 'acts-1-12', 'early-maps', 'getting-the-gem']) expect(stagePhase(stage(id)), id).toBe('early');
  });
  it('puts red maps and everything after in the endgame half', () => {
    for (const id of ['red-maps', 'endgame', 'transition-in', 'mageblood', 'min-max']) expect(stagePhase(stage(id)), id).toBe('endgame');
  });
  it('lets a stage say for itself', () => {
    expect(stagePhase(stage('red-maps', 'early'))).toBe('early');
    expect(stagePhase(stage('acts-1-3', 'endgame'))).toBe('endgame');
  });
});
