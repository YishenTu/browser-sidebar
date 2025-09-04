/**
 * @file Provider Validation Service
 *
 * Wraps key validation and compat provider probing behind a simple API
 * using the transport layer for CORS safety. Intended for use by UI
 * components (e.g., Settings) to avoid direct fetch/chrome.* usage.
 */

import { shouldProxy } from '@transport/policy';
import { BackgroundProxyTransport } from '@transport/BackgroundProxyTransport';
import { DirectFetchTransport } from '@transport/DirectFetchTransport';
import KeyService from '@services/keys/KeyService';

/** Validate an OpenAI API key by hitting a known endpoint. */
export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  const ks = new KeyService();
  return ks.validate('openai', apiKey);
}

/** Validate a Google Gemini API key by probing the models endpoint. */
export async function validateGeminiKey(apiKey: string): Promise<boolean> {
  const ks = new KeyService();
  // Either 'google' or 'gemini' maps to the same endpoint set
  return ks.validate('gemini', apiKey);
}

/** Validate an OpenRouter API key. */
export async function validateOpenRouterKey(apiKey: string): Promise<boolean> {
  const ks = new KeyService();
  return ks.validate('openrouter', apiKey);
}

/**
 * Validate an OpenAI-compatible provider by calling `${baseURL}/models`.
 * Uses background proxy transport where necessary to avoid CORS issues.
 */
export async function validateCompatProvider(baseURL: string, apiKey: string): Promise<boolean> {
  const transport = shouldProxy(baseURL)
    ? new BackgroundProxyTransport()
    : new DirectFetchTransport();

  try {
    const res = await transport.request({
      url: `${baseURL.replace(/\/$/, '')}/models`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}
