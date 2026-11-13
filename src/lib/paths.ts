import { leagues } from '../config/leagues';
import { locales } from '../i18n';

/** getStaticPaths params for every locale × league pair. */
export function leaguePaths() {
  return locales.flatMap((locale) => leagues.map((league) => ({ params: { locale, league: league.id } })));
}
