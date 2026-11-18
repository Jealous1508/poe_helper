import { describe, expect, it } from 'vitest';
import { leagues } from '../src/config/leagues';
import {
  allPoints,
  checkFollowUps,
  getUpdates,
  leagueDay,
  parseUpdate,
  sortUpdates,
  updatesFor,
  type Update,
} from '../src/lib/updates';

const ctx = { changelogIds: new Set(['league-fates']), buildSlugs: new Set(['toxic-rain-pathfinder']) };
const data = (extra: Record<string, unknown> = {}) => ({
  date: '2026-11-14',
  kind: 'hotfix',
  status: 'live',
  title: '3.30.0 Hotfix',
  headline: 'A fix',
  summary: 'What it fixed.',
  points: [{ kind: 'fix', text: 'A crash.' }],
  source: { title: '3.30.0 Hotfix', url: 'https://www.pathofexile.com/forum/view-thread/1' },
  verified: '2026-11-18',
  ...extra,
});
const file = (extra: Record<string, unknown> = {}, where = 'updates/3.30/en/x.yaml') => ({ where, data: data(extra) });
const parse = (id: string, extra: Record<string, unknown> = {}) => parseUpdate(id, file(extra), ctx);

describe('parseUpdate', () => {
  it('takes the id from the file name and fills the defaults', () => {
    const update = parse('2026-11-14-hotfix-1');
    expect(update.id).toBe('2026-11-14-hotfix-1');
    expect(update.order).toBe(1);
    expect(update.entries).toEqual([]);
    expect(update.builds).toEqual([]);
  });

  it('rejects a file name that is not a date and a slug', () => {
    expect(() => parse('hotfix-1')).toThrow(/yyyy-mm-dd/);
  });

  it('rejects a file whose name and date field disagree, naming the file', () => {
    expect(() => parse('2026-11-15-hotfix-1')).toThrow(/updates\/3\.30\/en\/x\.yaml.*2026-11-15.*2026-11-14/);
  });

  it('rejects a link to a changelog entry or a build that does not exist', () => {
    expect(() => parse('2026-11-14-a', { entries: ['nonsense'] })).toThrow(/changelog entry "nonsense"/);
    expect(() => parse('2026-11-14-a', { builds: ['nonsense'] })).toThrow(/build "nonsense"/);
    expect(() => parse('2026-11-14-a', { entries: ['league-fates'], builds: ['toxic-rain-pathfinder'] })).not.toThrow();
  });

  it('rejects an expected date on something that is already in the game', () => {
    expect(() => parse('2026-11-14-a', { eta: 'Later this week' })).toThrow(/live update has no eta/);
    expect(() => parse('2026-11-14-a', { status: 'announced', kind: 'announcement', eta: 'Later this week' })).not.toThrow();
  });

  it('rejects an unknown kind, status or point kind, and a source that is not https', () => {
    expect(() => parse('2026-11-14-a', { kind: 'rumour' })).toThrow(/kind/);
    expect(() => parse('2026-11-14-a', { status: 'maybe' })).toThrow(/status/);
    expect(() => parse('2026-11-14-a', { points: [{ kind: 'great', text: 'x' }] })).toThrow(/points/);
    expect(() => parse('2026-11-14-a', { source: { title: 'x', url: 'http://example.com' } })).toThrow(/https/);
  });
});

describe('ordering and lookups', () => {
  const a = parse('2026-11-14-a', { order: 1 });
  const b = parse('2026-11-14-b', { order: 2 });
  const c = parseUpdate('2026-11-16-c', file({ date: '2026-11-16', entries: ['league-fates'] }), ctx);

  it('puts the newest day first, and the later post first within a day', () => {
    expect(sortUpdates([a, c, b]).map((u) => u.id)).toEqual(['2026-11-16-c', '2026-11-14-b', '2026-11-14-a']);
  });

  it('finds the updates that touch a changelog entry or a build', () => {
    expect(updatesFor([a, b, c], { entry: 'league-fates' }).map((u) => u.id)).toEqual(['2026-11-16-c']);
    expect(updatesFor([a, b, c], { build: 'toxic-rain-pathfinder' })).toEqual([]);
  });

  it('counts launch day as day 1', () => {
    expect(leagueDay('2026-11-13', '2026-11-13')).toBe(1);
    expect(leagueDay('2026-11-18', '2026-11-13')).toBe(6);
  });

  it('accepts a follow-up that points at a later update, and nothing else', () => {
    const follows = (target: string, extra: Record<string, unknown> = {}) =>
      parse('2026-11-14-z', { order: 1, points: [{ kind: 'info', text: 'A plan.', followUp: target }], ...extra });
    expect(() => checkFollowUps([follows('2026-11-16-c'), c])).not.toThrow();
    expect(() => checkFollowUps([follows('2026-11-14-b'), b])).not.toThrow();
    expect(() => checkFollowUps([follows('2026-11-20-nothing'), c])).toThrow(/is not an update/);
    expect(() => checkFollowUps([follows('2026-11-14-a', { order: 2 }), a])).toThrow(/not later/);
  });
});

/** What must not differ between the two languages of one update. */
function facts(update: Update) {
  const shape = (points: Update['points']) => points.map((p) => [p.kind, p.followUp ?? null]);
  const terms = (JSON.stringify([update.summary, update.meaning, allPoints(update)]).match(/\[\[[^\]]+\]\]/g) ?? []).sort();
  return {
    date: update.date,
    order: update.order,
    kind: update.kind,
    status: update.status,
    title: update.title,
    hasEta: Boolean(update.eta),
    hasMeaning: Boolean(update.meaning),
    points: shape(update.points),
    sections: (update.sections ?? []).map((section) => shape(section.points)),
    entries: update.entries,
    builds: update.builds,
    official: update.official,
    source: update.source,
    verified: update.verified,
    terms,
  };
}

describe('the published updates', () => {
  for (const league of leagues) {
    const en = getUpdates(league.id, 'en').updates;
    const vi = getUpdates(league.id, 'vi').updates;

    it(`${league.id}: every update is translated`, () => {
      expect(vi.filter((u) => u.isFallback).map((u) => u.id)).toEqual([]);
    });

    it(`${league.id}: the two languages describe every update with the same facts`, () => {
      expect(vi.map((u) => u.id)).toEqual(en.map((u) => u.id));
      for (const [index, update] of en.entries()) {
        expect(facts(vi[index]), update.id).toEqual(facts(update));
      }
    });

    it(`${league.id}: nothing is dated before launch or after the day it was checked`, () => {
      for (const update of en) {
        expect(update.date >= league.launchDate, update.id).toBe(true);
        expect(update.verified >= update.date, update.id).toBe(true);
      }
    });

    it(`${league.id}: a developer post is never marked as a patch that shipped`, () => {
      // An announcement can describe changes that are already live, but the
      // post itself is words, and what it promises is tracked by follow-ups.
      for (const update of en) {
        if (update.kind === 'announcement') expect(update.status, update.id).toBe('announced');
        else expect(update.status, update.id).toBe('live');
      }
    });
  }
});
