/**
 * @file System Prompt Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getSystemPrompt,
  getCompactSystemPrompt,
  getSystemPromptForModel,
} from '@/config/systemPrompt';

describe('System Prompt Configuration', () => {
  describe('getSystemPrompt', () => {
    it('should return a comprehensive system prompt', () => {
      const prompt = getSystemPrompt();
      
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(1000);
      expect(prompt).toContain('AI assistant integrated into a privacy-focused browser extension');
      expect(prompt).toContain('Core Capabilities');
      expect(prompt).toContain('Response Guidelines');
      expect(prompt).toContain('Privacy Principles');
    });
    
    it('should include multi-tab context information', () => {
      const prompt = getSystemPrompt();
      
      expect(prompt).toContain('Multi-Tab');
      expect(prompt).toContain('@ mention system');
      expect(prompt).toContain('multiple tabs');
    });
    
    it('should include formatting guidelines', () => {
      const prompt = getSystemPrompt();
      
      expect(prompt).toContain('markdown');
      expect(prompt).toContain('code blocks');
      expect(prompt).toContain('syntax highlighting');
    });
  });
  
  describe('getCompactSystemPrompt', () => {
    it('should return a shorter system prompt', () => {
      const compactPrompt = getCompactSystemPrompt();
      const fullPrompt = getSystemPrompt();
      
      expect(compactPrompt).toBeDefined();
      expect(compactPrompt.length).toBeLessThan(fullPrompt.length);
      expect(compactPrompt.length).toBeLessThan(500);
    });
    
    it('should still contain essential information', () => {
      const prompt = getCompactSystemPrompt();
      
      expect(prompt).toContain('browser extension sidebar');
      expect(prompt).toContain('web content');
      expect(prompt).toContain('privacy');
      expect(prompt).toContain('markdown');
    });
  });
  
  describe('getSystemPromptForModel', () => {
    it('should return compact prompt for lite models', () => {
      const nanoPrompt = getSystemPromptForModel('gpt-5-nano');
      const litePrompt = getSystemPromptForModel('gemini-2.5-flash-lite');
      const compactPrompt = getCompactSystemPrompt();
      
      expect(nanoPrompt).toBe(compactPrompt);
      expect(litePrompt).toBe(compactPrompt);
    });
    
    it('should return full prompt for standard models', () => {
      const gpt5Prompt = getSystemPromptForModel('gpt-5');
      const gpt5MiniPrompt = getSystemPromptForModel('gpt-5-mini');
      const geminiPrompt = getSystemPromptForModel('gemini-2.5-pro');
      const fullPrompt = getSystemPrompt();
      
      expect(gpt5Prompt).toBe(fullPrompt);
      expect(gpt5MiniPrompt).toBe(fullPrompt);
      expect(geminiPrompt).toBe(fullPrompt);
    });
    
    it('should return full prompt for unknown models', () => {
      const unknownPrompt = getSystemPromptForModel('unknown-model');
      const fullPrompt = getSystemPrompt();
      
      expect(unknownPrompt).toBe(fullPrompt);
    });
  });
});