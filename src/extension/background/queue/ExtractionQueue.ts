/**
 * ExtractionQueue - Manages concurrent content extractions with queue system
 *
 * Limits concurrent extractions to prevent performance issues and browser throttling.
 * Implements FIFO queueing with proper error handling and Promise resolution.
 */

interface QueueTask<T> {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export class ExtractionQueue {
  private readonly maxConcurrent: number;
  private running: number;
  private queue: QueueTask<any>[];

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Enqueue a task for execution when a slot is available
   * @param task Function that returns a Promise to execute
   * @returns Promise that resolves with the task result
   */
  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queueTask: QueueTask<T> = {
        task,
        resolve,
        reject,
      };

      this.queue.push(queueTask);
      this.processNext();
    });
  }

  /**
   * Process the next task in queue if there's an available slot
   */
  private processNext(): void {
    // Check if we can start a new task
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Get the next task from the queue (FIFO)
    const queueTask = this.queue.shift();
    if (!queueTask) {
      return;
    }

    // Increment running count
    this.running++;

    // Execute the task
    this.executeTask(queueTask);
  }

  /**
   * Execute a queued task with proper error handling and cleanup
   */
  private async executeTask<T>(queueTask: QueueTask<T>): Promise<void> {
    try {
      // Execute the task
      const result = await queueTask.task();

      // Resolve the Promise
      queueTask.resolve(result);
    } catch (error) {
      // Reject the Promise with the error
      queueTask.reject(error);
    } finally {
      // Always decrement running count and process next
      this.running--;
      this.processNext();
    }
  }

  /**
   * Get current queue status for debugging
   */
  getStatus(): { running: number; queued: number; maxConcurrent: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Check if the queue has capacity for immediate execution
   */
  hasCapacity(): boolean {
    return this.running < this.maxConcurrent;
  }

  /**
   * Clear all pending tasks in the queue (does not affect running tasks)
   * Useful for cleanup or reset scenarios
   */
  clearQueue(): void {
    // Reject all pending tasks
    while (this.queue.length > 0) {
      const queueTask = this.queue.shift();
      if (queueTask) {
        queueTask.reject(new Error('Queue cleared'));
      }
    }
  }
}

// Export singleton instance for use across the extension
export const extractionQueue = new ExtractionQueue();
