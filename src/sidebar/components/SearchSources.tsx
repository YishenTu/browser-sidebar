import React from 'react';
import { Collapsible } from '@ui/Collapsible';

interface SearchSource {
  title: string;
  url: string;
}

interface SearchSourcesProps {
  sources: SearchSource[];
  className?: string;
}

export const SearchSources: React.FC<SearchSourcesProps> = ({ sources, className = '' }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className={`search-sources ${className}`}>
      <Collapsible
        header={`Sources (${sources.length})`}
        initialCollapsed={false}
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
          >
            {source.title}
          </a>
        ))}
      </Collapsible>
    </div>
  );
};

export default SearchSources;
