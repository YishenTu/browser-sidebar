/**
 * @file Geometry Utility Tests
 *
 * Tests for geometric calculations including position constraints,
 * resize calculations, and cursor mappings.
 */

import { describe, it, expect } from 'vitest';
import {
  constrainPosition,
  constrainSize,
  calculateNewSizeAndPosition,
  getCursorForHandle,
  type Position,
  type Size,
  type Bounds,
  type SizeBounds,
} from '@core/utils/geometry';

describe('constrainPosition', () => {
  describe('basic constraints', () => {
    it('should return unchanged position when no bounds provided', () => {
      const pos: Position = { x: 100, y: 200 };
      const result = constrainPosition(pos);

      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should return unchanged position when within bounds', () => {
      const pos: Position = { x: 50, y: 50 };
      const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

      const result = constrainPosition(pos, bounds);

      expect(result).toEqual({ x: 50, y: 50 });
    });
  });

  describe('horizontal constraints', () => {
    it('should constrain x to minX', () => {
      const pos: Position = { x: -10, y: 50 };
      const bounds: Bounds = { minX: 0 };

      const result = constrainPosition(pos, bounds);

      expect(result.x).toBe(0);
      expect(result.y).toBe(50);
    });

    it('should constrain x to maxX', () => {
      const pos: Position = { x: 150, y: 50 };
      const bounds: Bounds = { maxX: 100 };

      const result = constrainPosition(pos, bounds);

      expect(result.x).toBe(100);
    });
  });

  describe('vertical constraints', () => {
    it('should constrain y to minY', () => {
      const pos: Position = { x: 50, y: -20 };
      const bounds: Bounds = { minY: 0 };

      const result = constrainPosition(pos, bounds);

      expect(result.y).toBe(0);
    });

    it('should constrain y to maxY', () => {
      const pos: Position = { x: 50, y: 200 };
      const bounds: Bounds = { maxY: 100 };

      const result = constrainPosition(pos, bounds);

      expect(result.y).toBe(100);
    });
  });

  describe('combined constraints', () => {
    it('should constrain both x and y simultaneously', () => {
      const pos: Position = { x: -10, y: 200 };
      const bounds: Bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

      const result = constrainPosition(pos, bounds);

      expect(result).toEqual({ x: 0, y: 100 });
    });
  });

  describe('undefined bounds', () => {
    it('should treat undefined bounds as infinity', () => {
      const pos: Position = { x: -1000, y: 1000 };
      const bounds: Bounds = {}; // All undefined

      const result = constrainPosition(pos, bounds);

      expect(result).toEqual({ x: -1000, y: 1000 });
    });
  });
});

describe('constrainSize', () => {
  describe('basic constraints', () => {
    it('should return unchanged size when within bounds', () => {
      const size: Size = { width: 100, height: 100 };

      const result = constrainSize(size);

      expect(result).toEqual({ width: 100, height: 100 });
    });

    it('should constrain to minimum size', () => {
      const size: Size = { width: 10, height: 10 };
      const minSize: Size = { width: 50, height: 50 };

      const result = constrainSize(size, minSize);

      expect(result).toEqual({ width: 50, height: 50 });
    });

    it('should constrain to maximum size', () => {
      const size: Size = { width: 500, height: 500 };
      const minSize: Size = { width: 0, height: 0 };
      const maxSize: Size = { width: 200, height: 200 };

      const result = constrainSize(size, minSize, maxSize);

      expect(result).toEqual({ width: 200, height: 200 });
    });
  });

  describe('mixed constraints', () => {
    it('should constrain width to min and height to max', () => {
      const size: Size = { width: 10, height: 500 };
      const minSize: Size = { width: 50, height: 50 };
      const maxSize: Size = { width: 200, height: 200 };

      const result = constrainSize(size, minSize, maxSize);

      expect(result).toEqual({ width: 50, height: 200 });
    });
  });

  describe('default bounds', () => {
    it('should use default minSize of 0', () => {
      const size: Size = { width: -10, height: -10 };

      const result = constrainSize(size);

      expect(result).toEqual({ width: 0, height: 0 });
    });

    it('should use default maxSize of Infinity', () => {
      const size: Size = { width: 10000, height: 10000 };

      const result = constrainSize(size);

      expect(result).toEqual({ width: 10000, height: 10000 });
    });
  });
});

describe('calculateNewSizeAndPosition', () => {
  const sizeBounds: SizeBounds = {
    minWidth: 100,
    maxWidth: 500,
    minHeight: 100,
    maxHeight: 500,
  };

  const startSize: Size = { width: 200, height: 200 };
  const startMousePos: Position = { x: 0, y: 0 };

  describe('east (e) handle', () => {
    it('should increase width when dragging right', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: 50, y: 0 },
        'e',
        sizeBounds
      );

      expect(result.size.width).toBe(250);
      expect(result.size.height).toBe(200);
      expect(result.deltaPosition.x).toBe(0);
    });

    it('should decrease width when dragging left', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: -50, y: 0 },
        'e',
        sizeBounds
      );

      expect(result.size.width).toBe(150);
    });

    it('should respect maxWidth', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: 400, y: 0 },
        'e',
        sizeBounds
      );

      expect(result.size.width).toBe(500);
    });

    it('should respect minWidth', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: -150, y: 0 },
        'e',
        sizeBounds
      );

      expect(result.size.width).toBe(100);
    });
  });

  describe('west (w) handle', () => {
    it('should increase width and move position when dragging left', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: -50, y: 0 },
        'w',
        sizeBounds
      );

      expect(result.size.width).toBe(250);
      expect(result.deltaPosition.x).toBe(-50);
    });

    it('should decrease width and move position when dragging right', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: 50, y: 0 },
        'w',
        sizeBounds
      );

      expect(result.size.width).toBe(150);
      expect(result.deltaPosition.x).toBe(50);
    });
  });

  describe('south (s) handle', () => {
    it('should increase height when dragging down', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: 0, y: 50 },
        's',
        sizeBounds
      );

      expect(result.size.height).toBe(250);
      expect(result.deltaPosition.y).toBe(0);
    });
  });

  describe('north (n) handle', () => {
    it('should increase height and move position when dragging up', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: 0, y: -50 },
        'n',
        sizeBounds
      );

      expect(result.size.height).toBe(250);
      expect(result.deltaPosition.y).toBe(-50);
    });
  });

  describe('corner handles', () => {
    it('should handle southeast (se) - both dimensions', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: 50, y: 50 },
        'se',
        sizeBounds
      );

      expect(result.size.width).toBe(250);
      expect(result.size.height).toBe(250);
      expect(result.deltaPosition).toEqual({ x: 0, y: 0 });
    });

    it('should handle northwest (nw) - both dimensions with position change', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: -50, y: -50 },
        'nw',
        sizeBounds
      );

      expect(result.size.width).toBe(250);
      expect(result.size.height).toBe(250);
      expect(result.deltaPosition).toEqual({ x: -50, y: -50 });
    });

    it('should handle northeast (ne)', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: 50, y: -50 },
        'ne',
        sizeBounds
      );

      expect(result.size.width).toBe(250);
      expect(result.size.height).toBe(250);
      expect(result.deltaPosition.x).toBe(0);
      expect(result.deltaPosition.y).toBe(-50);
    });

    it('should handle southwest (sw)', () => {
      const result = calculateNewSizeAndPosition(
        startSize,
        startMousePos,
        { x: -50, y: 50 },
        'sw',
        sizeBounds
      );

      expect(result.size.width).toBe(250);
      expect(result.size.height).toBe(250);
      expect(result.deltaPosition.x).toBe(-50);
      expect(result.deltaPosition.y).toBe(0);
    });
  });
});

describe('getCursorForHandle', () => {
  it('should return ns-resize for north handle', () => {
    expect(getCursorForHandle('n')).toBe('ns-resize');
  });

  it('should return ns-resize for south handle', () => {
    expect(getCursorForHandle('s')).toBe('ns-resize');
  });

  it('should return ew-resize for east handle', () => {
    expect(getCursorForHandle('e')).toBe('ew-resize');
  });

  it('should return ew-resize for west handle', () => {
    expect(getCursorForHandle('w')).toBe('ew-resize');
  });

  it('should return nesw-resize for northeast handle', () => {
    expect(getCursorForHandle('ne')).toBe('nesw-resize');
  });

  it('should return nesw-resize for southwest handle', () => {
    expect(getCursorForHandle('sw')).toBe('nesw-resize');
  });

  it('should return nwse-resize for northwest handle', () => {
    expect(getCursorForHandle('nw')).toBe('nwse-resize');
  });

  it('should return nwse-resize for southeast handle', () => {
    expect(getCursorForHandle('se')).toBe('nwse-resize');
  });
});
