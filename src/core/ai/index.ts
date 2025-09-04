// Namespace exports to avoid duplicate symbol collisions across providers
// Consumers can import as: import { openai } from '@core/ai'; openai.buildRequest(...)
export * as openai from './openai';
export * as openaiCompat from './openai-compat';
export * as gemini from './gemini';
export * as openrouter from './openrouter';
