import { marked } from 'marked';
import type { Term } from './terms';

export type IconResolver = (imageId: string) => string | undefined;

const TERM = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
}

/** Only links that go somewhere safe survive. */
function isSafeHref(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  if (/^(https?:|mailto:)/.test(trimmed)) return true;
  // Relative links and fragments have no scheme at all.
  return !/^[a-z][a-z0-9+.-]*:/.test(trimmed);
}

function render(text: string, terms: Map<string, Term>, where: string, resolveIcon: IconResolver | undefined, inline: boolean): string {
  const chips: string[] = [];
  // Terms come out of the raw text first, so a name or label containing "&"
  // is matched and rendered exactly once.
  const withTokens = text.replace(TERM, (_match, rawName: string, rawLabel?: string) => {
    const name = rawName.trim();
    const term = terms.get(name.toLowerCase());
    if (!term) throw new Error(`${where}: unknown game term "[[${name}]]". Add it to the term registry or fix the spelling.`);
    const label = escapeHtml((rawLabel ?? term.name).trim());
    const src = term.image && resolveIcon ? resolveIcon(term.image) : undefined;
    const icon = src ? `<img class="term__icon" src="${escapeHtml(src)}" alt="" width="20" height="20" loading="lazy" decoding="async" />` : '';
    chips.push(`<span class="term term--${term.kind}">${icon}${label}</span>`);
    return `@@TERM${chips.length - 1}@@`;
  });
  // Raw HTML in content is never trusted: neutralise tags before Markdown runs.
  const safe = withTokens.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  const html = (inline ? marked.parseInline(safe) : marked.parse(safe)) as string;
  return html
    .replace(/<a href="([^"]*)"/g, (match, href: string) =>
      isSafeHref(href) ? (/^https?:/i.test(href.trim()) ? `<a href="${href}" rel="noopener" target="_blank"` : match) : '<a',
    )
    .replace(/@@TERM(\d+)@@/g, (_m, i: string) => chips[Number(i)]);
}

/** Markdown plus [[Game Term]] chips, as block HTML. Throws on an unknown term. */
export function renderRich(text: string, terms: Map<string, Term>, where: string, resolveIcon?: IconResolver): string {
  return render(text, terms, where, resolveIcon, false);
}

/** Same as renderRich but without a wrapping paragraph, for one-line fields. */
export function renderRichInline(text: string, terms: Map<string, Term>, where: string, resolveIcon?: IconResolver): string {
  return render(text, terms, where, resolveIcon, true);
}
