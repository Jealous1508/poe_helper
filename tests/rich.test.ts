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
});
