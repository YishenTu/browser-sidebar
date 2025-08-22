/**
 * @file Sensitive Pattern Detection Tests
 *
 * Comprehensive test suite for sensitive data pattern detection following TDD approach.
 * Tests cover SSN detection, credit card detection, email detection, phone detection,
 * API key detection, false positive prevention, and performance with large text.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Types for the pattern detection system we'll implement
interface PatternMatch {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
  metadata?: Record<string, any>;
}

interface DetectionResult {
  matches: PatternMatch[];
  totalMatches: number;
  highConfidenceMatches: number;
  processingTimeMs: number;
}

interface PatternDetectorConfig {
  minConfidence?: number;
  enabledPatterns?: string[];
  maxTextLength?: number;
  timeout?: number;
}

// Import the pattern detection classes we'll implement
import {
  PatternDetector,
  SSNPattern,
  CreditCardPattern,
  EmailPattern,
  PhoneNumberPattern,
  APIKeyPattern,
  type SensitivePattern,
} from '@/security/patterns';

describe('SensitivePattern Base Class', () => {
  describe('Pattern Interface', () => {
    it('should define required pattern interface', () => {
      // Test that the base SensitivePattern interface exists and has required methods
      expect(typeof SSNPattern).toBe('function');
      expect(typeof CreditCardPattern).toBe('function');
      expect(typeof EmailPattern).toBe('function');
      expect(typeof PhoneNumberPattern).toBe('function');
      expect(typeof APIKeyPattern).toBe('function');
    });

    it('should have detect method returning PatternMatch array', async () => {
      const ssnPattern = new SSNPattern();
      const result = await ssnPattern.detect('Test text with no matches');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should have getType method returning pattern type', () => {
      const ssnPattern = new SSNPattern();
      expect(typeof ssnPattern.getType()).toBe('string');
      expect(ssnPattern.getType()).toBe('ssn');
    });

    it('should have confidence scoring between 0 and 1', async () => {
      const ssnPattern = new SSNPattern();
      const result = await ssnPattern.detect('123-45-6789');
      
      if (result.length > 0) {
        expect(result[0].confidence).toBeGreaterThanOrEqual(0);
        expect(result[0].confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('SSNPattern', () => {
  let ssnPattern: SSNPattern;

  beforeEach(() => {
    ssnPattern = new SSNPattern();
  });

  describe('Valid SSN Detection', () => {
    it('should detect standard XXX-XX-XXXX format', async () => {
      const text = 'My SSN is 123-45-6789 for verification.';
      const matches = await ssnPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('ssn');
      expect(matches[0].value).toBe('123-45-6789');
      expect(matches[0].startIndex).toBe(10);
      expect(matches[0].endIndex).toBe(21);
      expect(matches[0].confidence).toBeGreaterThan(0.8);
    });

    it('should detect XXXXXXXXX format (no hyphens)', async () => {
      const text = 'Social Security Number: 123456789';
      const matches = await ssnPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('123456789');
      expect(matches[0].confidence).toBeGreaterThan(0.7);
    });

    it('should detect XXX XX XXXX format (spaces)', async () => {
      const text = 'Please provide your SSN: 123 45 6789';
      const matches = await ssnPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('123 45 6789');
      expect(matches[0].confidence).toBeGreaterThan(0.8);
    });

    it('should handle multiple SSNs in text', async () => {
      const text = 'Person A: 123-45-6789, Person B: 987-65-4321';
      const matches = await ssnPattern.detect(text);
      
      expect(matches).toHaveLength(2);
      expect(matches[0].value).toBe('123-45-6789');
      expect(matches[1].value).toBe('987-65-4321');
    });
  });

  describe('Invalid SSN Rejection', () => {
    it('should reject invalid area numbers (000, 666, 900-999)', async () => {
      const invalidSSNs = [
        '000-12-3456',
        '666-12-3456', 
        '900-12-3456',
        '999-12-3456'
      ];
      
      for (const ssn of invalidSSNs) {
        const matches = await ssnPattern.detect(`SSN: ${ssn}`);
        if (matches.length > 0) {
          expect(matches[0].confidence).toBeLessThan(0.5);
        }
      }
    });

    it('should reject invalid group numbers (00)', async () => {
      const text = 'Invalid SSN: 123-00-6789';
      const matches = await ssnPattern.detect(text);
      
      if (matches.length > 0) {
        expect(matches[0].confidence).toBeLessThan(0.5);
      }
    });

    it('should reject invalid serial numbers (0000)', async () => {
      const text = 'Invalid SSN: 123-45-0000';
      const matches = await ssnPattern.detect(text);
      
      if (matches.length > 0) {
        expect(matches[0].confidence).toBeLessThan(0.5);
      }
    });

    it('should not match phone numbers that look like SSNs', async () => {
      const text = 'Call me at 123-456-7890';
      const matches = await ssnPattern.detect(text);
      
      expect(matches).toHaveLength(0);
    });
  });

  describe('Context Awareness', () => {
    it('should have higher confidence when SSN context words are present', async () => {
      const contextText = 'Social Security Number: 123-45-6789';
      const noContextText = 'Random number: 123-45-6789';
      
      const contextMatches = await ssnPattern.detect(contextText);
      const noContextMatches = await ssnPattern.detect(noContextText);
      
      if (contextMatches.length > 0 && noContextMatches.length > 0) {
        expect(contextMatches[0].confidence).toBeGreaterThan(noContextMatches[0].confidence);
      }
    });

    it('should detect SSN in various contexts', async () => {
      const contexts = [
        'SSN: 123-45-6789',
        'Social Security: 123-45-6789',
        'Soc Sec Num: 123-45-6789',
        'Tax ID: 123-45-6789'
      ];
      
      for (const context of contexts) {
        const matches = await ssnPattern.detect(context);
        expect(matches).toHaveLength(1);
        expect(matches[0].confidence).toBeGreaterThan(0.7);
      }
    });
  });
});

describe('CreditCardPattern', () => {
  let ccPattern: CreditCardPattern;

  beforeEach(() => {
    ccPattern = new CreditCardPattern();
  });

  describe('Major Card Brands Detection', () => {
    it('should detect Visa cards (4xxx)', async () => {
      const text = 'My Visa card: 4111-1111-1111-1111';
      const matches = await ccPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('credit_card');
      expect(matches[0].value).toBe('4111-1111-1111-1111');
      expect(matches[0].metadata?.brand).toBe('visa');
      expect(matches[0].confidence).toBeGreaterThan(0.8);
    });

    it('should detect Mastercard (5xxx)', async () => {
      const text = 'Mastercard number: 5555555555554444';
      const matches = await ccPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('5555555555554444');
      expect(matches[0].metadata?.brand).toBe('mastercard');
    });

    it('should detect American Express (34xx, 37xx)', async () => {
      const text = 'AMEX: 3782-822463-10005';
      const matches = await ccPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('3782-822463-10005');
      expect(matches[0].metadata?.brand).toBe('amex');
    });

    it('should detect Discover (6xxx)', async () => {
      const text = 'Discover card: 6011111111111117';
      const matches = await ccPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('6011111111111117');
      expect(matches[0].metadata?.brand).toBe('discover');
    });
  });

  describe('Various Formats', () => {
    it('should detect cards with hyphens', async () => {
      const text = 'Card: 4111-1111-1111-1111';
      const matches = await ccPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('4111-1111-1111-1111');
    });

    it('should detect cards with spaces', async () => {
      const text = 'Card: 4111 1111 1111 1111';
      const matches = await ccPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('4111 1111 1111 1111');
    });

    it('should detect cards without separators', async () => {
      const text = 'Card: 4111111111111111';
      const matches = await ccPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('4111111111111111');
    });
  });

  describe('Luhn Algorithm Validation', () => {
    it('should validate using Luhn algorithm', async () => {
      const validCard = '4111111111111111'; // Valid test card
      const invalidCard = '4111111111111112'; // Invalid checksum
      
      const validMatches = await ccPattern.detect(`Card: ${validCard}`);
      const invalidMatches = await ccPattern.detect(`Card: ${invalidCard}`);
      
      expect(validMatches).toHaveLength(1);
      expect(validMatches[0].confidence).toBeGreaterThan(0.8);
      
      if (invalidMatches.length > 0) {
        expect(invalidMatches[0].confidence).toBeLessThan(0.6);
      }
    });

    it('should reject numbers that fail Luhn algorithm', async () => {
      const invalidCards = [
        '4111111111111110',
        '5555555555554445',
        '378282246310006'
      ];
      
      for (const card of invalidCards) {
        const matches = await ccPattern.detect(`Card: ${card}`);
        if (matches.length > 0) {
          expect(matches[0].confidence).toBeLessThan(0.7);
        }
      }
    });
  });

  describe('Context Awareness', () => {
    it('should have higher confidence with credit card context words', async () => {
      const contexts = [
        'Credit card: 4111111111111111',
        'Card number: 4111111111111111',
        'Visa: 4111111111111111',
        'Payment card: 4111111111111111'
      ];
      
      for (const context of contexts) {
        const matches = await ccPattern.detect(context);
        expect(matches).toHaveLength(1);
        expect(matches[0].confidence).toBeGreaterThan(0.8);
      }
    });
  });
});

describe('EmailPattern', () => {
  let emailPattern: EmailPattern;

  beforeEach(() => {
    emailPattern = new EmailPattern();
  });

  describe('Standard Email Formats', () => {
    it('should detect basic email addresses', async () => {
      const text = 'Contact us at support@example.com for help.';
      const matches = await emailPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('email');
      expect(matches[0].value).toBe('support@example.com');
      expect(matches[0].confidence).toBeGreaterThan(0.8);
    });

    it('should detect emails with subdomains', async () => {
      const text = 'Email: admin@mail.company.co.uk';
      const matches = await emailPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('admin@mail.company.co.uk');
    });

    it('should detect emails with numbers and special characters', async () => {
      const emails = [
        'user123@example.com',
        'first.last@company.org',
        'user_name@test-domain.net',
        'user+tag@example.com'
      ];
      
      for (const email of emails) {
        const matches = await emailPattern.detect(`Email: ${email}`);
        expect(matches).toHaveLength(1);
        expect(matches[0].value).toBe(email);
        expect(matches[0].confidence).toBeGreaterThan(0.7);
      }
    });

    it('should handle multiple emails in text', async () => {
      const text = 'Contact sales@company.com or support@company.com';
      const matches = await emailPattern.detect(text);
      
      expect(matches).toHaveLength(2);
      expect(matches[0].value).toBe('sales@company.com');
      expect(matches[1].value).toBe('support@company.com');
    });
  });

  describe('Domain Validation', () => {
    it('should reject invalid domain formats', async () => {
      const invalidEmails = [
        'user@domain',
        'user@.com',
        'user@domain.',
        'user@domain..com'
      ];
      
      for (const email of invalidEmails) {
        const matches = await emailPattern.detect(`Email: ${email}`);
        if (matches.length > 0) {
          expect(matches[0].confidence).toBeLessThan(0.5);
        }
      }
    });

    it('should validate common TLDs', async () => {
      const validEmails = [
        'user@example.com',
        'user@example.org',
        'user@example.net',
        'user@example.gov',
        'user@example.edu'
      ];
      
      for (const email of validEmails) {
        const matches = await emailPattern.detect(`Email: ${email}`);
        expect(matches).toHaveLength(1);
        expect(matches[0].confidence).toBeGreaterThan(0.8);
      }
    });
  });

  describe('International Support', () => {
    it('should detect international domain extensions', async () => {
      const intlEmails = [
        'user@example.co.uk',
        'user@example.com.au',
        'user@example.de',
        'user@example.fr'
      ];
      
      for (const email of intlEmails) {
        const matches = await emailPattern.detect(`Email: ${email}`);
        expect(matches).toHaveLength(1);
        expect(matches[0].confidence).toBeGreaterThan(0.7);
      }
    });
  });

  describe('Context Awareness', () => {
    it('should have higher confidence with email context words', async () => {
      const contexts = [
        'Email: user@example.com',
        'Contact: user@example.com',
        'Send to user@example.com',
        'From: user@example.com'
      ];
      
      for (const context of contexts) {
        const matches = await emailPattern.detect(context);
        expect(matches).toHaveLength(1);
        expect(matches[0].confidence).toBeGreaterThan(0.8);
      }
    });
  });
});

describe('PhoneNumberPattern', () => {
  let phonePattern: PhoneNumberPattern;

  beforeEach(() => {
    phonePattern = new PhoneNumberPattern();
  });

  describe('US Phone Number Formats', () => {
    it('should detect (XXX) XXX-XXXX format', async () => {
      const text = 'Call me at (555) 123-4567';
      const matches = await phonePattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('phone');
      expect(matches[0].value).toBe('(555) 123-4567');
      expect(matches[0].metadata?.country).toBe('US');
      expect(matches[0].confidence).toBeGreaterThan(0.8);
    });

    it('should detect XXX-XXX-XXXX format', async () => {
      const text = 'Phone: 555-123-4567';
      const matches = await phonePattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('555-123-4567');
      expect(matches[0].metadata?.country).toBe('US');
    });

    it('should detect XXX.XXX.XXXX format', async () => {
      const text = 'Number: 555.123.4567';
      const matches = await phonePattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('555.123.4567');
    });

    it('should detect XXXXXXXXXX format (10 digits)', async () => {
      const text = 'Phone: 5551234567';
      const matches = await phonePattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('5551234567');
    });

    it('should detect +1 XXX XXX XXXX format', async () => {
      const text = 'International: +1 555 123 4567';
      const matches = await phonePattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('+1 555 123 4567');
      expect(matches[0].metadata?.country).toBe('US');
    });
  });

  describe('International Phone Numbers', () => {
    it('should detect UK numbers (+44)', async () => {
      const text = 'UK office: +44 20 7946 0958';
      const matches = await phonePattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('+44 20 7946 0958');
      expect(matches[0].metadata?.country).toBe('UK');
    });

    it('should detect various country codes', async () => {
      const intlNumbers = [
        '+33 1 42 86 83 26', // France
        '+49 30 12345678',   // Germany
        '+81 3 1234 5678',   // Japan
        '+86 10 1234 5678'   // China
      ];
      
      for (const number of intlNumbers) {
        const matches = await phonePattern.detect(`Phone: ${number}`);
        expect(matches).toHaveLength(1);
        expect(matches[0].value).toBe(number);
        expect(matches[0].confidence).toBeGreaterThan(0.7);
      }
    });
  });

  describe('Invalid Phone Rejection', () => {
    it('should reject invalid US area codes', async () => {
      const invalidNumbers = [
        '000-123-4567',
        '111-123-4567',
        '911-123-4567'
      ];
      
      for (const number of invalidNumbers) {
        const matches = await phonePattern.detect(`Phone: ${number}`);
        if (matches.length > 0) {
          expect(matches[0].confidence).toBeLessThan(0.6);
        }
      }
    });

    it('should not match numbers that are too short or too long', async () => {
      const invalidNumbers = [
        '123-456',      // Too short
        '123-456-78901' // Too long
      ];
      
      for (const number of invalidNumbers) {
        const matches = await phonePattern.detect(`Number: ${number}`);
        expect(matches).toHaveLength(0);
      }
    });
  });

  describe('Context Awareness', () => {
    it('should have higher confidence with phone context words', async () => {
      const contexts = [
        'Phone: (555) 123-4567',
        'Call: (555) 123-4567',
        'Tel: (555) 123-4567',
        'Mobile: (555) 123-4567'
      ];
      
      for (const context of contexts) {
        const matches = await phonePattern.detect(context);
        expect(matches).toHaveLength(1);
        expect(matches[0].confidence).toBeGreaterThan(0.8);
      }
    });
  });
});

describe('APIKeyPattern', () => {
  let apiKeyPattern: APIKeyPattern;

  beforeEach(() => {
    apiKeyPattern = new APIKeyPattern();
  });

  describe('Common API Key Formats', () => {
    it('should detect OpenAI API keys', async () => {
      const text = 'API_KEY=sk-1234567890abcdefghijklmnopqrstuvwxyz';
      const matches = await apiKeyPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('api_key');
      expect(matches[0].value).toBe('sk-1234567890abcdefghijklmnopqrstuvwxyz');
      expect(matches[0].metadata?.provider).toBe('openai');
      expect(matches[0].confidence).toBeGreaterThan(0.9);
    });

    it('should detect AWS access keys', async () => {
      const text = 'AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF';
      const matches = await apiKeyPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('AKIA1234567890ABCDEF');
      expect(matches[0].metadata?.provider).toBe('aws');
    });

    it('should detect GitHub tokens', async () => {
      const text = 'GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz';
      const matches = await apiKeyPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
      expect(matches[0].metadata?.provider).toBe('github');
    });

    it('should detect Google API keys', async () => {
      const text = 'GOOGLE_API_KEY=AIza1234567890abcdefghijklmnopqrstuvwxyz';
      const matches = await apiKeyPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('AIza1234567890abcdefghijklmnopqrstuvwxyz');
      expect(matches[0].metadata?.provider).toBe('google');
    });

    it('should detect Anthropic API keys', async () => {
      const text = 'ANTHROPIC_API_KEY=sk-ant-api-1234567890abcdefghijklmnopqrstuvwxyz';
      const matches = await apiKeyPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe('sk-ant-api-1234567890abcdefghijklmnopqrstuvwxyz');
      expect(matches[0].metadata?.provider).toBe('anthropic');
    });
  });

  describe('Generic API Key Patterns', () => {
    it('should detect hex-encoded keys', async () => {
      const text = 'API_KEY=deadbeef1234567890abcdef1234567890abcdef';
      const matches = await apiKeyPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBeGreaterThan(0.7);
    });

    it('should detect base64-encoded keys', async () => {
      const text = 'TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const matches = await apiKeyPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBeGreaterThan(0.8);
    });

    it('should detect UUID-format keys', async () => {
      const text = 'API_KEY=12345678-1234-1234-1234-123456789abc';
      const matches = await apiKeyPattern.detect(text);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBeGreaterThan(0.7);
    });
  });

  describe('Context Awareness', () => {
    it('should have higher confidence with API key context words', async () => {
      const contexts = [
        'API_KEY=sk-1234567890abcdef',
        'api-key: sk-1234567890abcdef',
        'Authorization: Bearer sk-1234567890abcdef',
        'X-API-Key: sk-1234567890abcdef'
      ];
      
      for (const context of contexts) {
        const matches = await apiKeyPattern.detect(context);
        expect(matches).toHaveLength(1);
        expect(matches[0].confidence).toBeGreaterThan(0.8);
      }
    });

    it('should detect keys in various formats', async () => {
      const formats = [
        'API_KEY="sk-1234567890abcdef"',
        "API_KEY='sk-1234567890abcdef'",
        'API_KEY: sk-1234567890abcdef',
        'api_key = sk-1234567890abcdef'
      ];
      
      for (const format of formats) {
        const matches = await apiKeyPattern.detect(format);
        expect(matches).toHaveLength(1);
        expect(matches[0].confidence).toBeGreaterThan(0.8);
      }
    });
  });
});

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  describe('Basic Detection', () => {
    it('should create detector with default configuration', () => {
      expect(detector).toBeInstanceOf(PatternDetector);
    });

    it('should create detector with custom configuration', () => {
      const config: PatternDetectorConfig = {
        minConfidence: 0.8,
        enabledPatterns: ['ssn', 'email'],
        maxTextLength: 50000,
        timeout: 5000
      };
      
      const customDetector = new PatternDetector(config);
      expect(customDetector).toBeInstanceOf(PatternDetector);
    });

    it('should detect multiple pattern types in text', async () => {
      const text = `
        Contact info:
        Email: john.doe@company.com
        Phone: (555) 123-4567
        SSN: 123-45-6789
        Credit Card: 4111-1111-1111-1111
        API Key: sk-1234567890abcdefghijklmnopqrstuvwxyz
      `;
      
      const result = await detector.detectAll(text);
      
      expect(result.matches.length).toBeGreaterThanOrEqual(5);
      expect(result.totalMatches).toBe(result.matches.length);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      
      // Verify each pattern type is detected
      const types = new Set(result.matches.map(m => m.type));
      expect(types.has('email')).toBe(true);
      expect(types.has('phone')).toBe(true);
      expect(types.has('ssn')).toBe(true);
      expect(types.has('credit_card')).toBe(true);
      expect(types.has('api_key')).toBe(true);
    });

    it('should filter by minimum confidence', async () => {
      const text = 'SSN: 123-45-6789 and Email: user@example.com';
      
      const highConfidenceDetector = new PatternDetector({ minConfidence: 0.9 });
      const lowConfidenceDetector = new PatternDetector({ minConfidence: 0.1 });
      
      const highResults = await highConfidenceDetector.detectAll(text);
      const lowResults = await lowConfidenceDetector.detectAll(text);
      
      expect(highResults.matches.length).toBeLessThanOrEqual(lowResults.matches.length);
      expect(highResults.highConfidenceMatches).toBeLessThanOrEqual(lowResults.highConfidenceMatches);
    });
  });

  describe('Configuration and Filtering', () => {
    it('should respect enabled patterns configuration', async () => {
      const text = 'Email: user@example.com and Phone: (555) 123-4567';
      
      const emailOnlyDetector = new PatternDetector({ 
        enabledPatterns: ['email'] 
      });
      
      const result = await emailOnlyDetector.detectAll(text);
      
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].type).toBe('email');
    });

    it('should handle text length limits', async () => {
      const longText = 'a'.repeat(100000) + ' email@example.com';
      
      const limitedDetector = new PatternDetector({ 
        maxTextLength: 1000 
      });
      
      const result = await limitedDetector.detectAll(longText);
      
      expect(result.matches).toHaveLength(0); // Email should be truncated out
    });

    it('should handle timeout configuration', async () => {
      const text = 'Normal text with email@example.com';
      
      const timeoutDetector = new PatternDetector({ 
        timeout: 1 // Very short timeout
      });
      
      // Should either complete quickly or timeout gracefully
      const result = await timeoutDetector.detectAll(text);
      expect(result).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Performance Testing', () => {
    it('should handle large text efficiently', async () => {
      // Create 10KB of text with embedded sensitive data
      const sensitiveData = [
        'SSN: 123-45-6789',
        'Email: user@example.com', 
        'Phone: (555) 123-4567',
        'Card: 4111-1111-1111-1111',
        'API: sk-1234567890abcdefghijklmnopqrstuvwxyz'
      ];
      
      const filler = 'Lorem ipsum dolor sit amet '.repeat(100);
      const largeText = Array(20).fill(0).map((_, i) => 
        filler + sensitiveData[i % sensitiveData.length]
      ).join('\n');
      
      const startTime = Date.now();
      const result = await detector.detectAll(largeText);
      const endTime = Date.now();
      
      expect(result.matches.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in <5s
      expect(result.processingTimeMs).toBeLessThan(5000);
    });

    it('should perform consistently across multiple runs', async () => {
      const text = 'Contact: email@example.com, phone: (555) 123-4567';
      const times: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const result = await detector.detectAll(text);
        times.push(result.processingTimeMs);
        expect(result.matches).toHaveLength(2);
      }
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      expect(avgTime).toBeLessThan(100); // Average should be fast
      expect(maxTime - minTime).toBeLessThan(50); // Consistent performance
    });
  });

  describe('False Positive Prevention', () => {
    it('should not detect SSNs in phone numbers', async () => {
      const text = 'Call me at 123-456-7890'; // Looks like SSN but is phone
      const result = await detector.detectAll(text);
      
      const ssnMatches = result.matches.filter(m => m.type === 'ssn');
      expect(ssnMatches).toHaveLength(0);
      
      const phoneMatches = result.matches.filter(m => m.type === 'phone');
      expect(phoneMatches).toHaveLength(1);
    });

    it('should not detect credit cards in account numbers', async () => {
      const text = 'Account #: 1234567890123456'; // 16 digits but not a valid CC
      const result = await detector.detectAll(text);
      
      const ccMatches = result.matches.filter(m => m.type === 'credit_card');
      if (ccMatches.length > 0) {
        expect(ccMatches[0].confidence).toBeLessThan(0.7);
      }
    });

    it('should not detect emails in file paths', async () => {
      const text = 'File path: /home/user@localhost/file.txt';
      const result = await detector.detectAll(text);
      
      const emailMatches = result.matches.filter(m => m.type === 'email');
      if (emailMatches.length > 0) {
        expect(emailMatches[0].confidence).toBeLessThan(0.6);
      }
    });

    it('should not detect API keys in random hex strings', async () => {
      const text = 'Checksum: deadbeef1234567890abcdef';
      const result = await detector.detectAll(text);
      
      const apiKeyMatches = result.matches.filter(m => m.type === 'api_key');
      if (apiKeyMatches.length > 0) {
        expect(apiKeyMatches[0].confidence).toBeLessThan(0.6);
      }
    });

    it('should distinguish between similar patterns', async () => {
      const text = `
        Phone: 123-456-7890
        SSN: 123-45-6789
        Date: 12/34/5678
      `;
      
      const result = await detector.detectAll(text);
      
      const phoneMatches = result.matches.filter(m => m.type === 'phone');
      const ssnMatches = result.matches.filter(m => m.type === 'ssn');
      
      expect(phoneMatches).toHaveLength(1);
      expect(ssnMatches).toHaveLength(1);
      expect(phoneMatches[0].value).toBe('123-456-7890');
      expect(ssnMatches[0].value).toBe('123-45-6789');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const result = await detector.detectAll('');
      
      expect(result.matches).toHaveLength(0);
      expect(result.totalMatches).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle whitespace-only text', async () => {
      const result = await detector.detectAll('   \n\t  ');
      
      expect(result.matches).toHaveLength(0);
      expect(result.totalMatches).toBe(0);
    });

    it('should handle very long lines', async () => {
      const longLine = 'a'.repeat(10000) + 'email@example.com' + 'b'.repeat(10000);
      const result = await detector.detectAll(longLine);
      
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].type).toBe('email');
    });

    it('should handle special characters and unicode', async () => {
      const text = '🎉 Contact: user@example.com 中文 phone: (555) 123-4567 ñáéí';
      const result = await detector.detectAll(text);
      
      expect(result.matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed input gracefully', async () => {
      const malformedInputs = [
        null as any,
        undefined as any,
        123 as any,
        {} as any,
        [] as any
      ];
      
      for (const input of malformedInputs) {
        await expect(detector.detectAll(input)).rejects.toThrow();
      }
    });

    it('should continue processing after pattern errors', async () => {
      // This test would require mocking pattern classes to throw errors
      // For now, we'll test that the detector doesn't crash on edge cases
      const edgeCaseText = '\\x00\\xFF email@example.com \\u0000 phone: (555) 123-4567';
      
      const result = await detector.detectAll(edgeCaseText);
      expect(result).toBeDefined();
      expect(result.matches.length).toBeGreaterThan(0);
    });
  });
});

describe('Integration Tests', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  describe('Real-world Text Scenarios', () => {
    it('should detect patterns in email content', async () => {
      const emailContent = `
        From: support@company.com
        To: customer@example.org
        Subject: Account Information
        
        Dear Customer,
        
        Your account details:
        - Phone: (555) 123-4567
        - SSN (last 4): xxx-xx-6789
        
        For security, please provide your full SSN: 123-45-6789
        Credit card ending in 1111: 4111-1111-1111-1111
        
        API access: sk-1234567890abcdefghijklmnopqrstuvwxyz
        
        Best regards,
        Support Team
      `;
      
      const result = await detector.detectAll(emailContent);
      
      expect(result.matches.length).toBeGreaterThanOrEqual(6);
      
      const types = result.matches.map(m => m.type);
      expect(types).toContain('email');
      expect(types).toContain('phone');
      expect(types).toContain('ssn');
      expect(types).toContain('credit_card');
      expect(types).toContain('api_key');
    });

    it('should detect patterns in configuration files', async () => {
      const configContent = `
        # Application Configuration
        DATABASE_URL=postgresql://user:pass@localhost/db
        EMAIL_SERVICE=smtp://admin@company.com:pass@mail.company.com
        
        # API Keys
        OPENAI_API_KEY=sk-1234567890abcdefghijklmnopqrstuvwxyz
        AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF
        GITHUB_TOKEN=ghp_abcdef1234567890
        
        # Contact Information
        SUPPORT_PHONE=(555) 123-4567
        ADMIN_EMAIL=admin@company.com
        
        # Test Data
        TEST_SSN=123-45-6789
        TEST_CC=4111-1111-1111-1111
      `;
      
      const result = await detector.detectAll(configContent);
      
      expect(result.matches.length).toBeGreaterThanOrEqual(7);
      
      const apiKeyMatches = result.matches.filter(m => m.type === 'api_key');
      expect(apiKeyMatches.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle mixed content with overlapping patterns', async () => {
      const mixedContent = `
        Customer Service: Call us at support@company.com or (555) 123-4567
        For account verification, provide SSN: 123-45-6789
        Payment method: Card ending in 1111 (full: 4111-1111-1111-1111)
        API documentation: Use key sk-1234567890abcdefghijklmnopqrstuvwxyz
        
        Note: Phone numbers like 123-45-6789 are not SSNs!
        Email-like strings: user@notarealdomainnamethatdoesntexist
        Fake API: not-a-real-api-key-123456789
      `;
      
      const result = await detector.detectAll(mixedContent);
      
      expect(result.matches.length).toBeGreaterThan(4);
      
      // Verify high-confidence matches
      const highConfidenceMatches = result.matches.filter(m => m.confidence > 0.8);
      expect(highConfidenceMatches.length).toBeGreaterThan(3);
    });
  });
});