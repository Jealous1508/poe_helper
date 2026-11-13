import manifest from '../data/images.json';
import { assetPath } from '../i18n';

export interface ImageInfo {
  /** Path under public/, e.g. "img/3.30/abyss-thread.webp". */
  file: string;
  source: string;
  width: number;
  height: number;
  credit?: string;
}

const images = manifest as Record<string, Partial<ImageInfo>>;

/** Look up a downloaded image. Throws naming the content file if it is missing. */
export function getImage(id: string, where: string): ImageInfo {
  const entry = images[id];
  if (!entry) throw new Error(`${where}: unknown image id "${id}". Add it to src/data/images.json and run "npm run images".`);
  if (!entry.file || !entry.width || !entry.height || !entry.source) {
    throw new Error(`${where}: image "${id}" is in the manifest but not downloaded. Run "npm run images".`);
  }
  return entry as ImageInfo;
}

/** URL of a downloaded image, for use in src attributes. */
export function imageUrl(id: string, where: string): string {
  return assetPath(getImage(id, where).file);
}
