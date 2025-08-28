/**
 * Test file for ExtractionQueue - demonstrates functionality
 * 
 * This is a basic test to verify the queue works as expected.
 * In a real test suite, this would use Jest/Vitest framework.
 */

import { ExtractionQueue } from './ExtractionQueue';

// Mock extraction task that takes some time
function createMockExtractionTask(id: string, duration: number = 100): () => Promise<string> {
  return () => new Promise((resolve) => {
    setTimeout(() => {
      console.log(`Task ${id} completed after ${duration}ms`);
      resolve(`Result from task ${id}`);
    }, duration);
  });
}

// Mock extraction task that fails
function createFailingTask(id: string): () => Promise<string> {
  return () => new Promise((_, reject) => {
    setTimeout(() => {
      console.log(`Task ${id} failed`);
      reject(new Error(`Task ${id} failed`));
    }, 50);
  });
}

// Example usage and basic testing
export async function testExtractionQueue() {
  console.log('Testing ExtractionQueue...');
  
  const queue = new ExtractionQueue(2); // Limit to 2 concurrent tasks
  
  console.log('Initial status:', queue.getStatus());
  
  // Test 1: Basic functionality with concurrent limit
  console.log('\n--- Test 1: Concurrent limit ---');
  const tasks = [
    queue.enqueue(createMockExtractionTask('A', 200)),
    queue.enqueue(createMockExtractionTask('B', 150)),
    queue.enqueue(createMockExtractionTask('C', 100)), // Should be queued
    queue.enqueue(createMockExtractionTask('D', 50))   // Should be queued
  ];
  
  console.log('After enqueueing 4 tasks:', queue.getStatus());
  
  try {
    const results = await Promise.all(tasks);
    console.log('All tasks completed:', results);
  } catch (error) {
    console.error('Error in task execution:', error);
  }
  
  console.log('Final status:', queue.getStatus());
  
  // Test 2: Error handling
  console.log('\n--- Test 2: Error handling ---');
  const queue2 = new ExtractionQueue(1);
  
  try {
    const result = await queue2.enqueue(createFailingTask('FAIL'));
    console.log('This should not be reached:', result);
  } catch (error) {
    console.log('Correctly caught error:', (error as Error).message);
  }
  
  // Test successful task after failed task
  try {
    const result = await queue2.enqueue(createMockExtractionTask('SUCCESS', 50));
    console.log('Success after failure:', result);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
  
  console.log('\nExtractionQueue tests completed!');
}

// Uncomment to run the test
// testExtractionQueue().catch(console.error);