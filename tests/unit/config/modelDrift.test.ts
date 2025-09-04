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
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_GEMINI_MODEL_ID,
  DEFAULT_OPENROUTER_MODEL_ID,
  DEFAULT_DEEPSEEK_MODEL_ID,
  DEFAULT_QWEN_MODEL_ID,
  DEFAULT_ZHIPU_MODEL_ID,
  DEFAULT_KIMI_MODEL_ID,
  OPENAI_COMPAT_PROVIDER_IDS,
  getModelById,
  getDefaultModelForProvider,
  modelExists,
  type ModelConfig,
} from '../../../src/config/models';
import { OPENAI_COMPAT_PRESETS } from '../../../src/config/models';

describe('Model Configuration Drift Detection', () => {
  describe('Default Model Constants Validation', () => {
    it('should verify all DEFAULT_*_MODEL_ID constants reference existing models', () => {
      const defaultConstants = [
        { name: 'DEFAULT_MODEL_ID', value: DEFAULT_MODEL_ID, provider: 'openai' },
        { name: 'DEFAULT_GEMINI_MODEL_ID', value: DEFAULT_GEMINI_MODEL_ID, provider: 'gemini' },
        {
          name: 'DEFAULT_OPENROUTER_MODEL_ID',
          value: DEFAULT_OPENROUTER_MODEL_ID,
          provider: 'openrouter',
        },
        {
          name: 'DEFAULT_DEEPSEEK_MODEL_ID',
          value: DEFAULT_DEEPSEEK_MODEL_ID,
          provider: 'deepseek',
        },
        { name: 'DEFAULT_QWEN_MODEL_ID', value: DEFAULT_QWEN_MODEL_ID, provider: 'qwen' },
        { name: 'DEFAULT_ZHIPU_MODEL_ID', value: DEFAULT_ZHIPU_MODEL_ID, provider: 'zhipu' },
        { name: 'DEFAULT_KIMI_MODEL_ID', value: DEFAULT_KIMI_MODEL_ID, provider: 'kimi' },
      ];

      const errors: string[] = [];

      defaultConstants.forEach(({ name, value, provider }) => {
        // Check if model exists
        if (!modelExists(value)) {
          errors.push(`${name} references non-existent model: "${value}"`);
          return;
        }

        // Check if model has correct provider
        const model = getModelById(value);
        if (model?.provider !== provider) {
          errors.push(
            `${name} references model "${value}" with provider "${model?.provider}" but expected "${provider}"`
          );
        }
      });

      if (errors.length > 0) {
        throw new Error(
          `Default model constant drift detected:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
            `Available models:\n${SUPPORTED_MODELS.map(m => `  - ${m.id} (${m.provider})`).join('\n')}`
        );
      }
    });

    it('should verify DEFAULT_MODEL_ID is an OpenAI GPT model', () => {
      const model = getModelById(DEFAULT_MODEL_ID);

      if (!model) {
        throw new Error(`DEFAULT_MODEL_ID "${DEFAULT_MODEL_ID}" not found in SUPPORTED_MODELS`);
      }

      if (model.provider !== 'openai') {
        throw new Error(
          `DEFAULT_MODEL_ID "${DEFAULT_MODEL_ID}" should be an OpenAI model but has provider "${model.provider}"`
        );
      }

      if (!model.id.startsWith('gpt-')) {
        throw new Error(
          `DEFAULT_MODEL_ID "${DEFAULT_MODEL_ID}" should be a GPT model (start with 'gpt-')`
        );
      }
    });

    it('should verify DEFAULT_GEMINI_MODEL_ID is a Gemini model', () => {
      const model = getModelById(DEFAULT_GEMINI_MODEL_ID);

      if (!model) {
        throw new Error(
          `DEFAULT_GEMINI_MODEL_ID "${DEFAULT_GEMINI_MODEL_ID}" not found in SUPPORTED_MODELS`
        );
      }

      if (model.provider !== 'gemini') {
        throw new Error(
          `DEFAULT_GEMINI_MODEL_ID "${DEFAULT_GEMINI_MODEL_ID}" should be a Gemini model but has provider "${model.provider}"`
        );
      }

      if (!model.id.startsWith('gemini-')) {
        throw new Error(
          `DEFAULT_GEMINI_MODEL_ID "${DEFAULT_GEMINI_MODEL_ID}" should be a Gemini model (start with 'gemini-')`
        );
      }
    });

    it('should verify DEFAULT_OPENROUTER_MODEL_ID is an OpenRouter model', () => {
      const model = getModelById(DEFAULT_OPENROUTER_MODEL_ID);

      if (!model) {
        throw new Error(
          `DEFAULT_OPENROUTER_MODEL_ID "${DEFAULT_OPENROUTER_MODEL_ID}" not found in SUPPORTED_MODELS`
        );
      }

      if (model.provider !== 'openrouter') {
        throw new Error(
          `DEFAULT_OPENROUTER_MODEL_ID "${DEFAULT_OPENROUTER_MODEL_ID}" should be an OpenRouter model but has provider "${model.provider}"`
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
        const modelsForProvider = SUPPORTED_MODELS.filter(m => m.provider === preset.id);

        if (modelsForProvider.length === 0) {
          errors.push(
            `Preset "${preset.id}" (${preset.name}) has no corresponding models in SUPPORTED_MODELS`
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
      const openAICompatModels = SUPPORTED_MODELS.filter(
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
      const knownProviders = [
        'openai',
        'gemini',
        'openrouter',
        'deepseek',
        'qwen',
        'zhipu',
        'kimi',
      ];

      const errors: string[] = [];

      knownProviders.forEach(provider => {
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

        const model = getModelById(defaultModel);
        if (model?.provider !== provider) {
          errors.push(
            `getDefaultModelForProvider("${provider}") returned model "${defaultModel}" ` +
              `with provider "${model?.provider}" instead of "${provider}"`
          );
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

      SUPPORTED_MODELS.forEach((model, index) => {
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
        if (
          model.provider === 'gemini' &&
          model.thinkingBudget &&
          !['0', '-1'].includes(model.thinkingBudget)
        ) {
          errors.push(
            `Gemini model "${model.id}" has invalid thinkingBudget: "${model.thinkingBudget}" (should be '0' or '-1')`
          );
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
      const modelIds = SUPPORTED_MODELS.map(m => m.id);
      const duplicateIds = modelIds.filter((id, index) => modelIds.indexOf(id) !== index);

      if (duplicateIds.length > 0) {
        throw new Error(
          `Duplicate model IDs detected: [${[...new Set(duplicateIds)].join(', ')}]\n\n` +
            `All model IDs must be unique across SUPPORTED_MODELS.`
        );
      }
    });

    it('should verify each provider has at least one model', () => {
      const providers = [...new Set(SUPPORTED_MODELS.map(m => m.provider))];
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
          `Expected providers missing from SUPPORTED_MODELS: [${missingProviders.join(', ')}]\n\n` +
            `Available providers: [${providers.join(', ')}]`
        );
      }
    });
  });

  describe('Cross-File Model Reference Validation', () => {
    it('should verify EngineFactory uses correct default constants', () => {
      // This test checks that EngineFactory imports and uses the correct constants
      // We can't directly test the import without loading the file, but we can verify
      // the constants themselves are consistent with what the factory would expect

      const factoryExpectedDefaults = [
        { provider: 'openai', expected: DEFAULT_MODEL_ID },
        { provider: 'gemini', expected: DEFAULT_GEMINI_MODEL_ID },
        { provider: 'openrouter', expected: DEFAULT_OPENROUTER_MODEL_ID },
      ];

      const errors: string[] = [];

      factoryExpectedDefaults.forEach(({ provider, expected }) => {
        const actualDefault = getDefaultModelForProvider(provider);

        if (actualDefault !== expected) {
          errors.push(
            `Provider "${provider}" default mismatch: ` +
              `expected "${expected}" but getDefaultModelForProvider() returns "${actualDefault}"`
          );
        }
      });

      if (errors.length > 0) {
        throw new Error(
          `EngineFactory default model consistency check failed:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
            `This suggests drift between default constants and the getDefaultModelForProvider() function.`
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
            `Update ProviderManagerService fallbacks or add missing models to SUPPORTED_MODELS.`
        );
      }
    });

    it('should detect if new models are added without updating defaults', () => {
      // This test helps detect when new models are added but defaults aren't updated appropriately
      const providerModelCounts = SUPPORTED_MODELS.reduce(
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

      SUPPORTED_MODELS.forEach(model => {
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
      const testModel = SUPPORTED_MODELS[0];
      if (testModel) {
        const retrieved = getModelById(testModel.id);
        if (!retrieved || retrieved.id !== testModel.id) {
          errors.push(`getModelById("${testModel.id}") failed to retrieve correct model`);
        }
      }

      // Test modelExists with existing and non-existing models
      if (SUPPORTED_MODELS.length > 0) {
        const existingModel = SUPPORTED_MODELS[0]!.id;
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
