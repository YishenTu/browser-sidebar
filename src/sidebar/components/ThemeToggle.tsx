import React from 'react';
import { getCurrentTheme, setTheme, type ThemeMode } from '../../utils/theme';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Theme toggle component that allows switching between light, dark, and auto themes
 */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [currentTheme, setCurrentTheme] = React.useState<ThemeMode>('light');

  React.useEffect(() => {
    // Get initial theme
    setCurrentTheme(getCurrentTheme());
  }, []);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    setCurrentTheme(newTheme);
  };

  return (
    <div className={`theme-toggle ${className}`}>
      <label className="theme-toggle__label">Theme:</label>
      <div className="theme-toggle__options">
        {(['light', 'dark', 'auto'] as const).map(theme => (
          <button
            key={theme}
            className={`theme-toggle__option ${
              currentTheme === theme ? 'theme-toggle__option--active' : ''
            }`}
            onClick={() => handleThemeChange(theme)}
            title={`Switch to ${theme} theme`}
          >
            {theme === 'light' && '☀️'}
            {theme === 'dark' && '🌙'}
            {theme === 'auto' && '🌓'}
            <span className="theme-toggle__text">
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// CSS-in-JS styles using CSS variables
const themeToggleStyles = `
.theme-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background: var(--background-elevated);
  border: 1px solid var(--border-primary);
}

.theme-toggle__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  margin: 0;
}

.theme-toggle__options {
  display: flex;
  gap: var(--spacing-xs);
}

.theme-toggle__option {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: var(--transition-fast);
}

.theme-toggle__option:hover {
  background: var(--hover-overlay);
  color: var(--text-secondary);
}

.theme-toggle__option--active {
  background: var(--primary-500);
  color: white;
}

.theme-toggle__option--active:hover {
  background: var(--primary-600);
}

.theme-toggle__text {
  font-weight: var(--font-weight-medium);
}

@media (max-width: 400px) {
  .theme-toggle__text {
    display: none;
  }
}
`;

// Inject styles when component is first imported
if (typeof document !== 'undefined') {
  const styleId = 'theme-toggle-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = themeToggleStyles;
    document.head.appendChild(style);
  }
}
