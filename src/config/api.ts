export const LLM_BASE_URL = import.meta.env.VITE_LLM_BASE_URL || '';

export const LLM_MODEL = import.meta.env.VITE_LLM_MODEL || '';

export const LLM_API_KEY = import.meta.env.VITE_LLM_API_KEY || '';

/** DeepSeek V4 默认开启 thinking；关闭后更快、更省 token */
export const LLM_THINKING = { type: 'disabled' as const };
