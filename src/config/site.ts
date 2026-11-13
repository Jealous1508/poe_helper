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

/**
 * The owner's own wording for the Vietnamese version of the donate note,
 * kept here so the translation pass uses his voice rather than a
 * translation of the English:
 *
 *   "Mình không làm app này để kiếm tiền nhưng nếu bạn mời mình 1 ly cafe,
 *    1 bữa lẩu mình sẽ rất vui"
 */

export const hasDonate = donate.momo.trim().length > 0 || donate.url.trim().length > 0;
