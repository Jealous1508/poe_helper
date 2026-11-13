import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../src/data/images.json';
import { getImage } from '../src/lib/images';

describe('getImage', () => {
  it('fails loudly on an unknown id, naming the file and the id', () => {
    expect(() => getImage('missing-id', 'changelog/big.yaml')).toThrow(/changelog\/big\.yaml.*missing-id/);
  });
  it('returns file path and dimensions for a known id', () => {
    const image = getImage('chaos-orb', 'test');
    expect(image.file).toMatch(/^img\/.+\.webp$/);
    expect(image.width).toBeGreaterThan(0);
    expect(image.height).toBeGreaterThan(0);
  });
});

describe('image manifest', () => {
  it('has a downloaded file on disk for every entry', () => {
    const missing = Object.entries(manifest as Record<string, { file?: string }>)
      .filter(([, entry]) => !entry.file || !existsSync(join('public', entry.file)))
      .map(([id]) => id);
    expect(missing).toEqual([]);
  });
});
