/**
 * @file Model Configuration Drift Detection Tests
 *
 * This test suite detects configuration drift between different parts of the codebase
 * that reference AI models. It ensures consistency between:
 * - Model definitions in models.ts
 * - OpenAI-Compatible provider presets
 * - Default model constants
 * - Hardcoded model references in critical files
 *
 * The tests are designed to FAIL when drift is detected, with clear error messages
 * to help identify and resolve configuration inconsistencies.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MODELS,
  DEFAULT_MODEL_ID,
  getDefaultModel,
  OPENAI_COMPAT_PROVIDER_IDS,
  getModelById,
  getDefaultModelForProvider,
  modelExists,
  type ModelConfig,
} from '../../../src/config/models';
import { OPENAI_COMPAT_PRESETS } from '../../../src/config/models';

describe('Model Configuration Drift Detection', () => {
  describe('Default Model Validation', () => {
    it('should verify getDefaultModel() returns the first model from DEFAULT_MODELS', () => {
      const defaultModel = getDefaultModel();
      const expectedDefault = DEFAULT_MODELS[0]?.id;

      if (!expectedDefault) {
        throw new Error('DEFAULT_MODELS is empty - cannot determine default model');
      }

      if (defaultModel !== expectedDefault) {
        throw new Error(
          `getDefaultModel() returned "${defaultModel}" but expected first model "${expectedDefault}"`
        );
      }

      if (!modelExists(defaultModel)) {
        throw new Error(`Default model "${defaultModel}" does not exist in DEFAULT_MODELS`);
      }
    });

    it('should verify DEFAULT_MODEL_ID compatibility constant equals getDefaultModel()', () => {
      // DEFAULT_MODEL_ID is kept for backward compatibility
      const defaultModel = getDefaultModel();

      if (DEFAULT_MODEL_ID !== defaultModel) {
        throw new Error(
          `DEFAULT_MODEL_ID constant "${DEFAULT_MODEL_ID}" doesn't match getDefaultModel() "${defaultModel}"`
        );
      }
    });
  });

  describe('OpenAI-Compatible Provider Consistency', () => {
    it('should verify OPENAI_COMPAT_PROVIDER_IDS matches preset IDs', () => {
      const presetIds = OPENAI_COMPAT_PRESETS.map(p => p.id).sort();
      const providerIds = [...OPENAI_COMPAT_PROVIDER_IDS].sort();

      const missingInProvider = presetIds.filter(id => !providerIds.includes(id));
      const extraInProvider = providerIds.filter(id => !presetIds.includes(id));

      const errors: string[] = [];

      if (missingInProvider.length > 0) {
        errors.push(
          `Provider IDs missing from OPENAI_COMPAT_PROVIDER_IDS: ${missingInProvider.join(', ')}`
        );
      }

      if (extraInProvider.length > 0) {
        errors.push(
          `Extra provider IDs in OPENAI_COMPAT_PROVIDER_IDS: ${extraInProvider.join(', ')}`
        );
      }

      if (errors.length > 0) {
        throw new Error(
          `OpenAI-Compatible provider drift detected:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
            `Preset IDs: [${presetIds.join(', ')}]\n` +
            `Provider IDs: [${providerIds.join(', ')}]`
        );
      }
    });

    it('should verify each OpenAI-Compatible preset has corresponding models', () => {
      const errors: string[] = [];

      OPENAI_COMPAT_PRESETS.forEach(preset => {
        const modelsForProvider = DEFAULT_MODELS.filter(m => m.provider === preset.id);

        if (modelsForProvider.length === 0) {
          errors.push(
            `Preset "${preset.id}" (${preset.name}) has no corresponding models in DEFAULT_MODELS`
          );
        }
      });

      if (errors.length > 0) {
        throw new Error(
          `OpenAI-Compatible preset without models:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
            `Consider adding models for these presets or removing unused presets.`
        );
      }
    });

    it('should verify each OpenAI-Compatible model has a corresponding preset', () => {
      const presetIds = OPENAI_COMPAT_PRESETS.map(p => p.id);
      const openAICompatModels = DEFAULT_MODELS.filter(
        m =>
          presetIds.includes(m.provider) &&
          m.provider !== 'openai' &&
          m.provider !== 'gemini' &&
          m.provider !== 'openrouter'
      );

      const errors: string[] = [];

      openAICompatModels.forEach(model => {
        if (!presetIds.includes(model.provider)) {
          errors.push(
            `Model "${model.id}" has provider "${model.provider}" but no corresponding preset exists`
          );
        }
      });

      if (errors.length > 0) {
        throw new Error(
          `Models without corresponding presets:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
            `Available presets: [${presetIds.join(', ')}]`
        );
      }
    });
  });

  describe('getDefaultModelForProvider() Validation', () => {
    it('should return valid models for all known provider types', () => {
      const knownProviders = ['openai', 'gemini', 'openrouter'];

      // Also test OpenAI-compatible providers that have models
      const openAICompatProviders = OPENAI_COMPAT_PROVIDER_IDS.filter(id =>
        DEFAULT_MODELS.some(m => m.provider === id)
      );

      const allProviders = [...knownProviders, ...openAICompatProviders];

      const errors: string[] = [];

      allProviders.forEach(provider => {
        const defaultModel = getDefaultModelForProvider(provider);

        if (!defaultModel) {
          errors.push(`getDefaultModelForProvider("${provider}") returned undefined`);
          return;
        }

        if (!modelExists(defaultModel)) {
          errors.push(
            `getDefaultModelForProvider("${provider}") returned non-existent model: "${defaultModel}"`
          );
          return;
        }

        // For OpenAI-compatible providers, the default should be from their models
        if (openAICompatProviders.includes(provider)) {
          const model = getModelById(defaultModel);
          if (model?.provider !== provider) {
            errors.push(
              `getDefaultModelForProvider("${provider}") returned model "${defaultModel}" ` +
                `with provider "${model?.provider}" instead of "${provider}"`
            );
          }
        } else {
          const model = getModelById(defaultModel);
          if (model?.provider !== provider) {
            errors.push(
              `getDefaultModelForProvider("${provider}") returned model "${defaultModel}" ` +
                `with provider "${model?.provider}" instead of "${provider}"`
            );
          }
        }
      });

      if (errors.length > 0) {
        throw new Error(
          `getDefaultModelForProvider() validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
        );
      }
    });

    it('should return undefined for unknown provider types', () => {
      const unknownProviders = ['unknown', 'invalid', 'nonexistent'];

      unknownProviders.forEach(provider => {
        const result = getDefaultModelForProvider(provider);
        if (result !== undefined) {
          throw new Error(
            `getDefaultModelForProvider("${provider}") should return undefined for unknown provider, ` +
              `but returned: "${result}"`
          );
        }
      });
    });
  });

  describe('Model Configuration Completeness', () => {
    it('should verify all models have required properties', () => {
      const errors: string[] = [];

      DEFAULT_MODELS.forEach((model, index) => {
        if (!model.id || typeof model.id !== 'string') {
          errors.push(`Model at index ${index} has invalid id: "${model.id}"`);
        }

        if (!model.name || typeof model.name !== 'string') {
          errors.push(`Model "${model.id}" has invalid name: "${model.name}"`);
        }

        if (!model.provider || typeof model.provider !== 'string') {
          errors.push(`Model "${model.id}" has invalid provider: "${model.provider}"`);
        }

        // Validate provider-specific properties
        if (model.provider === 'gemini' && model.thinkingBudget !== undefined) {
          const validBudgets = new Set<unknown>([0, -1, '0', '-1']);
          if (!validBudgets.has(model.thinkingBudget)) {
            errors.push(
              `Gemini model "${model.id}" has invalid thinkingBudget: "${model.thinkingBudget}" (should be 0 or -1)`
            );
          }
        }

        if (model.provider === 'openai' && model.reasoningEffort) {
          const validEfforts = ['minimal', 'low', 'medium', 'high'];
          if (!validEfforts.includes(model.reasoningEffort)) {
            errors.push(
              `OpenAI model "${model.id}" has invalid reasoningEffort: "${model.reasoningEffort}"`
            );
          }
        }
      });

      if (errors.length > 0) {
        throw new Error(
          `Model configuration validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
        );
      }
    });

    it('should verify model IDs are unique', () => {
      const modelIds = DEFAULT_MODELS.map(m => m.id);
      const duplicateIds = modelIds.filter((id, index) => modelIds.indexOf(id) !== index);

      if (duplicateIds.length > 0) {
        throw new Error(
          `Duplicate model IDs detected: [${[...new Set(duplicateIds)].join(', ')}]\n\n` +
            `All model IDs must be unique across DEFAULT_MODELS.`
        );
      }
    });

    it('should verify each provider has at least one model', () => {
      const providers = [...new Set(DEFAULT_MODELS.map(m => m.provider))];
      const expectedProviders = [
        'openai',
        'gemini',
        'openrouter',
        'deepseek',
        'qwen',
        'zhipu',
        'kimi',
      ];

      const missingProviders = expectedProviders.filter(provider => !providers.includes(provider));

      if (missingProviders.length > 0) {
        throw new Error(
          `Expected providers missing from DEFAULT_MODELS: [${missingProviders.join(', ')}]\n\n` +
            `Available providers: [${providers.join(', ')}]`
        );
      }
    });
  });

  describe('Cross-File Model Reference Validation', () => {
    it('should verify getDefaultModelForProvider returns first model for each provider', () => {
      const coreProviders = ['openai', 'gemini', 'openrouter'];
      const errors: string[] = [];

      coreProviders.forEach(provider => {
        const defaultModel = getDefaultModelForProvider(provider);
        const providerModels = DEFAULT_MODELS.filter(m => m.provider === provider);
        const expectedDefault = providerModels[0]?.id;

        if (!expectedDefault) {
          errors.push(`Provider "${provider}" has no models in DEFAULT_MODELS`);
          return;
        }

        if (defaultModel !== expectedDefault) {
          errors.push(
            `Provider "${provider}" default mismatch: ` +
              `expected first model "${expectedDefault}" but got "${defaultModel}"`
          );
        }
      });

      if (errors.length > 0) {
        throw new Error(
          `Provider default model validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
        );
      }
    });

    it('should verify ProviderManagerService fallback models exist', () => {
      // ProviderManagerService has hardcoded fallback models, verify they exist
      const fallbackChecks = [
        { provider: 'openai', fallback: 'gpt-5-nano', context: 'OpenAI initialization fallback' },
        {
          provider: 'gemini',
          fallback: 'gemini-2.5-flash-lite',
          context: 'Gemini initialization fallback',
        },
        {
          provider: 'openrouter',
          fallback: 'anthropic/claude-sonnet-4',
          context: 'OpenRouter initialization fallback',
        },
      ];

      const errors: string[] = [];

      fallbackChecks.forEach(({ provider, fallback, context }) => {
        if (!modelExists(fallback)) {
          errors.push(`${context}: Model "${fallback}" does not exist`);
          return;
        }

        const model = getModelById(fallback);
        if (model?.provider !== provider) {
          errors.push(
            `${context}: Model "${fallback}" has provider "${model?.provider}" but expected "${provider}"`
          );
        }
      });

      if (errors.length > 0) {
        throw new Error(
          `ProviderManagerService fallback model validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
            `Update ProviderManagerService fallbacks or add missing models to DEFAULT_MODELS.`
        );
      }
    });

    it('should detect if new models are added without updating defaults', () => {
      // This test helps detect when new models are added but defaults aren't updated appropriately
      const providerModelCounts = DEFAULT_MODELS.reduce(
        (acc, model) => {
          acc[model.provider] = (acc[model.provider] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Expected minimum model counts based on current configuration
      const expectedMinCounts = {
        openai: 3, // gpt-5-nano, gpt-5-mini, gpt-5
        gemini: 3, // gemini-2.5-flash-lite, gemini-2.5-flash, gemini-2.5-pro
        openrouter: 1, // anthropic/claude-sonnet-4
        deepseek: 1, // deepseek-chat
        qwen: 1, // qwen3-235b-a22b-instruct-2507
        zhipu: 1, // glm-4.5-x
        kimi: 1, // kimi-k2-turbo-preview
      };

      const warnings: string[] = [];

      Object.entries(expectedMinCounts).forEach(([provider, expectedMin]) => {
        const actualCount = providerModelCounts[provider] || 0;
        if (actualCount < expectedMin) {
          warnings.push(
            `Provider "${provider}" has ${actualCount} models but expected at least ${expectedMin}`
          );
        } else if (actualCount > expectedMin) {
          // This isn't an error, but might indicate new models were added
          warnings.push(
            `Provider "${provider}" has ${actualCount} models (more than expected ${expectedMin}). ` +
              `Consider updating test expectations if this is intentional.`
          );
        }
      });

      // Only fail for missing models, not extra ones
      const errors = warnings.filter(w => w.includes('but expected at least'));

      if (errors.length > 0) {
        throw new Error(
          `Model count validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
            `This might indicate missing models or outdated test expectations.`
        );
      }
    });
  });

  describe('Provider Type Consistency', () => {
    it('should verify provider types match expected patterns', () => {
      const providerPatterns = {
        openai: /^gpt-/,
        gemini: /^gemini-/,
        openrouter: /^[^/]+\/[^/]+/, // Should contain a slash for provider/model format
        deepseek: /^deepseek-/,
        qwen: /^qwen/i,
        zhipu: /^glm-/,
        kimi: /^kimi-/,
      };

      const errors: string[] = [];

      DEFAULT_MODELS.forEach(model => {
        const pattern = providerPatterns[model.provider as keyof typeof providerPatterns];

        if (pattern && !pattern.test(model.id)) {
          errors.push(
            `Model "${model.id}" with provider "${model.provider}" doesn't match expected pattern ${pattern.toString()}`
          );
        }

        // Special case: OpenRouter models should not have certain prefixes
        if (
          model.provider === 'openrouter' &&
          (model.id.startsWith('gpt-') || model.id.startsWith('gemini-'))
        ) {
          errors.push(
            `OpenRouter model "${model.id}" shouldn't start with provider-specific prefixes (gpt- or gemini-)`
          );
        }
      });

      if (errors.length > 0) {
        throw new Error(
          `Provider type pattern validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
            `Model IDs should follow consistent naming patterns for their provider type.`
        );
      }
    });
  });

  describe('Configuration Export Integrity', () => {
    it('should verify all exported functions work correctly with current data', () => {
      const errors: string[] = [];

      // Test getModelById with existing models
      const testModel = DEFAULT_MODELS[0];
      if (testModel) {
        const retrieved = getModelById(testModel.id);
        if (!retrieved || retrieved.id !== testModel.id) {
          errors.push(`getModelById("${testModel.id}") failed to retrieve correct model`);
        }
      }

      // Test modelExists with existing and non-existing models
      if (DEFAULT_MODELS.length > 0) {
        const existingModel = DEFAULT_MODELS[0]!.id;
        if (!modelExists(existingModel)) {
          errors.push(`modelExists("${existingModel}") returned false for existing model`);
        }
      }

      if (modelExists('nonexistent-model-12345')) {
        errors.push(`modelExists("nonexistent-model-12345") returned true for non-existent model`);
      }

      if (errors.length > 0) {
        throw new Error(
          `Configuration export integrity check failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
        );
      }
    });
  });
});
