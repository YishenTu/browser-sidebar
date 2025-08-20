/**
 * @file Settings Type Definitions
 *
 * Type definitions for the settings store, including all configuration
 * options for the browser sidebar extension.
 */

/**
 * Theme preferences for the application
 */
export type Theme = 'light' | 'dark' | 'auto';

/**
 * Font size options for the UI
 */
export type FontSize = 'small' | 'medium' | 'large';

/**
 * Supported AI providers
 */
export type AIProvider = 'openai' | 'anthropic' | 'google' | null;

/**
 * UI preferences and customization options
 */
export interface UIPreferences {
  /** Font size for the chat interface */
  fontSize: FontSize;
  /** Enable compact mode for denser information display */
  compactMode: boolean;
  /** Show timestamps in chat messages */
  showTimestamps: boolean;
  /** Show user and AI avatars */
  showAvatars: boolean;
  /** Enable animations and transitions */
  animationsEnabled: boolean;
}

/**
 * AI model and behavior settings
 */
export interface AISettings {
  /** Default AI provider to use */
  defaultProvider: AIProvider;
  /** Temperature for AI responses (0.0 - 1.0) */
  temperature: number;
  /** Maximum tokens for AI responses */
  maxTokens: number;
  /** Enable streaming responses */
  streamResponse: boolean;
}

/**
 * Privacy and data handling preferences
 */
export interface PrivacySettings {
  /** Save conversation history */
  saveConversations: boolean;
  /** Share anonymous usage analytics */
  shareAnalytics: boolean;
  /** Clear conversations when sidebar is closed */
  clearOnClose: boolean;
}

/**
 * API key storage references (encrypted keys stored separately)
 */
export interface APIKeyReferences {
  /** OpenAI API key reference */
  openai: string | null;
  /** Anthropic API key reference */
  anthropic: string | null;
  /** Google API key reference */
  google: string | null;
}

/**
 * Complete settings configuration
 */
export interface Settings {
  /** Settings schema version for migrations */
  version: number;
  /** Application theme */
  theme: Theme;
  /** UI preferences */
  ui: UIPreferences;
  /** AI model settings */
  ai: AISettings;
  /** Privacy settings */
  privacy: PrivacySettings;
  /** API key references */
  apiKeys: APIKeyReferences;
}

/**
 * Settings store state interface
 */
export interface SettingsState {
  /** Current settings */
  settings: Settings;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Error message if any operation fails */
  error: string | null;

  // Actions
  /** Load settings from chrome storage */
  loadSettings: () => Promise<void>;
  /** Update theme setting */
  updateTheme: (theme: Theme) => Promise<void>;
  /** Update UI preferences */
  updateUIPreferences: (preferences: UIPreferences) => Promise<void>;
  /** Update AI settings */
  updateAISettings: (settings: AISettings) => Promise<void>;
  /** Update privacy settings */
  updatePrivacySettings: (settings: PrivacySettings) => Promise<void>;
  /** Update API key references */
  updateAPIKeyReferences: (apiKeys: APIKeyReferences) => Promise<void>;
  /** Reset all settings to defaults */
  resetToDefaults: () => Promise<void>;
  /** Set error message */
  setError: (error: string | null) => void;
}

/**
 * Legacy settings format for migration (v0)
 */
export interface LegacySettings {
  theme?: string;
  fontSize?: string;
  compactMode?: boolean;
  // Add other legacy fields as needed for migration
}
