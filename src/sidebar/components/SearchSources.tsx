import React, { useState } from 'react';

interface SearchSource {
  title: string;
  url: string;
}

interface SearchSourcesProps {
  sources: SearchSource[];
  className?: string;
}

export const SearchSources: React.FC<SearchSourcesProps> = ({ sources, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!sources || sources.length === 0) return null;

  return (
    <div className={`search-sources ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="search-sources-summary"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} sources`}
      >
        Sources ({sources.length})
      </button>
      <div style={{ display: isExpanded ? 'block' : 'none' }}>
        <div className="search-sources-list">
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
        </div>
      </div>
    </div>
  );
};

export default SearchSources;
