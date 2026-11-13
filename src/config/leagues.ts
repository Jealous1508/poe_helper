export interface League {
  /** Version string used in URLs and content folders, e.g. "3.30". */
  id: string;
  name: string;
  /** ISO date of the league launch. */
  launchDate: string;
  patchNotesUrl: string;
  officialUrl: string;
}

/** Newest league first. Add a new entry here when a league launches. */
export const leagues: League[] = [
  {
    id: '3.30',
    name: 'Covens of Umbra',
    launchDate: '2026-11-13',
    patchNotesUrl: 'https://www.pathofexile.com/forum/view-thread/4013680',
    officialUrl: 'https://www.pathofexile.com/covens',
  },
];

export const currentLeague: League = leagues[0];

export function getLeague(id: string): League {
  const league = leagues.find((l) => l.id === id);
  if (!league) throw new Error(`Unknown league "${id}"`);
  return league;
}
