/**
 * @file Main exports for all type definitions
 * 
 * This file exports all TypeScript type definitions used throughout
 * the browser sidebar extension project.
 */

// Chrome manifest types and utilities
export * from './manifest';

// Message types and protocol
export * from './messages';

// Note: CSS module declarations are in css.d.ts as ambient declarations
// and don't need to be re-exported here