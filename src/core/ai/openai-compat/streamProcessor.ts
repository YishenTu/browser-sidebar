/**
 * Stream processor for OpenAI-Compatible providers
 *
 * Reuses OpenRouter's stream processing logic since the format is identical
 */

export { processStreamChunk, processSSELine } from '../openrouter/streamProcessor';
