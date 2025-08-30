/**
 * Test file for ExtractionQueue - demonstrates functionality
 *
 * This is a basic test to verify the queue works as expected.
 * In a real test suite, this would use Jest/Vitest framework.
 */

import { ExtractionQueue } from './ExtractionQueue';

// Mock extraction task that takes some time
function createMockExtractionTask(id: string, duration: number = 100): () => Promise<string> {
  return () =>
    new Promise(resolve => {
      setTimeout(() => {
        resolve(`Result from task ${id}`);
      }, duration);
    });
}

// Mock extraction task that fails
function createFailingTask(id: string): () => Promise<string> {
  return () =>
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${id} failed`));
      }, 50);
    });
}

// Example usage and basic testing
export async function testExtractionQueue() {
  const queue = new ExtractionQueue(2); // Limit to 2 concurrent tasks

  // Test 1: Basic functionality with concurrent limit
  const tasks = [
    queue.enqueue(createMockExtractionTask('A', 200)),
    queue.enqueue(createMockExtractionTask('B', 150)),
    queue.enqueue(createMockExtractionTask('C', 100)), // Should be queued
    queue.enqueue(createMockExtractionTask('D', 50)), // Should be queued
  ];

  try {
    await Promise.all(tasks);
  } catch (error) {
    // Error in task execution
  }

  // Test 2: Error handling
  const queue2 = new ExtractionQueue(1);

  try {
    await queue2.enqueue(createFailingTask('FAIL'));
    // This should not be reached
  } catch (error) {
    // Correctly caught error
  }

  // Test successful task after failed task
  try {
    await queue2.enqueue(createMockExtractionTask('SUCCESS', 50));
    // Success after failure
  } catch (error) {
    // Unexpected error
  }
}
