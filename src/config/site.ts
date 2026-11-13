/**
 * Site-wide settings that are not tied to a league.
 */

/**
 * Where the donate button sends people.
 *
 * Put your own link here — Ko-fi, Buy Me a Coffee, PayPal, MoMo, a bank QR
 * page, whatever you use. Leave it empty and the button still appears, but
 * the note explains that no link is set yet, so nothing on the page is
 * broken while you decide.
 *
 * Example: 'https://ko-fi.com/yourname'
 */
export const donateUrl = '';

/** Shown on the donate button itself. Keep it quiet. */
export const donateIsConfigured = donateUrl.trim().length > 0;
