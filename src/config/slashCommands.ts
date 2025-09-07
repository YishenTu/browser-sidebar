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
  /** Unique identifier for the command */
  id: string;
  /** Display name of the command (without the slash) */
  name: string;
  /** Brief description of what the command does */
  description: string;
  /** The prompt template that replaces the command */
  prompt: string;
}

/**
 * Predefined slash commands available in the application
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'summarize',
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
    id: 'explain',
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
    id: 'analyze',
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
];

/**
 * Get a slash command by its ID
 */
export function getSlashCommandById(id: string): SlashCommand | undefined {
  return SLASH_COMMANDS.find(cmd => cmd.id === id);
}

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
