/**
 * Simplified OpenAI-Compatible Provider Storage
 *
 * This module provides storage for OpenAI-compatible providers using Chrome storage
 * directly, similar to how standard providers (OpenAI, Gemini, OpenRouter) work.
 *
 * No encryption service initialization required - stores in Chrome storage.
 */

import * as chromeStorage from '@/data/storage/chrome';

const COMPAT_STORAGE_KEY = 'openai_compat_providers';

/**
 * Input shape for adding/updating an OpenAI-compatible provider
 */
export interface CompatProviderInput {
  id: string; // Provider ID (e.g., "deepseek", "custom-myapi")
  apiKey: string; // API key
  baseURL: string; // Base URL for the API
  name?: string; // Display name
  headers?: Record<string, string>; // Custom headers
  defaultModel?: {
    // For custom providers only
    id: string;
    name: string;
  };
}

/**
 * List item shape for UI display
 */
export interface CompatProviderListItem {
  id: string; // Provider ID without "compat-" prefix
  name: string; // Display name
  baseURL: string; // Base URL
  model?: {
    // Default model for custom providers
    id: string;
    name: string;
  };
}

/**
 * Full provider details for initialization
 */
export interface CompatProviderDetails {
  id: string; // Provider ID without "compat-" prefix
  name: string; // Display name
  apiKey: string; // API key (plain text)
  baseURL: string; // Base URL
  headers?: Record<string, string>; // Custom headers
  model?: {
    // Default model for custom providers
    id: string;
    name: string;
  };
}

interface StoredCompatProvider {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  headers?: Record<string, string>;
  defaultModel?: {
    id: string;
    name: string;
  };
}

/**
 * Get default display name for known providers
 */
function getDefaultDisplayName(id: string): string {
  const knownProviders: Record<string, string> = {
    deepseek: 'DeepSeek',
    qwen: 'Qwen',
    zhipu: 'Zhipu',
    kimi: 'Kimi',
  };

  return knownProviders[id] || id;
}

/**
 * Get all stored compat providers
 */
async function getAllProviders(): Promise<Record<string, StoredCompatProvider>> {
  try {
    const stored = await chromeStorage.get(COMPAT_STORAGE_KEY);
    return (stored as Record<string, StoredCompatProvider>) || {};
  } catch {
    return {};
  }
}

/**
 * Save all compat providers
 */
async function saveAllProviders(providers: Record<string, StoredCompatProvider>): Promise<void> {
  await chromeStorage.set(COMPAT_STORAGE_KEY, providers);
}

/**
 * Add or update an OpenAI-compatible provider
 */
export async function addOrUpdateOpenAICompatProvider(input: CompatProviderInput): Promise<void> {
  const providers = await getAllProviders();

  providers[input.id] = {
    id: input.id,
    name: input.name || getDefaultDisplayName(input.id),
    apiKey: input.apiKey,
    baseURL: input.baseURL,
    headers: input.headers,
    defaultModel: input.defaultModel,
  };

  await saveAllProviders(providers);
}

/**
 * List all OpenAI-compatible providers (without API keys)
 */
export async function listOpenAICompatProviders(): Promise<CompatProviderListItem[]> {
  const providers = await getAllProviders();

  return Object.values(providers).map(provider => ({
    id: provider.id,
    name: provider.name,
    baseURL: provider.baseURL,
    model: provider.defaultModel,
  }));
}

/**
 * Get a specific OpenAI-compatible provider by ID (with API key)
 */
export async function getCompatProviderById(id: string): Promise<CompatProviderDetails | null> {
  const providers = await getAllProviders();
  const provider = providers[id];

  if (!provider) {
    return null;
  }

  return {
    id: provider.id,
    name: provider.name,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
    headers: provider.headers,
    model: provider.defaultModel,
  };
}

/**
 * Delete an OpenAI-compatible provider
 */
export async function deleteOpenAICompatProvider(id: string): Promise<void> {
  const providers = await getAllProviders();
  delete providers[id];
  await saveAllProviders(providers);
}

/**
 * Clear all OpenAI-compatible providers
 */
export async function clearAllOpenAICompatProviders(): Promise<void> {
  await saveAllProviders({});
}

/**
 * Test connection to an OpenAI-compatible provider
 */
export async function testCompatProviderConnection(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const provider = await getCompatProviderById(id);
    if (!provider) {
      return { success: false, error: 'Provider not found' };
    }

    // Test the connection by fetching models
    const headers: HeadersInit = {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
      ...(provider.headers || {}),
    };

    const response = await fetch(`${provider.baseURL}/models`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API returned ${response.status}: ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
