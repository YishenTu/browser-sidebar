/**
 * @file Engine Service Module
 *
 * Central export point for engine management functionality
 */

// Export everything from the main service
export * from './EngineManagerService';

// Export validation functions
export * from './ValidationService';

// Import for re-export with better names
import {
  EngineManagerService,
  engineManager,
  createEngineManagerService,
} from './EngineManagerService';
import type { EngineStats, EngineManagerConfig } from './EngineManagerService';

// Re-export with better names
export {
  EngineManagerService,
  engineManager,
  createEngineManagerService,
  type EngineStats,
  type EngineManagerConfig,
};

// Default export
export default EngineManagerService;
