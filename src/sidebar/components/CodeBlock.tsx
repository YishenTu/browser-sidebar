import React, { useState, useMemo } from 'react';
import '../styles/code-block.css';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

// VS Code dark theme-like syntax highlighting using React elements
const applySyntaxHighlight = (code: string, language?: string): React.ReactNode => {
  // First, handle any HTML entities that might be in the original code
  const textarea = document.createElement('textarea');
  textarea.innerHTML = code;
  const processedCode = textarea.value;

  if (!language) {
    return processedCode;
  }

  const langs: Record<string, Array<{ pattern: RegExp; style: React.CSSProperties }>> = {
    python: [
      {
        pattern:
          /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|with|lambda|pass|break|continue|raise|yield|assert|del|is|not|and|or|in)\b/g,
        style: { color: '#C586C0' },
      }, // Keywords
      { pattern: /(#.*$)/gm, style: { color: '#6A9955' } }, // Comments
      { pattern: /("""[\s\S]*?"""|'''[\s\S]*?''')/g, style: { color: '#6A9955' } }, // Docstrings
      { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, style: { color: '#CE9178' } }, // Strings
      { pattern: /\b(\d+\.?\d*)\b/g, style: { color: '#B5CEA8' } }, // Numbers
      { pattern: /\b(True|False|None)\b/g, style: { color: '#569CD6' } }, // Literals
      {
        pattern:
          /\b(print|len|range|int|str|float|list|dict|set|tuple|open|input|__name__|__main__|self)\b/g,
        style: { color: '#DCDCAA' },
      }, // Built-ins
      { pattern: /\b([A-Z][a-zA-Z0-9_]*)\b/g, style: { color: '#4EC9B0' } }, // Classes
    ],
    javascript: [
      {
        pattern:
          /\b(const|let|var|function|return|if|else|for|while|do|break|continue|switch|case|default|try|catch|finally|throw|new|typeof|instanceof|this|class|extends|import|export|from|async|await|static|get|set)\b/g,
        style: { color: '#C586C0' },
      },
      { pattern: /(\/\/.*$)/gm, style: { color: '#6A9955' } }, // Comments
      { pattern: /(\/\*[\s\S]*?\*\/)/g, style: { color: '#6A9955' } }, // Block comments
      {
        pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        style: { color: '#CE9178' },
      }, // Strings
      { pattern: /\b(\d+\.?\d*)\b/g, style: { color: '#B5CEA8' } }, // Numbers
      { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, style: { color: '#569CD6' } }, // Literals
      {
        pattern:
          /\b(console|window|document|Math|Date|Array|Object|String|Number|Boolean|JSON|Promise)\b/g,
        style: { color: '#DCDCAA' },
      }, // Built-ins
      { pattern: /\b([A-Z][a-zA-Z0-9_]*)\b/g, style: { color: '#4EC9B0' } }, // Classes
    ],
    typescript: [
      {
        pattern:
          /\b(const|let|var|function|return|if|else|for|while|do|break|continue|switch|case|default|try|catch|finally|throw|new|typeof|instanceof|this|class|extends|import|export|from|async|await|interface|type|enum|namespace|declare|abstract|implements|private|protected|public|static|readonly|as|keyof|typeof)\b/g,
        style: { color: '#C586C0' },
      },
      { pattern: /(\/\/.*$)/gm, style: { color: '#6A9955' } },
      { pattern: /(\/\*[\s\S]*?\*\/)/g, style: { color: '#6A9955' } },
      {
        pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        style: { color: '#CE9178' },
      },
      { pattern: /\b(\d+\.?\d*)\b/g, style: { color: '#B5CEA8' } },
      { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, style: { color: '#569CD6' } },
      {
        pattern: /\b(string|number|boolean|void|any|never|unknown|object)\b/g,
        style: { color: '#4EC9B0' },
      }, // Types
      { pattern: /\b([A-Z][a-zA-Z0-9_]*)\b/g, style: { color: '#4EC9B0' } },
    ],
  };

  // Add aliases
  langs['js'] = langs['javascript'] || [];
  langs['ts'] = langs['typescript'] || [];
  langs['jsx'] = langs['javascript'] || [];
  langs['tsx'] = langs['typescript'] || [];
  langs['py'] = langs['python'] || [];

  const rules = langs[language.toLowerCase()];
  if (!rules) {
    return processedCode;
  }

  // Create tokens with their styles
  const tokens: Array<{ text: string; style?: React.CSSProperties }> = [];
  let lastIndex = 0;
  const matches: Array<{ start: number; end: number; style: React.CSSProperties; text: string }> =
    [];

  // Collect all matches
  rules.forEach(({ pattern, style }) => {
    // Create a new regex instance to avoid stale lastIndex
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(processedCode)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        style,
        text: match[0],
      });
    }
  });

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Process matches and create tokens (skip overlapping matches)
  matches.forEach(match => {
    // Skip if this match overlaps with previous processed text
    if (match.start < lastIndex) {
      return;
    }
    // Add plain text before this match
    if (lastIndex < match.start) {
      tokens.push({ text: processedCode.slice(lastIndex, match.start) });
    }
    // Add the highlighted match
    tokens.push({ text: match.text, style: match.style });
    lastIndex = match.end;
  });

  // Add any remaining plain text
  if (lastIndex < processedCode.length) {
    tokens.push({ text: processedCode.slice(lastIndex) });
  }

  // Convert tokens to React elements
  return tokens.map((token, index) => {
    if (token.style) {
      return (
        <span key={index} style={token.style}>
          {token.text}
        </span>
      );
    }
    return <React.Fragment key={index}>{token.text}</React.Fragment>;
  });
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, className }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Decode HTML entities if present in the original code
      const textarea = document.createElement('textarea');
      textarea.innerHTML = code;
      const decodedCode = textarea.value.trim();
      await navigator.clipboard.writeText(decodedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail
    }
  };

  const highlightedCode = useMemo(() => {
    return applySyntaxHighlight(code.trim(), language);
  }, [code, language]);

  // Syntax highlighting tokens still use inline styles for dynamic theming

  return (
    <div className={`code-block-container ${className || ''}`}>
      <button
        onClick={handleCopy}
        className="code-block-copy-button"
        aria-label={copied ? 'Code copied' : 'Copy code'}
      >
        {copied ? '✓ Copied' : language || 'copy'}
      </button>

      <pre className="code-block-pre">
        <code className="code-block-code">{highlightedCode}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
