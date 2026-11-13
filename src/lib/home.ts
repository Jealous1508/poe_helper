import { z } from 'zod';
import type { Locale } from '../i18n';
import { loadYamlDir, resolveLocale } from './content';

const schema = z
  .object({
    intro: z.string().min(1),
    highlights: z.array(
      z.object({
        title: z.string().min(1),
        text: z.string().min(1),
        section: z.enum(['changelog', 'builds', 'leveling']),
      }).strict(),
    ),
  })
  .strict();

export type Home = z.infer<typeof schema>;

export function getHome(league: string, locale: Locale): { home: Home; where: string; isFallback: boolean } {
  const { data, isFallback } = resolveLocale(loadYamlDir('home', league), locale);
  const file = data.home;
  if (!file) throw new Error(`home/${league}: missing home.yaml`);
  const parsed = schema.safeParse(file.data);
  if (!parsed.success) throw new Error(`${file.where}: ${parsed.error.message}`);
  return { home: parsed.data, where: file.where, isFallback };
}
