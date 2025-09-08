/**
 * Slash Command Configuration
 *
 * Defines available slash commands that provide shortcuts for common prompts.
 * Each command has an id, name, description, and associated prompt template.
 */

/**
 * Interface for a slash command definition
 */
export interface SlashCommand {
  /** Unique name of the command (without the slash) */
  name: string;
  /** Brief description of what the command does */
  description: string;
  /** The prompt template that replaces the command */
  prompt: string;
  /** Optional model to use for this command (overrides selected model for one turn) */
  model?: string;
}

/**
 * Predefined slash commands available in the application
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'summarize',
    description: 'Summarize the content concisely',
    prompt: `
      Summarize the provided content

      # Language Instructions
      - If a specific output language is explicitly requested using language codes (zh for Chinese, en for English, etc.), respond in that language
      - If no output language is specified, automatically detect and respond in the same language as the source content
    `,
  },
  {
    name: 'explain',
    description: 'Explain in simple terms',
    prompt: `
      Explain the following in simple, easy-to-understand terms

      # Guidelines
      - Use clear, everyday language
      - Avoid technical jargon unless necessary
      - Provide examples or analogies when helpful
      - Break down complex concepts into smaller parts
    `,
  },
  {
    name: 'analyze',
    description: 'Analyze the content',
    prompt: `
      Provide a detailed analysis of the following

      # Analysis Framework
      - Identify key themes and main points
      - Examine the structure and organization
      - Evaluate strengths and weaknesses
      - Consider context and implications
      - Provide evidence-based insights
    `,
  },
  {
    name: 'comment',
    description: 'Summarize comments',
    prompt: `总结网友评论`,
  },
  {
    name: 'fact-check',
    description: 'Validate the information',
    prompt: `Search the web for credible sources to validate and fact check the provided content.`,
    model: 'gemini-2.5-flash',
  },
  {
    name: 'rephrase',
    description: 'Rephrase the content',
    prompt: `Rephrase this content to flow better, be more clear, and more concise.Resolve any grammar error, awkwardness or clunkiness.Maintain the proper contextual tone and style.`,
  },
];

/**
 * Get a slash command by its name (case-insensitive)
 */
export function getSlashCommandByName(name: string): SlashCommand | undefined {
  const lowerName = name.toLowerCase();
  return SLASH_COMMANDS.find(cmd => cmd.name.toLowerCase() === lowerName);
}

/**
 * Search slash commands by query (matches name or description)
 */
export function searchSlashCommands(query: string): SlashCommand[] {
  if (!query) {
    return SLASH_COMMANDS;
  }

  const lowerQuery = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
  );
}
