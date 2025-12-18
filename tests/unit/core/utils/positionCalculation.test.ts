/**
 * @file Position Calculation Utility Tests
 *
 * Tests for dropdown positioning, caret positioning, and boundary constraints.
 */

import { describe, it, expect } from 'vitest';
import {
  getDynamicLineHeight,
  getShadowDomBounds,
  calculateDropdownPosition,
  calculateCaretDropdownPosition,
  type ElementBounds,
  type DropdownDimensions,
  type CaretPosition,
  type ScrollInfo,
} from '@core/utils/positionCalculation';

describe('getDynamicLineHeight', () => {
  describe('normal line height', () => {
    it('should calculate line height from font size with 1.2 multiplier', () => {
      const result = getDynamicLineHeight({
        lineHeight: 'normal',
        fontSize: '16px',
      });

      expect(result).toBe(16 * 1.2);
    });
  });

  describe('pixel line height', () => {
    it('should return pixel value directly', () => {
      const result = getDynamicLineHeight({
        lineHeight: '24px',
        fontSize: '16px',
      });

      expect(result).toBe(24);
    });
  });

  describe('em/rem line height', () => {
    it('should multiply em by font size', () => {
      const result = getDynamicLineHeight({
        lineHeight: '1.5em',
        fontSize: '16px',
      });

      expect(result).toBe(24);
    });

    it('should multiply rem by font size', () => {
      const result = getDynamicLineHeight({
        lineHeight: '2rem',
        fontSize: '14px',
      });

      expect(result).toBe(28);
    });
  });

  describe('unitless line height', () => {
    it('should multiply unitless value by font size', () => {
      const result = getDynamicLineHeight({
        lineHeight: '1.5',
        fontSize: '20px',
      });

      expect(result).toBe(30);
    });

    it('should use default 1.2 for invalid unitless', () => {
      const result = getDynamicLineHeight({
        lineHeight: '',
        fontSize: '16px',
      });

      expect(result).toBe(16 * 1.2);
    });
  });
});

describe('getShadowDomBounds', () => {
  it('should return container bounds when provided', () => {
    const containerBounds: ElementBounds = {
      left: 10,
      top: 20,
      right: 310,
      bottom: 220,
      width: 300,
      height: 200,
    };

    const result = getShadowDomBounds(containerBounds, { width: 1920, height: 1080 });

    expect(result).toEqual(containerBounds);
  });

  it('should return viewport bounds when container is null', () => {
    const result = getShadowDomBounds(null, { width: 1920, height: 1080 });

    expect(result).toEqual({
      left: 0,
      top: 0,
      right: 1920,
      bottom: 1080,
      width: 1920,
      height: 1080,
    });
  });
});

describe('calculateDropdownPosition', () => {
  const createTargetBounds = (overrides: Partial<ElementBounds> = {}): ElementBounds => ({
    left: 100,
    top: 100,
    right: 200,
    bottom: 130,
    width: 100,
    height: 30,
    ...overrides,
  });

  const createContainerBounds = (overrides: Partial<ElementBounds> = {}): ElementBounds => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    ...overrides,
  });

  const createDimensions = (overrides: Partial<DropdownDimensions> = {}): DropdownDimensions => ({
    width: 200,
    height: 150,
    padding: 8,
    ...overrides,
  });

  describe('default positioning', () => {
    it('should position dropdown below target by default', () => {
      const result = calculateDropdownPosition(
        createTargetBounds(),
        createDimensions(),
        createContainerBounds()
      );

      // Y should be below target (top + height)
      expect(result.y).toBeGreaterThan(100);
      expect(result.shouldFlipVertical).toBe(false);
    });

    it('should position dropdown aligned with target left edge', () => {
      const result = calculateDropdownPosition(
        createTargetBounds({ left: 100 }),
        createDimensions(),
        createContainerBounds()
      );

      expect(result.x).toBe(100);
      expect(result.shouldFlipHorizontal).toBe(false);
    });
  });

  describe('vertical flip', () => {
    it('should flip vertically when not enough space below', () => {
      const result = calculateDropdownPosition(
        createTargetBounds({ top: 500, bottom: 530 }),
        createDimensions({ height: 150 }),
        createContainerBounds({ bottom: 600 })
      );

      expect(result.shouldFlipVertical).toBe(true);
      expect(result.y).toBeLessThan(500);
    });

    it('should not flip vertically when enough space below', () => {
      const result = calculateDropdownPosition(
        createTargetBounds({ top: 100, bottom: 130 }),
        createDimensions({ height: 150 }),
        createContainerBounds({ bottom: 600 })
      );

      expect(result.shouldFlipVertical).toBe(false);
    });
  });

  describe('horizontal flip', () => {
    it('should flip horizontally when not enough space on right', () => {
      const result = calculateDropdownPosition(
        createTargetBounds({ left: 650, right: 750 }),
        createDimensions({ width: 200 }),
        createContainerBounds({ right: 800 })
      );

      expect(result.shouldFlipHorizontal).toBe(true);
      expect(result.x).toBeLessThan(650);
    });

    it('should not flip horizontally when enough space on right', () => {
      const result = calculateDropdownPosition(
        createTargetBounds({ left: 100 }),
        createDimensions({ width: 200 }),
        createContainerBounds({ right: 800 })
      );

      expect(result.shouldFlipHorizontal).toBe(false);
    });
  });

  describe('boundary constraints', () => {
    it('should keep dropdown within container bounds', () => {
      const result = calculateDropdownPosition(
        createTargetBounds({ left: 0 }),
        createDimensions({ width: 200, padding: 8 }),
        createContainerBounds()
      );

      expect(result.x).toBeGreaterThanOrEqual(8);
    });

    it('should return maxX and maxY from container', () => {
      const result = calculateDropdownPosition(
        createTargetBounds(),
        createDimensions({ padding: 8 }),
        createContainerBounds({ right: 800, bottom: 600 })
      );

      expect(result.maxX).toBe(792); // 800 - 8 padding
      expect(result.maxY).toBe(592); // 600 - 8 padding
    });
  });

  describe('scroll adjustment', () => {
    it('should adjust for scroll position', () => {
      const scrollInfo: ScrollInfo = { scrollX: 50, scrollY: 100 };
      const result = calculateDropdownPosition(
        createTargetBounds({ left: 200, top: 300 }),
        createDimensions(),
        createContainerBounds(),
        scrollInfo
      );

      // Position should be adjusted by scroll
      expect(result.x).toBeLessThan(200);
    });
  });

  describe('caret positioning', () => {
    it('should use caret position when provided', () => {
      const caretPos: CaretPosition = { x: 50, y: 10, lineHeight: 20 };
      const result = calculateDropdownPosition(
        createTargetBounds({ left: 100, top: 100 }),
        createDimensions(),
        createContainerBounds(),
        { scrollX: 0, scrollY: 0 },
        caretPos
      );

      // Should be positioned relative to caret, not target
      expect(result.x).toBe(150); // target.left + caret.x
    });
  });

  describe('default padding', () => {
    it('should use default padding of 8 when not specified', () => {
      const result = calculateDropdownPosition(
        createTargetBounds(),
        { width: 200, height: 150 }, // No padding specified
        createContainerBounds({ right: 800, bottom: 600 })
      );

      expect(result.maxX).toBe(792); // 800 - 8 default padding
    });
  });
});

describe('calculateCaretDropdownPosition', () => {
  it('should delegate to calculateDropdownPosition with caret position', () => {
    const targetBounds: ElementBounds = {
      left: 100,
      top: 100,
      right: 300,
      bottom: 150,
      width: 200,
      height: 50,
    };
    const dimensions: DropdownDimensions = { width: 200, height: 150 };
    const containerBounds: ElementBounds = {
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
    };
    const caretPos: CaretPosition = { x: 50, y: 10, lineHeight: 20 };

    const result = calculateCaretDropdownPosition(
      targetBounds,
      dimensions,
      containerBounds,
      caretPos
    );

    expect(result).toHaveProperty('x');
    expect(result).toHaveProperty('y');
    expect(result).toHaveProperty('shouldFlipVertical');
    expect(result).toHaveProperty('shouldFlipHorizontal');
  });
});
