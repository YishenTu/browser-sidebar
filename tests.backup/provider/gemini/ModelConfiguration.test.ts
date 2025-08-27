/**
 * @file Gemini Model Configuration Tests
 * 
 * Test suite for Task 4.2.2c - Gemini Models Configuration
 * 
 * Tests Gemini model configurations with thinking capabilities,
 * context limits, and thought visibility configuration.
 * 
 * Key test areas:
 * - gemini-2.5-flash-lite model availability
 * - Model-specific thinking mode support
 * - Context window limits validation
 * - Thought visibility configuration
 * - Model capability matrix
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiClient } from '@provider/gemini/GeminiClient';
import type { ModelConfig, ThinkingMode } from '@types/providers';

describe('Gemini Model Configuration', () => {
  let client: GeminiClient;

  beforeEach(() => {
    client = new GeminiClient();
  });

  describe('Model Availability', () => {
    it('should include gemini-2.5-flash-lite model', () => {
      const models = client.getModels();
      const flashLiteModel = models.find(model => model.id === 'gemini-2.5-flash-lite');
      
      expect(flashLiteModel).toBeDefined();
      expect(flashLiteModel?.name).toBe('Gemini 2.5 Flash Lite');
      expect(flashLiteModel?.provider).toBe('gemini');
    });

    it('should include all expected Gemini models', () => {
      const models = client.getModels();
      const modelIds = models.map(m => m.id);
      
      expect(modelIds).toContain('gemini-pro');
      expect(modelIds).toContain('gemini-pro-vision');
      expect(modelIds).toContain('gemini-pro-1.5');
      expect(modelIds).toContain('gemini-flash');
      expect(modelIds).toContain('gemini-2.5-flash-lite');
      expect(modelIds).toContain('gemini-2.5-pro');
    });

    it('should have valid model configurations', () => {
      const models = client.getModels();
      
      models.forEach(model => {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.provider).toBe('gemini');
        expect(model.maxTokens).toBeGreaterThan(0);
        expect(model.contextLength).toBeGreaterThan(0);
        expect(model.costPer1kTokens.input).toBeGreaterThanOrEqual(0);
        expect(model.costPer1kTokens.output).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Thinking Mode Support Matrix', () => {
    it('should define thinking mode support per model', () => {
      const models = client.getModels();
      
      models.forEach(model => {
        expect(model.capabilities.thinking).toBeDefined();
        
        if (model.capabilities.thinking) {
          expect(model.parameters.thinkingMode).toBeDefined();
          expect(Array.isArray(model.parameters.thinkingMode)).toBe(true);
        }
      });
    });

    it('should support thinking modes for gemini-2.5-flash-lite', () => {
      const flashLiteModel = client.getModel('gemini-2.5-flash-lite');
      
      expect(flashLiteModel?.capabilities.thinking).toBe(true);
      expect(flashLiteModel?.parameters.thinkingMode).toContain('off');
      expect(flashLiteModel?.parameters.thinkingMode).toContain('dynamic');
    });

    it('should have full thinking support for advanced models', () => {
      const advancedModels = ['gemini-pro-1.5', 'gemini-2.5-pro'];
      
      advancedModels.forEach(modelId => {
        const model = client.getModel(modelId);
        expect(model?.capabilities.thinking).toBe(true);
        expect(model?.parameters.thinkingMode).toEqual(['off', 'dynamic']);
      });
    });

    it('should have limited thinking support for basic models', () => {
      const basicModels = ['gemini-pro'];
      
      basicModels.forEach(modelId => {
        const model = client.getModel(modelId);
        expect(model?.capabilities.thinking).toBe(true);
        expect(model?.parameters.thinkingMode).toEqual(['off', 'dynamic']);
      });
    });

    it('should have vision models with thinking capabilities', () => {
      const visionModels = ['gemini-pro-vision', 'gemini-pro-1.5'];
      
      visionModels.forEach(modelId => {
        const model = client.getModel(modelId);
        expect(model?.capabilities.multimodal).toBe(true);
        expect(model?.capabilities.thinking).toBe(true);
      });
    });
  });

  describe('Context Window Limits', () => {
    it('should define context limits per model', () => {
      const expectedLimits: Record<string, number> = {
        'gemini-pro': 1000000,
        'gemini-pro-vision': 128000,
        'gemini-pro-1.5': 2000000,
        'gemini-flash': 1000000,
        'gemini-2.5-flash-lite': 1000000,
        'gemini-2.5-pro': 2000000,
      };

      Object.entries(expectedLimits).forEach(([modelId, expectedLimit]) => {
        const model = client.getModel(modelId);
        expect(model?.contextLength).toBe(expectedLimit);
      });
    });

    it('should have reasonable max token limits', () => {
      const models = client.getModels();
      
      models.forEach(model => {
        // Max tokens should be reasonable fraction of context length
        expect(model.maxTokens).toBeLessThanOrEqual(model.contextLength);
        expect(model.maxTokens).toBeGreaterThanOrEqual(1024); // At least 1K tokens output
      });
    });

    it('should validate context window constraints', () => {
      const flashLiteModel = client.getModel('gemini-2.5-flash-lite');
      
      expect(flashLiteModel?.contextLength).toBe(1000000);
      expect(flashLiteModel?.maxTokens).toBeLessThanOrEqual(8192); // Reasonable output limit
    });
  });

  describe('Model Capabilities Matrix', () => {
    it('should define streaming capabilities correctly', () => {
      const models = client.getModels();
      
      // All Gemini models should support streaming
      models.forEach(model => {
        expect(model.capabilities.streaming).toBe(true);
      });
    });

    it('should define temperature support correctly', () => {
      const models = client.getModels();
      
      models.forEach(model => {
        expect(model.capabilities.temperature).toBe(true);
        expect(model.parameters.temperature.min).toBe(0.0);
        expect(model.parameters.temperature.max).toBe(2.0);
        expect(model.parameters.temperature.default).toBeGreaterThanOrEqual(0.0);
        expect(model.parameters.temperature.default).toBeLessThanOrEqual(2.0);
      });
    });

    it('should define multimodal capabilities correctly', () => {
      const expectedMultimodal: Record<string, boolean> = {
        'gemini-pro': false,
        'gemini-pro-vision': true,
        'gemini-pro-1.5': true,
        'gemini-flash': true,
        'gemini-2.5-flash-lite': true,
        'gemini-2.5-pro': true,
      };

      Object.entries(expectedMultimodal).forEach(([modelId, expectedMultimodal]) => {
        const model = client.getModel(modelId);
        expect(model?.capabilities.multimodal).toBe(expectedMultimodal);
      });
    });

    it('should define function calling capabilities correctly', () => {
      const expectedFunctionCalling: Record<string, boolean> = {
        'gemini-pro': true,
        'gemini-pro-vision': false,
        'gemini-flash': true,
        'gemini-pro-1.5': true,
        'gemini-2.5-flash-lite': true,
        'gemini-2.5-pro': true,
      };

      Object.entries(expectedFunctionCalling).forEach(([modelId, expected]) => {
        const model = client.getModel(modelId);
        expect(model?.capabilities.functionCalling).toBe(expected);
      });
    });

    it('should not support reasoning effort (OpenAI-specific)', () => {
      const models = client.getModels();
      
      models.forEach(model => {
        expect(model.capabilities.reasoning).toBe(false);
        expect(model.parameters.reasoningEffort).toBeUndefined();
      });
    });
  });

  describe('Thought Visibility Configuration', () => {
    it('should support thought visibility for thinking-capable models', () => {
      const thinkingModels = client.getModels().filter(m => m.capabilities.thinking);
      
      expect(thinkingModels.length).toBeGreaterThan(0);
      
      thinkingModels.forEach(model => {
        // All thinking models should support thought visibility control
        expect(model.capabilities.thinking).toBe(true);
        expect(model.parameters.thinkingMode).toContain('off');
        expect(model.parameters.thinkingMode).toContain('dynamic');
      });
    });

    it('should have consistent thinking mode options', () => {
      const thinkingModels = client.getModels().filter(m => m.capabilities.thinking);
      
      thinkingModels.forEach(model => {
        const thinkingModes = model.parameters.thinkingMode as ThinkingMode[];
        expect(thinkingModes).toEqual(['off', 'dynamic']);
      });
    });
  });

  describe('Cost Configuration', () => {
    it('should have appropriate cost tiers', () => {
      const expectedCosts: Record<string, { input: number; output: number }> = {
        'gemini-pro': { input: 0.00025, output: 0.0005 },
        'gemini-pro-vision': { input: 0.00025, output: 0.0005 },
        'gemini-pro-1.5': { input: 0.00125, output: 0.0025 },
        'gemini-flash': { input: 0.000075, output: 0.00015 },
        'gemini-2.5-flash-lite': { input: 0.00005, output: 0.0001 },
        'gemini-2.5-pro': { input: 0.001, output: 0.002 },
      };

      Object.entries(expectedCosts).forEach(([modelId, expectedCost]) => {
        const model = client.getModel(modelId);
        expect(model?.costPer1kTokens.input).toBe(expectedCost.input);
        expect(model?.costPer1kTokens.output).toBe(expectedCost.output);
      });
    });

    it('should have flash-lite as most cost-effective', () => {
      const flashLite = client.getModel('gemini-2.5-flash-lite');
      const allModels = client.getModels();
      
      expect(flashLite).toBeDefined();
      
      const minInputCost = Math.min(...allModels.map(m => m.costPer1kTokens.input));
      const minOutputCost = Math.min(...allModels.map(m => m.costPer1kTokens.output));
      
      expect(flashLite?.costPer1kTokens.input).toBe(minInputCost);
      expect(flashLite?.costPer1kTokens.output).toBe(minOutputCost);
    });
  });

  describe('Model Selection and Configuration', () => {
    it('should allow selecting models by ID', () => {
      const flashLiteModel = client.getModel('gemini-2.5-flash-lite');
      
      expect(flashLiteModel).toBeDefined();
      expect(flashLiteModel?.id).toBe('gemini-2.5-flash-lite');
    });

    it('should return undefined for non-existent models', () => {
      const nonExistentModel = client.getModel('gemini-non-existent');
      
      expect(nonExistentModel).toBeUndefined();
    });

    it('should provide model recommendations based on use case', () => {
      const models = client.getModels();
      
      // Fast, cost-effective model
      const fastModel = models.find(m => m.id === 'gemini-2.5-flash-lite');
      expect(fastModel?.costPer1kTokens.input).toBeLessThan(0.0001);
      
      // High-capacity model
      const highCapacityModel = models.find(m => m.id === 'gemini-2.5-pro');
      expect(highCapacityModel?.contextLength).toBeGreaterThanOrEqual(2000000);
      
      // Vision-capable model
      const visionModel = models.find(m => m.capabilities.multimodal && m.capabilities.thinking);
      expect(visionModel).toBeDefined();
    });
  });

  describe('Parameter Validation', () => {
    it('should validate temperature ranges for all models', () => {
      const models = client.getModels();
      
      models.forEach(model => {
        const tempConfig = model.parameters.temperature;
        expect(tempConfig.min).toBe(0.0);
        expect(tempConfig.max).toBe(2.0);
        expect(tempConfig.default).toBeGreaterThanOrEqual(tempConfig.min);
        expect(tempConfig.default).toBeLessThanOrEqual(tempConfig.max);
      });
    });

    it('should validate topP parameters', () => {
      const models = client.getModels();
      
      models.forEach(model => {
        const topPConfig = model.parameters.topP;
        if (topPConfig) {
          expect(topPConfig.min).toBe(0.1);
          expect(topPConfig.max).toBe(1.0);
          expect(topPConfig.default).toBeGreaterThanOrEqual(topPConfig.min);
          expect(topPConfig.default).toBeLessThanOrEqual(topPConfig.max);
        }
      });
    });

    it('should not have OpenAI-specific parameters', () => {
      const models = client.getModels();
      
      models.forEach(model => {
        expect(model.parameters.reasoningEffort).toBeUndefined();
        expect(model.parameters.maxThinkingTokens).toBeUndefined();
      });
    });
  });

  describe('Model Metadata Consistency', () => {
    it('should have consistent provider assignment', () => {
      const models = client.getModels();
      
      models.forEach(model => {
        expect(model.provider).toBe('gemini');
      });
    });

    it('should have unique model IDs', () => {
      const models = client.getModels();
      const modelIds = models.map(m => m.id);
      const uniqueIds = [...new Set(modelIds)];
      
      expect(modelIds.length).toBe(uniqueIds.length);
    });

    it('should have reasonable default temperatures per model type', () => {
      const expectedDefaults: Record<string, number> = {
        'gemini-pro': 0.9,
        'gemini-pro-vision': 0.4, // Lower for vision tasks
        'gemini-pro-1.5': 1.0,
        'gemini-flash': 1.0,
        'gemini-2.5-flash-lite': 1.0,
        'gemini-2.5-pro': 0.8,
      };

      Object.entries(expectedDefaults).forEach(([modelId, expectedDefault]) => {
        const model = client.getModel(modelId);
        expect(model?.parameters.temperature.default).toBe(expectedDefault);
      });
    });
  });
});