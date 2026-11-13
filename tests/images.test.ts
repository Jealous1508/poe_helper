import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import manifest from '../src/data/images.json';
import { getImage, getMedia } from '../src/lib/images';

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

describe('getMedia', () => {
  it('returns a video entry, which has no pixel dimensions', () => {
    const video = getMedia('league-hero-video', 'test');
    expect(video.file).toMatch(/^video\/.+\.webm$/);
    expect(video.source).toMatch(/^https:\/\//);
  });
  it('fails loudly on an unknown id, naming the file and the id', () => {
    expect(() => getMedia('missing-video', 'home/home.yaml')).toThrow(/home\/home\.yaml.*missing-video/);
  });
  it('rejects an entry that is in the manifest but not downloaded', async () => {
    // Mocked rather than seeded into the real manifest, which must only ever
    // contain entries that are actually on disk.
    vi.resetModules();
    vi.doMock('../src/data/images.json', () => ({
      default: { pending: { source: 'https://example.com/clip.webm', video: true } },
    }));
    const { getMedia: mocked } = await import('../src/lib/images');
    expect(() => mocked('pending', 'home/home.yaml')).toThrow(/home\/home\.yaml.*not downloaded/);
    vi.doUnmock('../src/data/images.json');
    vi.resetModules();
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
