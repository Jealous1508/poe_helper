import { describe, expect, it } from 'vitest';
import { renderRich } from '../src/lib/rich';
import { getTerms, type Term } from '../src/lib/terms';

const terms = new Map<string, Term>([['toxic rain', { name: 'Toxic Rain', kind: 'gem' }]]);

describe('renderRich', () => {
  it('renders a known term as a coloured chip', () => {
    expect(renderRich('Use [[Toxic Rain]] early.', terms, 'x')).toContain('<span class="term term--gem">Toxic Rain</span>');
  });
  it('matches terms case-insensitively and supports a custom label', () => {
    expect(renderRich('[[toxic rain|TR]]', terms, 'x')).toContain('>TR</span>');
  });
  it('renders Markdown emphasis and links', () => {
    expect(renderRich('**bold** and [link](https://a.b)', terms, 'x')).toMatch(/<strong>bold<\/strong>.*<a href="https:\/\/a\.b"/s);
  });
  it('opens external links in a new tab safely', () => {
    expect(renderRich('[link](https://a.b)', terms, 'x')).toContain('rel="noopener"');
  });
  it('fails loudly on an unknown term, naming the file and the term', () => {
    expect(() => renderRich('[[Nope]]', terms, 'builds/x.yaml')).toThrow(/builds\/x\.yaml.*Nope/);
  });
  it('escapes raw HTML in the source text', () => {
    expect(renderRich('<script>x</script>', terms, 'x')).not.toContain('<script>');
  });

  it('renders an ampersand in a term label once, not double-escaped', () => {
    const html = renderRich('[[Toxic Rain|pods & spores]]', terms, 'x');
    expect(html).toContain('>pods &amp; spores</span>');
    expect(html).not.toContain('&amp;amp;');
  });

  it('renders an ampersand in ordinary text once', () => {
    expect(renderRich('life & mana', terms, 'x')).not.toContain('&amp;amp;');
  });

  it('refuses a javascript: link', () => {
    const html = renderRich('[click](javascript:alert(1))', terms, 'x');
    expect(html).not.toContain('javascript:');
  });

  it('keeps ordinary relative and http links', () => {
    expect(renderRich('[a](https://a.b)', terms, 'x')).toContain('href="https://a.b"');
    expect(renderRich('[a](/en/3.30/)', terms, 'x')).toContain('href="/en/3.30/"');
  });
  it('adds an icon when the term has an image and a resolver is given', () => {
    const withIcon = new Map<string, Term>([['chaos orb', { name: 'Chaos Orb', kind: 'currency', image: 'chaos-orb' }]]);
    const html = renderRich('[[Chaos Orb]]', withIcon, 'x', (id) => `/img/${id}.webp`);
    expect(html).toContain('<img class="term__icon" src="/img/chaos-orb.webp"');
  });
});

describe('getTerms', () => {
  it('loads the league registry keyed by lower-cased name', () => {
    const registry = getTerms('3.30');
    expect(registry.get('toxic rain')).toMatchObject({ name: 'Toxic Rain', kind: 'gem' });
  });
  it('throws for a league with no registry', () => {
    expect(() => getTerms('0.0')).toThrow(/0\.0/);
  });

  it('merges extra registry files so several writers can add terms at once', () => {
    // Terms live in 3.30.yaml plus any 3.30.<name>.yaml shard. Two people
    // adding terms in parallel would otherwise overwrite each other.
    const registry = getTerms('3.30');
    expect(registry.size).toBeGreaterThan(100);
    // Every term still resolves by lower-cased name, whichever file it came from.
    for (const [key, term] of registry) expect(key).toBe(term.name.toLowerCase());
  });
});

describe('reference links', () => {
  const linked = new Map<string, Term>([['chaos orb', { name: 'Chaos Orb', kind: 'currency', image: 'chaos-orb' }]]);
  const ref = (term: Term) => (term.image ? `https://poedb.tw/us/${term.name.replace(/\s+/g, '_')}` : undefined);

  it('turns a term with a reference page into a link that opens away from the guide', () => {
    const html = renderRich('[[Chaos Orb]]', linked, 'x', undefined, ref);
    expect(html).toContain('href="https://poedb.tw/us/Chaos_Orb"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener nofollow"');
  });

  it('leaves a term with no reference page as plain text, not a dead link', () => {
    const html = renderRich('[[Toxic Rain]]', terms, 'x', undefined, ref);
    expect(html).toContain('<span class="term term--gem">');
    expect(html).not.toContain('<a');
  });

  it('keeps the label when one is given', () => {
    expect(renderRich('[[Chaos Orb|a chaos]]', linked, 'x', undefined, ref)).toContain('>a chaos</a>');
  });
});
