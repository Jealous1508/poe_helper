/**
 * Site-wide settings that are not tied to a league.
 */

/**
 * How people can say thank you.
 *
 * `momo` is a Vietnamese mobile wallet: people send money to a phone
 * number, so the site shows the number and a copy button rather than a
 * link. `url` is for anything link-based you might add later (Ko-fi,
 * Buy Me a Coffee, PayPal). Either can be empty; the note shows whatever
 * is set.
 */
export const donate = {
  momo: '0969 904 771',
  url: '',
};

export const hasDonate = donate.momo.trim().length > 0 || donate.url.trim().length > 0;
