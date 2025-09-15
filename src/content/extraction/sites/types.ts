import type { ExtractedContent } from '@/types/extraction';

export interface SiteExtractorPlugin {
  id: string;
  matches: (doc: Document) => boolean;
  extract: (
    doc: Document,
    options: { includeLinks?: boolean }
  ) => Promise<ExtractedContent | null> | ExtractedContent | null;
}
