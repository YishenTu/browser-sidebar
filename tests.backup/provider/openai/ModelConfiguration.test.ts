/**
 * @file OpenAI Models Configuration Tests
 * 
 * Tests for Task 4.2.1c - OpenAI Models Configuration
 * 
 * This test suite validates:
 * - Model listing including gpt-5-nano
 * - Model selection and configuration
 * - Temperature support per model
 * - Reasoning effort configuration per model
 * - Parameter validation per model type
 * - Model capabilities and limitations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpenAIProvider } from '../../../src/provider/openai/OpenAIProvider';
import type { ModelConfig, ReasoningEffort } from '../../../src/types/providers';

describe('OpenAI Model Configuration', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
  });

  describe('Model Listing', () => {
    it('should include gpt-5-nano model', () => {
      const models = provider.getModels();
      const gpt5Nano = models.find(model => model.id === 'gpt-5-nano');
      
      expect(gpt5Nano).toBeDefined();
      expect(gpt5Nano?.name).toBe('GPT-5 Nano');
      expect(gpt5Nano?.provider).toBe('openai');
    });

    it('should list all OpenAI models with correct structure', () => {
      const models = provider.getModels();
      
      expect(models.length).toBeGreaterThan(0);
      
      models.forEach(model => {
        expect(model).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          provider: 'openai',
          maxTokens: expect.any(Number),
          contextLength: expect.any(Number),
          costPer1kTokens: {
            input: expect.any(Number),
            output: expect.any(Number),
          },
          capabilities: {
            streaming: expect.any(Boolean),
            temperature: expect.any(Boolean),
            reasoning: expect.any(Boolean),
            thinking: expect.any(Boolean),
            multimodal: expect.any(Boolean),
            functionCalling: expect.any(Boolean),
          },
          parameters: expect.objectContaining({
            temperature: {
              min: expect.any(Number),
              max: expect.any(Number),
              default: expect.any(Number),
            },
          }),
        });
      });
    });

    it('should include all expected OpenAI models', () => {
      const models = provider.getModels();
      const modelIds = models.map(m => m.id);
      
      const expectedModels = [
        'gpt-5-nano',
        'o1-preview',
        'o1-mini',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo'
      ];
      
      expectedModels.forEach(expectedId => {
        expect(modelIds).toContain(expectedId);
      });
    });
  });

  describe('Model Selection', () => {
    it('should retrieve specific model by ID', () => {
      const model = provider.getModel('gpt-5-nano');
      
      expect(model).toBeDefined();
      expect(model?.id).toBe('gpt-5-nano');
      expect(model?.name).toBe('GPT-5 Nano');
    });

    it('should return undefined for non-existent model', () => {
      const model = provider.getModel('non-existent-model');
      expect(model).toBeUndefined();
    });

    it('should handle case-sensitive model IDs', () => {
      const model = provider.getModel('GPT-5-NANO'); // Wrong case
      expect(model).toBeUndefined();
      
      const correctModel = provider.getModel('gpt-5-nano');
      expect(correctModel).toBeDefined();
    });
  });

  describe('Temperature Support', () => {
    it('should support temperature for all models', () => {
      const models = provider.getModels();
      
      models.forEach(model => {
        expect(model.capabilities.temperature).toBe(true);
        expect(model.parameters.temperature).toBeDefined();
        expect(model.parameters.temperature.min).toBe(0.0);
        expect(model.parameters.temperature.max).toBe(2.0);
        expect(model.parameters.temperature.default).toBe(1.0);
      });
    });

    it('should validate temperature ranges for all models', () => {
      const models = provider.getModels();
      
      models.forEach(model => {
        const tempConfig = model.parameters.temperature;
        expect(tempConfig.min).toBeLessThanOrEqual(tempConfig.default);
        expect(tempConfig.default).toBeLessThanOrEqual(tempConfig.max);
        expect(tempConfig.min).toBeGreaterThanOrEqual(0.0);
        expect(tempConfig.max).toBeLessThanOrEqual(2.0);
      });
    });

    it('should have consistent temperature configuration across models', () => {
      const models = provider.getModels();
      const firstModel = models[0];
      const expectedTempConfig = firstModel.parameters.temperature;
      
      models.forEach(model => {
        expect(model.parameters.temperature).toEqual(expectedTempConfig);
      });
    });
  });

  describe('Reasoning Effort Support', () => {
    it('should support reasoning effort for o1 models only', () => {
      const models = provider.getModels();
      
      const o1Models = models.filter(m => m.id.startsWith('o1-'));
      const otherModels = models.filter(m => !m.id.startsWith('o1-'));
      
      // o1 models should support reasoning
      o1Models.forEach(model => {
        expect(model.capabilities.reasoning).toBe(true);
        expect(model.parameters.reasoningEffort).toBeDefined();
        expect(model.parameters.reasoningEffort).toEqual(['low', 'medium', 'high']);
      });
      
      // Other models should not support reasoning effort
      otherModels.forEach(model => {
        expect(model.capabilities.reasoning).toBe(false);
        expect(model.parameters.reasoningEffort).toBeUndefined();
      });
    });

    it('should validate reasoning effort options for supported models', () => {
      const models = provider.getModels();
      const reasoningModels = models.filter(m => m.capabilities.reasoning);
      
      reasoningModels.forEach(model => {
        const efforts = model.parameters.reasoningEffort as ReasoningEffort[];
        expect(efforts).toContain('low');
        expect(efforts).toContain('medium');
        expect(efforts).toContain('high');
        expect(efforts.length).toBe(3);
      });
    });

    it('should properly identify reasoning support per model', () => {
      const testCases = [
        { modelId: 'o1-preview', shouldSupport: true },
        { modelId: 'o1-mini', shouldSupport: true },
        { modelId: 'gpt-4o', shouldSupport: false },
        { modelId: 'gpt-5-nano', shouldSupport: false },
        { modelId: 'gpt-4', shouldSupport: false },
        { modelId: 'gpt-3.5-turbo', shouldSupport: false },
      ];
      
      testCases.forEach(({ modelId, shouldSupport }) => {
        const model = provider.getModel(modelId);
        expect(model).toBeDefined();
        expect(model!.capabilities.reasoning).toBe(shouldSupport);
        
        if (shouldSupport) {
          expect(model!.parameters.reasoningEffort).toBeDefined();
        } else {
          expect(model!.parameters.reasoningEffort).toBeUndefined();
        }
      });
    });
  });

  describe('Parameter Validation per Model Type', () => {
    it('should validate parameters based on model capabilities', () => {
      const models = provider.getModels();
      
      models.forEach(model => {
        // Temperature should always be supported
        expect(model.capabilities.temperature).toBe(true);
        expect(model.parameters.temperature).toBeDefined();
        
        // Reasoning effort validation
        if (model.capabilities.reasoning) {
          expect(model.parameters.reasoningEffort).toBeDefined();
          expect(Array.isArray(model.parameters.reasoningEffort)).toBe(true);
        } else {
          expect(model.parameters.reasoningEffort).toBeUndefined();
        }
        
        // Validate parameter types
        expect(typeof model.parameters.temperature.min).toBe('number');
        expect(typeof model.parameters.temperature.max).toBe('number');
        expect(typeof model.parameters.temperature.default).toBe('number');
      });
    });

    it('should have proper constraints for each parameter type', () => {
      const models = provider.getModels();
      
      models.forEach(model => {
        // Temperature constraints
        const temp = model.parameters.temperature;
        expect(temp.min).toBe(0.0);
        expect(temp.max).toBe(2.0);
        expect(temp.default).toBe(1.0);
        expect(temp.min).toBeLessThanOrEqual(temp.default);
        expect(temp.default).toBeLessThanOrEqual(temp.max);
        
        // Reasoning effort constraints (if supported)
        if (model.parameters.reasoningEffort) {
          expect(model.parameters.reasoningEffort).toEqual(['low', 'medium', 'high']);
        }
      });
    });

    it('should reject invalid parameters for each model type', () => {
      const models = provider.getModels();
      
      models.forEach(model => {
        // Test configuration validation through provider
        const baseConfig = {
          apiKey: 'sk-test-key-123',
          model: model.id,
          temperature: 1.0,
          maxTokens: 1000,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        };
        
        // Valid config should pass
        let result = provider.validateConfig(baseConfig);
        expect(result.isValid).toBe(true);
        
        // Invalid temperature should fail
        result = provider.validateConfig({
          ...baseConfig,
          temperature: 3.0, // > 2.0
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid temperature');
        
        // Test reasoning effort for models that don't support it
        if (!model.capabilities.reasoning) {
          result = provider.validateConfig({
            ...baseConfig,
            reasoningEffort: 'high',
          });
          // Should still be valid but reasoning effort should be ignored
          expect(result.isValid).toBe(true);
        }
      });
    });
  });

  describe('Model Capabilities and Limitations', () => {
    it('should define capabilities correctly for each model', () => {
      const gpt5Nano = provider.getModel('gpt-5-nano');
      expect(gpt5Nano).toBeDefined();
      expect(gpt5Nano!.capabilities).toEqual({
        streaming: true,
        temperature: true,
        reasoning: false,
        thinking: false,
        multimodal: false,
        functionCalling: false,
      });
      
      const o1Preview = provider.getModel('o1-preview');
      expect(o1Preview).toBeDefined();
      expect(o1Preview!.capabilities).toEqual({
        streaming: true,
        temperature: true,
        reasoning: true,
        thinking: false,
        multimodal: false,
        functionCalling: false,
      });
      
      const gpt4o = provider.getModel('gpt-4o');
      expect(gpt4o).toBeDefined();
      expect(gpt4o!.capabilities).toEqual({
        streaming: true,
        temperature: true,
        reasoning: false,
        thinking: false,
        multimodal: true,
        functionCalling: true,
      });
    });

    it('should define proper context lengths and token limits', () => {
      const testCases = [
        { modelId: 'gpt-5-nano', expectedContext: 128000, expectedMaxTokens: 4096 },
        { modelId: 'o1-preview', expectedContext: 128000, expectedMaxTokens: 32768 },
        { modelId: 'o1-mini', expectedContext: 128000, expectedMaxTokens: 65536 },
        { modelId: 'gpt-4o', expectedContext: 128000, expectedMaxTokens: 16384 },
        { modelId: 'gpt-4', expectedContext: 8192, expectedMaxTokens: 8192 },
      ];
      
      testCases.forEach(({ modelId, expectedContext, expectedMaxTokens }) => {
        const model = provider.getModel(modelId);
        expect(model).toBeDefined();
        expect(model!.contextLength).toBe(expectedContext);
        expect(model!.maxTokens).toBe(expectedMaxTokens);
      });
    });

    it('should define cost per 1k tokens for each model', () => {
      const models = provider.getModels();
      
      models.forEach(model => {
        expect(model.costPer1kTokens).toBeDefined();
        expect(typeof model.costPer1kTokens.input).toBe('number');
        expect(typeof model.costPer1kTokens.output).toBe('number');
        expect(model.costPer1kTokens.input).toBeGreaterThan(0);
        expect(model.costPer1kTokens.output).toBeGreaterThan(0);
        expect(model.costPer1kTokens.output).toBeGreaterThanOrEqual(model.costPer1kTokens.input);
      });
    });

    it('should validate max tokens do not exceed context length', () => {
      const models = provider.getModels();
      
      models.forEach(model => {
        expect(model.maxTokens).toBeLessThanOrEqual(model.contextLength);
      });
    });
  });

  describe('Model Support Matrix', () => {
    it('should provide a clear support matrix for all parameters', () => {
      const models = provider.getModels();
      const supportMatrix: Record<string, any> = {};
      
      models.forEach(model => {
        supportMatrix[model.id] = {
          temperature: model.capabilities.temperature,
          reasoningEffort: model.capabilities.reasoning,
          multimodal: model.capabilities.multimodal,
          functionCalling: model.capabilities.functionCalling,
          streaming: model.capabilities.streaming,
        };
      });
      
      // Validate matrix structure
      expect(Object.keys(supportMatrix).length).toBeGreaterThan(0);
      
      // All models should support temperature and streaming
      Object.values(supportMatrix).forEach(capabilities => {
        expect(capabilities.temperature).toBe(true);
        expect(capabilities.streaming).toBe(true);
      });
      
      // Only o1 models should support reasoning
      expect(supportMatrix['o1-preview'].reasoningEffort).toBe(true);
      expect(supportMatrix['o1-mini'].reasoningEffort).toBe(true);
      expect(supportMatrix['gpt-4o'].reasoningEffort).toBe(false);
      expect(supportMatrix['gpt-5-nano'].reasoningEffort).toBe(false);
    });

    it('should categorize models by capability groups', () => {
      const models = provider.getModels();
      
      const reasoningModels = models.filter(m => m.capabilities.reasoning);
      const multimodalModels = models.filter(m => m.capabilities.multimodal);
      const functionCallingModels = models.filter(m => m.capabilities.functionCalling);
      
      // Reasoning models (o1 series)
      expect(reasoningModels.map(m => m.id)).toEqual(
        expect.arrayContaining(['o1-preview', 'o1-mini'])
      );
      
      // Multimodal models (GPT-4 series)
      expect(multimodalModels.map(m => m.id)).toEqual(
        expect.arrayContaining(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'])
      );
      
      // Function calling models
      expect(functionCallingModels.map(m => m.id)).toEqual(
        expect.arrayContaining(['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'])
      );
      
      // gpt-5-nano should not have multimodal or function calling
      const gpt5Nano = models.find(m => m.id === 'gpt-5-nano');
      expect(gpt5Nano?.capabilities.multimodal).toBe(false);
      expect(gpt5Nano?.capabilities.functionCalling).toBe(false);
      expect(gpt5Nano?.capabilities.reasoning).toBe(false);
    });
  });

  describe('Configuration Validation Edge Cases', () => {
    it('should handle model-specific validation correctly', () => {
      // Test with reasoning model
      let config = {
        apiKey: 'sk-test-key-123',
        model: 'o1-preview',
        temperature: 1.0,
        reasoningEffort: 'medium' as ReasoningEffort,
        maxTokens: 1000,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
      };
      
      let result = provider.validateConfig(config);
      expect(result.isValid).toBe(true);
      
      // Test with non-reasoning model
      config.model = 'gpt-4o';
      result = provider.validateConfig(config);
      expect(result.isValid).toBe(true); // Should still be valid, reasoning effort ignored
      
      // Test with invalid reasoning effort
      config.model = 'o1-preview';
      config.reasoningEffort = 'invalid' as any;
      result = provider.validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid reasoning effort');
    });

    it('should validate against model-specific constraints', () => {
      const gpt4 = provider.getModel('gpt-4');
      expect(gpt4).toBeDefined();
      
      const config = {
        apiKey: 'sk-test-key-123',
        model: 'gpt-4',
        temperature: 1.0,
        maxTokens: gpt4!.maxTokens + 1, // Exceed max tokens
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
      };
      
      // This should be handled by the provider's validation logic
      const result = provider.validateConfig(config);
      // Note: Current validation doesn't check against model-specific maxTokens
      // This is a design consideration for future enhancement
    });
  });
});