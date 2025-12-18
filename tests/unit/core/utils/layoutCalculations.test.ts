/**
 * @file Layout Calculations Tests
 *
 * Tests for layout position and size calculations.
 */

import { describe, it, expect } from 'vitest';
import {
  getInitialY,
  getSidebarHeight,
  getInitialX,
  getMaxHeight,
  calculateInitialLayout,
  type ViewportDimensions,
  type LayoutConfig,
} from '@core/utils/layoutCalculations';

describe('getInitialY', () => {
  it('should calculate Y position for vertically centered layout', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1080 };
    const heightRatio = 0.8;

    const result = getInitialY(viewport, heightRatio);

    // (1 - 0.8) / 2 = 0.1, 1080 * 0.1 = 108
    expect(result).toBe(108);
  });

  it('should handle 100% height ratio', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1080 };
    const result = getInitialY(viewport, 1.0);

    expect(result).toBe(0);
  });

  it('should handle 50% height ratio', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1000 };
    const result = getInitialY(viewport, 0.5);

    expect(result).toBe(250);
  });

  it('should round the result', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1001 };
    const result = getInitialY(viewport, 0.8);

    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('getSidebarHeight', () => {
  it('should calculate height based on viewport and ratio', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1080 };
    const result = getSidebarHeight(viewport, 0.8, 300);

    expect(result).toBe(864); // 1080 * 0.8 = 864
  });

  it('should not clamp to minimum by default', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 400 };
    const result = getSidebarHeight(viewport, 0.5, 300);

    expect(result).toBe(200); // 400 * 0.5 = 200 < 300, but no clamping
  });

  it('should clamp to minimum when clampToMin is true', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 400 };
    const result = getSidebarHeight(viewport, 0.5, 300, true);

    expect(result).toBe(300); // Clamped to minHeight
  });

  it('should not clamp when calculated height exceeds minimum', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1000 };
    const result = getSidebarHeight(viewport, 0.8, 300, true);

    expect(result).toBe(800); // 1000 * 0.8 = 800 > 300
  });

  it('should round the result', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1001 };
    const result = getSidebarHeight(viewport, 0.8, 300);

    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('getInitialX', () => {
  it('should calculate X position for right-aligned layout', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1080 };
    const result = getInitialX(viewport, 400, 20);

    expect(result).toBe(1500); // 1920 - 400 - 20
  });

  it('should handle zero padding', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1080 };
    const result = getInitialX(viewport, 400, 0);

    expect(result).toBe(1520); // 1920 - 400
  });

  it('should handle large padding', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1080 };
    const result = getInitialX(viewport, 400, 100);

    expect(result).toBe(1420); // 1920 - 400 - 100
  });
});

describe('getMaxHeight', () => {
  it('should return viewport height rounded', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1080 };
    const result = getMaxHeight(viewport);

    expect(result).toBe(1080);
  });

  it('should round the result', () => {
    const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1080.7 };
    const result = getMaxHeight(viewport);

    expect(result).toBe(1081);
  });
});

describe('calculateInitialLayout', () => {
  const viewport: ViewportDimensions = { innerWidth: 1920, innerHeight: 1080 };

  const config: LayoutConfig = {
    minWidth: 300,
    maxWidth: 600,
    defaultWidth: 400,
    minHeight: 200,
    heightRatio: 0.8,
    rightPadding: 20,
  };

  it('should calculate complete initial layout', () => {
    const result = calculateInitialLayout(viewport, config);

    expect(result).toEqual({
      x: 1500, // 1920 - 400 - 20
      y: 108, // (1 - 0.8) / 2 * 1080 = 108
      width: 400,
      height: 864, // 1080 * 0.8
    });
  });

  it('should use defaultWidth', () => {
    const result = calculateInitialLayout(viewport, { ...config, defaultWidth: 500 });

    expect(result.width).toBe(500);
    expect(result.x).toBe(1400); // 1920 - 500 - 20
  });

  it('should use heightRatio', () => {
    const result = calculateInitialLayout(viewport, { ...config, heightRatio: 0.5 });

    expect(result.height).toBe(540); // 1080 * 0.5
    expect(result.y).toBe(270); // (1 - 0.5) / 2 * 1080
  });

  it('should use rightPadding', () => {
    const result = calculateInitialLayout(viewport, { ...config, rightPadding: 50 });

    expect(result.x).toBe(1470); // 1920 - 400 - 50
  });

  describe('layout invariants', () => {
    it('should maintain x + width + padding = viewport width', () => {
      const result = calculateInitialLayout(viewport, config);

      expect(result.x + result.width + config.rightPadding).toBe(viewport.innerWidth);
    });

    it('should maintain y + height + y = viewport height for centered layout', () => {
      const result = calculateInitialLayout(viewport, config);
      const topMargin = result.y;
      const bottomMargin = viewport.innerHeight - result.y - result.height;

      // Top and bottom margins should be equal for centered layout
      expect(topMargin).toBe(bottomMargin);
    });
  });
});
