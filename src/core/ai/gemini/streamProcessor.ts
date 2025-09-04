/**
 * @file Gemini Stream Processor
 *
 * Processes streaming responses from Gemini API incrementally without
 * buffering the entire response. Supports both JSON array and SSE formats.
 */

/**
 * State for tracking JSON object parsing
 */
interface ParseState {
  // Shared buffer used primarily for array mode
  buffer: string;
  // String parsing state for object scanning
  inString: boolean;
  depth: number;
  // Array streaming state
  arrayStarted: boolean;
  arrayEnded: boolean;
  pendingArrayItems: unknown[];
  // SSE/NDJSON incremental parsing buffer
  sseBuffer: string;
  // Detected format mode
  mode: 'unknown' | 'array' | 'sse';
}

/**
 * Process streaming data from Gemini API
 */
export class GeminiStreamProcessor {
  private state: ParseState = {
    buffer: '',
    inString: false,
    depth: 0,
    arrayStarted: false,
    arrayEnded: false,
    pendingArrayItems: [],
    sseBuffer: '',
    mode: 'unknown',
  };

  /**
   * Process a chunk of streaming data
   * @param chunk Raw text chunk from stream
   * @returns Array of parsed JSON objects ready for processing
   */
  processChunk(chunk: string): unknown[] {
    if (this.state.arrayEnded) {
      // One array per stream; ignore any further input until reset
      return [];
    }

    // Append to primary buffer (used for mode detection and array parsing)
    this.state.buffer += chunk;

    // Detect mode once
    if (this.state.mode === 'unknown') {
      const trimmed = this.state.buffer.trimStart();
      if (trimmed.startsWith('[')) {
        this.state.mode = 'array';
        this.state.arrayStarted = true;
        // Strip the opening '[' only once
        const index = this.state.buffer.indexOf('[');
        this.state.buffer = this.state.buffer.slice(index + 1);
      } else {
        this.state.mode = 'sse';
      }
    }

    if (this.state.mode === 'array') {
      return this.extractJsonArrayItems();
    }
    // SSE/NDJSON mode
    return this.extractSseObjects();
  }

  /**
   * Extract complete JSON objects from buffer
   */
  private extractJsonArrayItems(): unknown[] {
    const emitted: unknown[] = [];

    while (this.state.buffer.length > 0) {
      // Trim leading whitespace
      const before = this.state.buffer;
      this.state.buffer = this.state.buffer.trimStart();
      if (this.state.buffer.length === 0) break;

      const ch = this.state.buffer[0];

      // End of array
      if (ch === ']') {
        // Consume ']'
        this.state.buffer = this.state.buffer.slice(1).trimStart();
        // Emit all pending items at array end
        emitted.push(...this.state.pendingArrayItems);
        // Clear state for array mode; prevent accepting a second array
        this.state.pendingArrayItems = [];
        this.state.buffer = '';
        this.state.arrayStarted = false;
        this.state.arrayEnded = true;
        break;
      }

      // Skip comma separators between objects
      if (ch === ',') {
        this.state.buffer = this.state.buffer.slice(1);
        continue;
      }

      // Parse a complete object if present
      if (ch === '{') {
        const end = this.findObjectEnd();
        if (end !== -1) {
          const objectStr = this.state.buffer.slice(0, end + 1);
          this.state.buffer = this.state.buffer.slice(end + 1);
          try {
            const obj = JSON.parse(objectStr);
            this.state.pendingArrayItems.push(obj);
          } catch {
            // If parsing fails, skip a char to avoid infinite loops
            this.state.buffer = this.state.buffer.slice(1);
          }
          continue;
        }
        // Need more data
        break;
      }

      // Unexpected characters: skip one to make progress
      if (before === this.state.buffer) {
        this.state.buffer = this.state.buffer.slice(1);
      }
    }

    return emitted;
  }

  /**
   * Find the end of a JSON object in the buffer
   * @returns Index of closing brace or -1 if incomplete
   */
  private findObjectEnd(): number {
    let depth = 0;
    let inString = false;

    for (let i = 0; i < this.state.buffer.length; i++) {
      const char = this.state.buffer[i];

      if (char === '"') {
        // Count preceding backslashes to determine if quote is escaped
        let bsCount = 0;
        let j = i - 1;
        while (j >= 0 && this.state.buffer[j] === '\\') {
          bsCount++;
          j--;
        }
        const escaped = bsCount % 2 === 1;
        if (!escaped) {
          inString = !inString;
        }
        continue;
      }

      if (inString) {
        continue; // Ignore structure chars inside strings
      }

      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }

    return -1; // Incomplete
  }

  /**
   * Extract SSE/NDJSON objects from buffer
   */
  private extractSseObjects(): unknown[] {
    const results: unknown[] = [];
    const lines = this.state.buffer.split('\n');

    // Keep the last (possibly incomplete) line in buffer
    // But if there's only one line with no newline, try to parse it as NDJSON
    if (lines.length === 1 && !this.state.buffer.endsWith('\n')) {
      const firstLine = lines[0];
      if (firstLine) {
        const line = firstLine.trim();
        if (line && !line.startsWith('data: ')) {
          try {
            const obj = JSON.parse(line);
            results.push(obj);
            this.state.buffer = '';
            return results;
          } catch {
            // Not valid JSON, keep in buffer
          }
        }
      }
    }

    this.state.buffer = lines.pop() || '';

    const flushSseBuffer = () => {
      if (!this.state.sseBuffer) return;
      try {
        const obj = JSON.parse(this.state.sseBuffer);
        results.push(obj);
        this.state.sseBuffer = '';
      } catch {
        // Keep accumulating - the JSON is incomplete
      }
    };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        // Blank line indicates end of SSE event; try to flush
        flushSseBuffer();
        continue;
      }

      if (line.startsWith('data: ')) {
        const payload = line.slice(6);
        if (payload === '[DONE]') {
          // [DONE] signal - flush buffer and clear
          flushSseBuffer();
          this.state.sseBuffer = '';
          continue;
        }

        // If this looks like the start of a new JSON object/array and we have buffered content,
        // it means the previous buffer was invalid, so clear it
        if (this.state.sseBuffer && (payload.startsWith('{') || payload.startsWith('['))) {
          this.state.sseBuffer = '';
        }

        // Accumulate partial payloads across many tiny SSE events
        this.state.sseBuffer += payload;
        // Try opportunistic parse on every append
        flushSseBuffer();
      } else {
        // NDJSON line
        try {
          const obj = JSON.parse(line);
          results.push(obj);
        } catch {
          // Skip invalid NDJSON line
        }
      }
    }

    return results;
  }

  /**
   * Reset the processor state
   */
  reset() {
    this.state = {
      buffer: '',
      inString: false,
      depth: 0,
      arrayStarted: false,
      arrayEnded: false,
      pendingArrayItems: [],
      sseBuffer: '',
      mode: 'unknown',
    };
  }
}
