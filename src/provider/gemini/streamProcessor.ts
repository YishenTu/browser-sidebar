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
  buffer: string;
  inString: boolean;
  escapeNext: boolean;
  depth: number;
  arrayStarted: boolean;
}

/**
 * Process streaming data from Gemini API
 */
export class GeminiStreamProcessor {
  private state: ParseState = {
    buffer: '',
    inString: false,
    escapeNext: false,
    depth: 0,
    arrayStarted: false,
  };

  /**
   * Process a chunk of streaming data
   * @param chunk Raw text chunk from stream
   * @returns Array of parsed JSON objects ready for processing
   */
  processChunk(chunk: string): unknown[] {
    this.state.buffer += chunk;

    // Detect array format on first chunk
    if (!this.state.arrayStarted && this.state.buffer.trimStart().startsWith('[')) {
      this.state.arrayStarted = true;
      // Remove opening bracket
      this.state.buffer = this.state.buffer.trimStart().substring(1);
      return this.extractJsonObjects();
    }

    if (this.state.arrayStarted) {
      // Process JSON array format
      return this.extractJsonObjects();
    } else {
      // Process SSE/NDJSON format
      return this.extractSseObjects();
    }
  }

  /**
   * Extract complete JSON objects from buffer
   */
  private extractJsonObjects(): unknown[] {
    const results: unknown[] = [];

    while (this.state.buffer.length > 0) {
      // Skip whitespace
      this.state.buffer = this.state.buffer.trimStart();

      if (this.state.buffer.length === 0) break;

      // Check for array end
      if (this.state.buffer[0] === ']') {
        // End of array
        this.state.buffer = '';
        break;
      }

      // Skip comma separators
      if (this.state.buffer[0] === ',') {
        this.state.buffer = this.state.buffer.substring(1);
        continue;
      }

      // Look for complete JSON object
      if (this.state.buffer[0] === '{') {
        const objectEnd = this.findObjectEnd();

        if (objectEnd !== -1) {
          // Found complete object
          const objectStr = this.state.buffer.substring(0, objectEnd + 1);
          this.state.buffer = this.state.buffer.substring(objectEnd + 1);

          try {
            const obj = JSON.parse(objectStr);
            results.push(obj);
          } catch (e) {
            // Ignore JSON parsing errors for incomplete objects
          }
        } else {
          // Incomplete object, wait for more data
          break;
        }
      } else {
        // Unexpected character, skip it
        this.state.buffer = this.state.buffer.substring(1);
      }
    }

    return results;
  }

  /**
   * Find the end of a JSON object in the buffer
   * @returns Index of closing brace or -1 if incomplete
   */
  private findObjectEnd(): number {
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < this.state.buffer.length; i++) {
      const char = this.state.buffer[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            return i;
          }
        }
      }
    }

    return -1; // Incomplete object
  }

  /**
   * Extract SSE/NDJSON objects from buffer
   */
  private extractSseObjects(): unknown[] {
    const results: unknown[] = [];
    const lines = this.state.buffer.split('\n');

    // Keep incomplete line in buffer
    this.state.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Handle SSE format
      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') continue;

        try {
          const obj = JSON.parse(jsonStr);
          results.push(obj);
        } catch (e) {
          // Invalid JSON in SSE data, skip this line
        }
      } else {
        // Try parsing as NDJSON
        try {
          const obj = JSON.parse(trimmed);
          results.push(obj);
        } catch (e) {
          // Not valid JSON, skip
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
      escapeNext: false,
      depth: 0,
      arrayStarted: false,
    };
  }
}
