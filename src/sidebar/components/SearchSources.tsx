import React from 'react';
import { Collapsible } from '@ui/Collapsible';

interface SearchSource {
  title?: string;
  url: string;
  snippet?: string;
}

interface SearchSourcesProps {
  sources: SearchSource[];
  className?: string;
}

export const SearchSources: React.FC<SearchSourcesProps> = ({ sources, className = '' }) => {
  if (!sources || sources.length === 0) return null;

  const getDisplayLabel = (source: SearchSource): string => {
    if (source.title && source.title.trim().length > 0) {
      return source.title.trim();
    }
    try {
      const parsed = new URL(source.url);
      return parsed.hostname.replace(/^www\./i, '') || source.url;
    } catch {
      return source.url;
    }
  };

  return (
    <div className={`search-sources ${className}`}>
      <Collapsible
        header={`Sources (${sources.length})`}
        initialCollapsed={true}
        headerClassName="search-sources-summary"
        contentClassName="search-sources-list"
        showChevron={false}
      >
        {sources.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="search-source-link"
            title={source.title && source.title.trim().length > 0 ? source.title : source.url}
          >
            {getDisplayLabel(source)}
          </a>
        ))}
      </Collapsible>
    </div>
  );
};

export default SearchSources;
