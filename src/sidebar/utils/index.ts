/**
 * Sidebar Utilities
 *
 * Collection of utility functions for the sidebar components
 */

export {
  calculateDropdownPosition,
  calculateCaretDropdownPosition,
  getCaretPosition,
  getDynamicLineHeight,
  applyDropdownPosition,
  createPositionTracker,
  useDropdownPosition,
  type DropdownPosition,
  type DropdownDimensions,
  type CaretPosition,
} from './dropdownPosition';

export { formatTabContent, type TabFormatResult, type FormatOptions } from './contentFormatter';

export { getDomSafeFaviconUrlSync } from './favicon';
