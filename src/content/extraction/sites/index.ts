import type { ExtractedContent } from '@/types/extraction';
import type { SiteExtractorPlugin } from './types';

// Auto-load any site plugins ending with .plugin.ts under this folder (Vite only)
// Users can add/remove site plugins by creating/removing files that default-export a plugin.
const modules = import.meta.glob('./**/*.plugin.ts', { eager: true }) as Record<
  string,
  { default?: SiteExtractorPlugin }
>;
// User-managed plugins outside the repo (gitignored). Load all .ts files from site-plugins/
const userModules = import.meta.glob('/site-plugins/**/*.ts', { eager: true }) as Record<
  string,
  { default?: SiteExtractorPlugin }
>;

export const sitePlugins: SiteExtractorPlugin[] = [];
for (const key of Object.keys(modules)) {
  const mod = modules[key];
  if (mod && mod.default) sitePlugins.push(mod.default);
}
for (const key of Object.keys(userModules)) {
  const mod = userModules[key];
  if (mod && mod.default) sitePlugins.push(mod.default);
}

export async function trySitePlugins(
  doc: Document,
  options: { includeLinks?: boolean }
): Promise<ExtractedContent | null> {
  for (const plugin of sitePlugins) {
    try {
      if (!plugin.matches(doc)) continue;
      const result = await plugin.extract(doc, options);
      if (result) return result;
    } catch (e) {
      // Fail-soft: continue to next plugin
      if (typeof console !== 'undefined' && import.meta.env.DEV) {
        console.warn('[SitePlugin]', plugin.id, 'failed:', e);
      }
    }
  }
  return null;
}

export type { SiteExtractorPlugin } from './types';
