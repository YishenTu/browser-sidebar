/**
 * Built-in presets for popular OpenAI-compatible providers
 */

export interface OpenAICompatPreset {
  id: string;
  name: string;
  baseURL: string;
}

export const OPENAI_COMPAT_PRESETS: OpenAICompatPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
  },
  {
    id: 'qwen',
    name: 'Qwen (Alibaba Cloud)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot AI)',
    baseURL: 'https://api.moonshot.cn/v1',
  },
];

/**
 * Get preset by ID
 */
export function getPresetById(id: string): OpenAICompatPreset | undefined {
  return OPENAI_COMPAT_PRESETS.find(preset => preset.id === id);
}

/**
 * Check if a provider ID is a built-in preset
 */
export function isBuiltInPreset(id: string): boolean {
  return OPENAI_COMPAT_PRESETS.some(preset => preset.id === id);
}
