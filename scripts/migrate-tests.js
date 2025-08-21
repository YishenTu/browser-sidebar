#!/usr/bin/env node

/**
 * Test Migration Script - Task 0.2
 *
 * This script automatically updates import paths in test files according to the refactoring plan.
 * It migrates imports from the old component structure to the new unified sidebar structure.
 *
 * Usage:
 *   node scripts/migrate-tests.js           # Run the migration
 *   node scripts/migrate-tests.js --dry-run # Preview changes without modifying files
 *   node scripts/migrate-tests.js --help    # Show help
 *
 * Import transformations:
 *   @/components/Chat/* → @sidebar/components/*
 *   @/components/ui/*   → @sidebar/components/ui/*
 *   @/hooks/*           → @sidebar/hooks/*
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TEST_DIRS = ['tests/components/Chat', 'tests/components/ui', 'tests/sidebar'];

// Import transformation rules
const IMPORT_TRANSFORMATIONS = [
  {
    from: /@\/components\/Chat\//g,
    to: '@sidebar/components/',
    description: 'Chat components to sidebar components',
  },
  {
    from: /@\/components\/ui\//g,
    to: '@sidebar/components/ui/',
    description: 'UI components to sidebar UI components',
  },
  {
    from: /@\/hooks\//g,
    to: '@sidebar/hooks/',
    description: 'Hooks to sidebar hooks',
  },
];

// Command line arguments
const isDryRun = process.argv.includes('--dry-run');
const showHelp = process.argv.includes('--help');

// Statistics tracking
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  importsUpdated: 0,
  errors: [],
};

/**
 * Display help information
 */
function showHelpText() {
  console.log(`
Test Migration Script - Refactoring Task 0.2

USAGE:
  node scripts/migrate-tests.js [OPTIONS]

OPTIONS:
  --dry-run    Preview changes without modifying files
  --help       Show this help message

DESCRIPTION:
  Automatically updates import paths in test files for the refactoring:
  
  TRANSFORMATIONS:
    @/components/Chat/* → @sidebar/components/*
    @/components/ui/*   → @sidebar/components/ui/*  
    @/hooks/*           → @sidebar/hooks/*

  FILES PROCESSED:
    - tests/components/Chat/*.test.tsx
    - tests/components/ui/*.test.tsx
    - tests/sidebar/*.test.tsx

EXAMPLES:
  node scripts/migrate-tests.js           # Run migration
  node scripts/migrate-tests.js --dry-run # Preview only
`);
}

/**
 * Get the project root directory
 */
function getProjectRoot() {
  return path.resolve(__dirname, '..');
}

/**
 * Recursively find all test files in a directory
 */
function findTestFiles(dirPath) {
  const files = [];

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findTestFiles(fullPath));
    } else if (item.endsWith('.test.tsx') || item.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Get all test files that need processing
 */
function getAllTestFiles() {
  const projectRoot = getProjectRoot();
  const allFiles = [];

  for (const testDir of TEST_DIRS) {
    const fullPath = path.join(projectRoot, testDir);
    allFiles.push(...findTestFiles(fullPath));
  }

  return allFiles;
}

/**
 * Apply import transformations to file content
 */
function transformImports(content, filePath) {
  let updatedContent = content;
  let transformationsApplied = 0;
  const appliedTransformations = [];

  for (const transformation of IMPORT_TRANSFORMATIONS) {
    const originalContent = updatedContent;
    updatedContent = updatedContent.replace(transformation.from, transformation.to);

    // Count how many replacements were made
    const matches = (originalContent.match(transformation.from) || []).length;
    if (matches > 0) {
      transformationsApplied += matches;
      appliedTransformations.push({
        description: transformation.description,
        count: matches,
      });
    }
  }

  return {
    content: updatedContent,
    transformationsApplied,
    appliedTransformations,
    hasChanges: content !== updatedContent,
  };
}

/**
 * Process a single test file
 */
function processFile(filePath) {
  try {
    stats.filesProcessed++;

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Apply transformations
    const result = transformImports(content, filePath);

    if (result.hasChanges) {
      stats.filesModified++;
      stats.importsUpdated += result.transformationsApplied;

      // Log the changes
      const relativePath = path.relative(getProjectRoot(), filePath);
      console.log(`\n📝 ${relativePath}`);

      for (const transformation of result.appliedTransformations) {
        console.log(`  ├─ ${transformation.description}: ${transformation.count} import(s)`);
      }

      // Write updated content (unless dry run)
      if (!isDryRun) {
        fs.writeFileSync(filePath, result.content, 'utf8');
        console.log(`  └─ ✅ File updated`);
      } else {
        console.log(`  └─ 👁️  Preview only (--dry-run mode)`);
      }
    }

    return result;
  } catch (error) {
    const relativePath = path.relative(getProjectRoot(), filePath);
    const errorMsg = `Error processing ${relativePath}: ${error.message}`;
    stats.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
    return null;
  }
}

/**
 * Validate that we can access all necessary files
 */
function validateFileAccess() {
  const projectRoot = getProjectRoot();
  const errors = [];

  // Check if project root exists
  if (!fs.existsSync(projectRoot)) {
    errors.push(`Project root not found: ${projectRoot}`);
    return errors;
  }

  // Check each test directory
  for (const testDir of TEST_DIRS) {
    const fullPath = path.join(projectRoot, testDir);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  Directory not found (skipping): ${testDir}`);
    }
  }

  return errors;
}

/**
 * Display a preview of files that would be processed
 */
function showPreview(files) {
  console.log(`\n📂 Files to be processed (${files.length} total):`);

  const filesByDir = {};
  for (const file of files) {
    const relativePath = path.relative(getProjectRoot(), file);
    const dir = path.dirname(relativePath);

    if (!filesByDir[dir]) {
      filesByDir[dir] = [];
    }
    filesByDir[dir].push(path.basename(relativePath));
  }

  for (const [dir, fileList] of Object.entries(filesByDir)) {
    console.log(`\n  ${dir}/`);
    for (const file of fileList) {
      console.log(`    ├─ ${file}`);
    }
  }

  console.log('\n🔄 Import transformations to be applied:');
  for (const transformation of IMPORT_TRANSFORMATIONS) {
    const fromPattern = transformation.from.source.replace(/\\\//g, '/');
    console.log(`  ├─ ${fromPattern} → ${transformation.to}`);
  }
}

/**
 * Display final statistics
 */
function showStats() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No files were modified');
  }

  console.log(`📁 Files processed: ${stats.filesProcessed}`);
  console.log(`✏️  Files modified: ${stats.filesModified}`);
  console.log(`🔗 Imports updated: ${stats.importsUpdated}`);

  if (stats.errors.length > 0) {
    console.log(`❌ Errors: ${stats.errors.length}`);
    for (const error of stats.errors) {
      console.log(`   • ${error}`);
    }
  }

  if (stats.filesModified === 0 && stats.errors.length === 0) {
    console.log('\n✨ No changes needed - all import paths are already up to date!');
  } else if (stats.errors.length === 0) {
    if (isDryRun) {
      console.log('\n✅ Preview completed successfully! Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('   1. Run tests to verify everything works: npm test');
      console.log('   2. Check git diff to review all changes');
      console.log(
        '   3. Commit the migration: git add . && git commit -m "migrate: update test import paths"'
      );
    }
  } else {
    console.log('\n⚠️  Migration completed with errors. Please review and fix the issues above.');
  }
}

/**
 * Main execution function
 */
function main() {
  console.log('🚀 Test Migration Script - Refactoring Task 0.2\n');

  // Show help if requested
  if (showHelp) {
    showHelpText();
    return;
  }

  // Show mode
  if (isDryRun) {
    console.log('🔍 Running in DRY RUN mode - files will not be modified\n');
  }

  // Validate file access
  const validationErrors = validateFileAccess();
  if (validationErrors.length > 0) {
    console.error('❌ Validation failed:');
    for (const error of validationErrors) {
      console.error(`   • ${error}`);
    }
    process.exit(1);
  }

  // Get all test files
  const testFiles = getAllTestFiles();

  if (testFiles.length === 0) {
    console.log('ℹ️  No test files found to process.');
    return;
  }

  // Show preview
  showPreview(testFiles);

  // Process files
  console.log('\n🔄 Processing files...');

  for (const filePath of testFiles) {
    processFile(filePath);
  }

  // Show final statistics
  showStats();
}

// Error handling for the script
process.on('uncaughtException', error => {
  console.error('\n❌ Unexpected error:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled promise rejection:', reason);
  process.exit(1);
});

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { transformImports, getAllTestFiles, IMPORT_TRANSFORMATIONS };
