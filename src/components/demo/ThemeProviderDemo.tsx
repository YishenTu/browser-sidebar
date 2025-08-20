/**
 * @file Theme Provider Demo
 *
 * Demonstrates the ThemeContext integration with ThemeToggle and other components.
 * Shows theme persistence, system theme detection, and real-time theme switching.
 */

import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { ThemeToggle } from '../../sidebar/components/ThemeToggle';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

/**
 * Component that displays current theme information
 */
function ThemeInfo() {
  const { theme, effectiveTheme, isSystemTheme } = useTheme();

  return (
    <Card className="theme-info-card">
      <h3 className="theme-info-title">Current Theme Status</h3>
      <div className="theme-info-grid">
        <div className="theme-info-item">
          <span className="theme-info-label">Theme Setting:</span>
          <span className="theme-info-value">{theme}</span>
        </div>
        <div className="theme-info-item">
          <span className="theme-info-label">Effective Theme:</span>
          <span className="theme-info-value">{effectiveTheme}</span>
        </div>
        <div className="theme-info-item">
          <span className="theme-info-label">System Mode:</span>
          <span className="theme-info-value">{isSystemTheme ? 'Yes' : 'No'}</span>
        </div>
      </div>
    </Card>
  );
}

/**
 * Component that demonstrates theme-aware UI elements
 */
function ThemeAwareComponents() {
  const { effectiveTheme, setTheme } = useTheme();

  return (
    <Card className="theme-components-card">
      <h3 className="theme-components-title">Theme-Aware Components</h3>
      <div className="theme-components-grid">
        <Button
          variant="primary"
          onClick={() => setTheme('light')}
          className="theme-demo-button"
        >
          Switch to Light
        </Button>
        <Button
          variant="secondary"
          onClick={() => setTheme('dark')}
          className="theme-demo-button"
        >
          Switch to Dark
        </Button>
        <Button
          variant="outline"
          onClick={() => setTheme('auto')}
          className="theme-demo-button"
        >
          Use System Theme
        </Button>
        <div className="theme-color-sample">
          <div className="color-box background-primary">
            Primary Background
          </div>
          <div className="color-box background-secondary">
            Secondary Background
          </div>
          <div className="color-box text-primary">
            Primary Text
          </div>
        </div>
        <p className="theme-description">
          Current theme: <strong>{effectiveTheme}</strong>
          <br />
          These components automatically adapt to the selected theme.
        </p>
      </div>
    </Card>
  );
}

/**
 * Main demo component
 */
function ThemeProviderDemoContent() {
  return (
    <div className="theme-demo-container">
      <h2 className="theme-demo-title">Theme Provider Demo</h2>
      <p className="theme-demo-description">
        This demo shows the ThemeContext in action with persistent theme switching,
        system theme detection, and real-time UI updates.
      </p>
      
      <div className="theme-demo-controls">
        <ThemeToggle className="theme-demo-toggle" />
      </div>

      <div className="theme-demo-content">
        <ThemeInfo />
        <ThemeAwareComponents />
      </div>

      <div className="theme-demo-instructions">
        <h4>Instructions:</h4>
        <ul>
          <li>Use the theme toggle above to switch between light, dark, and auto modes</li>
          <li>Auto mode follows your system preference</li>
          <li>Theme preferences persist across browser sessions</li>
          <li>All UI components automatically adapt to the selected theme</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Theme provider demo with context wrapper
 */
export function ThemeProviderDemo() {
  return (
    <ThemeProvider>
      <ThemeProviderDemoContent />
    </ThemeProvider>
  );
}

// CSS-in-JS styles for the demo
const demoStyles = `
.theme-demo-container {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-2xl);
  font-family: system-ui, -apple-system, sans-serif;
}

.theme-demo-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
  text-align: center;
}

.theme-demo-description {
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xl);
  text-align: center;
  line-height: var(--line-height-relaxed);
}

.theme-demo-controls {
  display: flex;
  justify-content: center;
  margin-bottom: var(--spacing-xl);
}

.theme-demo-content {
  display: grid;
  gap: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}

.theme-info-card,
.theme-components-card {
  padding: var(--spacing-xl);
}

.theme-info-title,
.theme-components-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.theme-info-grid {
  display: grid;
  gap: var(--spacing-md);
}

.theme-info-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm);
  background: var(--background-muted);
  border-radius: var(--radius-md);
}

.theme-info-label {
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.theme-info-value {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  text-transform: capitalize;
}

.theme-components-grid {
  display: grid;
  gap: var(--spacing-lg);
}

.theme-demo-button {
  justify-self: start;
}

.theme-color-sample {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
  margin: var(--spacing-lg) 0;
}

.color-box {
  padding: var(--spacing-lg);
  border-radius: var(--radius-md);
  text-align: center;
  font-weight: var(--font-weight-medium);
  border: 1px solid var(--border-primary);
}

.color-box.background-primary {
  background: var(--background-primary);
  color: var(--text-primary);
}

.color-box.background-secondary {
  background: var(--background-secondary);
  color: var(--text-primary);
}

.color-box.text-primary {
  background: var(--background-elevated);
  color: var(--text-primary);
}

.theme-description {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
  margin: var(--spacing-lg) 0;
}

.theme-demo-instructions {
  background: var(--background-elevated);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
}

.theme-demo-instructions h4 {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-md);
}

.theme-demo-instructions ul {
  color: var(--text-secondary);
  padding-left: var(--spacing-xl);
}

.theme-demo-instructions li {
  margin-bottom: var(--spacing-sm);
  line-height: var(--line-height-normal);
}

@media (max-width: 600px) {
  .theme-demo-container {
    padding: var(--spacing-lg);
  }
  
  .theme-color-sample {
    grid-template-columns: 1fr;
  }
}
`;

// Inject styles when component is first imported
if (typeof document !== 'undefined') {
  const styleId = 'theme-provider-demo-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = demoStyles;
    document.head.appendChild(style);
  }
}

export default ThemeProviderDemo;