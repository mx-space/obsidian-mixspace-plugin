import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { AIProvider, AISettings } from '../types'
import { DEFAULT_BASE_URLS } from '../types'

/**
 * Create a language model instance based on provider settings
 * Uses factory pattern for easy extension to new providers
 */
export function createModel(settings: AISettings) {
  const { provider, apiKey, model, baseUrl } = settings

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey,
        baseURL: baseUrl || DEFAULT_BASE_URLS.openai,
      })
      return openai(model)
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey,
        baseURL: baseUrl || DEFAULT_BASE_URLS.anthropic,
      })
      return anthropic(model)
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

/**
 * Validate API key format (basic validation)
 */
export function validateApiKey(provider: AIProvider, apiKey: string): boolean {
  if (!apiKey || apiKey.trim() === '') return false

  switch (provider) {
    case 'openai':
      return apiKey.startsWith('sk-')
    case 'anthropic':
      return apiKey.startsWith('sk-ant-')
    default:
      return apiKey.length > 10
  }
}

export interface OpenAIModel {
  id: string
  name: string
}

// OpenRouter API response types
interface OpenRouterModel {
  id: string
  name?: string
  owned_by?: string
  architecture?: {
    modality?: string
    output_modalities?: string[]
  }
}

/**
 * Fetch available models from OpenAI-compatible API
 * Supports both OpenAI and OpenRouter response formats
 */
export async function fetchOpenAIModels(apiKey: string, baseUrl?: string): Promise<OpenAIModel[]> {
  const url = `${baseUrl || DEFAULT_BASE_URLS.openai}/models`

  const headers = new Headers()
  headers.set('Authorization', `Bearer ${apiKey}`)
  headers.set('Content-Type', 'application/json')
  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (response.status !== 200) {
    throw new Error(`Failed to fetch models: ${response.status}`)
  }

  const data = (await response.json()) as { data: OpenRouterModel[] }

  // Check if this is OpenRouter format (has architecture field)
  const isOpenRouter = data.data.some((m) => m.architecture !== undefined)

  const models = data.data
    .filter((m) => filterModel(m, isOpenRouter))
    .map((m) => ({
      id: m.id,
      // Use provided name if available (OpenRouter), otherwise format it
      name: m.name || formatModelName(m.id),
    }))
    .sort(sortModels)

  return models
}

/**
 * Filter models based on their capabilities
 * For OpenRouter: use architecture.output_modalities to check for text output
 * For OpenAI: use pattern-based filtering
 */
function filterModel(model: OpenRouterModel, isOpenRouter: boolean): boolean {
  const id = model.id.toLowerCase()

  if (isOpenRouter && model.architecture) {
    // OpenRouter: filter by output modality - must support text output
    const outputModalities = model.architecture.output_modalities || []
    if (!outputModalities.includes('text')) {
      return false
    }
  }

  // Pattern-based exclusion for non-chat models
  const excludePatterns = [
    'embedding',
    'tts',
    'whisper',
    'dall-e',
    'davinci',
    'babbage',
    'ada',
    'curie',
    'moderation',
  ]

  return !excludePatterns.some((p) => id.includes(p))
}

/**
 * Sort models by preference
 */
function sortModels(a: OpenAIModel, b: OpenAIModel): number {
  const preferredOrder = [
    'gpt-5',
    'gpt-4.1',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-4',
    'claude-3.7',
    'claude-3.5',
    'claude-3',
    'claude-2',
    'gemini-2',
    'gemini-1.5',
    'gemini',
    'llama-4',
    'llama-3.3',
    'llama-3.2',
    'llama-3.1',
    'llama-3',
    'llama',
    'mistral',
    'mixtral',
    'qwen',
    'deepseek',
  ]
  const aLower = a.id.toLowerCase()
  const bLower = b.id.toLowerCase()
  const aIndex = preferredOrder.findIndex((p) => aLower.includes(p.toLowerCase()))
  const bIndex = preferredOrder.findIndex((p) => bLower.includes(p.toLowerCase()))
  if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
  if (aIndex !== -1) return -1
  if (bIndex !== -1) return 1
  return a.id.localeCompare(b.id)
}

/**
 * Format model ID into human-readable name
 * Supports OpenAI, Claude, Gemini, Llama, Mistral, and other common models
 */
function formatModelName(modelId: string): string {
  const id = modelId.toLowerCase()

  // OpenAI GPT models
  if (id.startsWith('gpt-5')) {
    if (id === 'gpt-5') return 'GPT-5'
    return `GPT-5 (${modelId.replace(/^gpt-5-?/i, '')})`
  }
  if (id === 'gpt-4o-mini') return 'GPT-4o Mini'
  if (id === 'gpt-4o') return 'GPT-4o'
  if (id.startsWith('gpt-4o-')) return `GPT-4o (${modelId.replace(/^gpt-4o-/i, '')})`
  if (id === 'gpt-4-turbo') return 'GPT-4 Turbo'
  if (id.startsWith('gpt-4-turbo-')) return `GPT-4 Turbo (${modelId.replace(/^gpt-4-turbo-/i, '')})`
  if (id === 'gpt-4') return 'GPT-4'
  if (id.startsWith('gpt-4-')) return `GPT-4 (${modelId.replace(/^gpt-4-/i, '')})`
  if (id === 'gpt-3.5-turbo') return 'GPT-3.5 Turbo'
  if (id.startsWith('gpt-3.5-turbo-'))
    return `GPT-3.5 Turbo (${modelId.replace(/^gpt-3\.5-turbo-/i, '')})`

  // Claude models (OpenRouter format: anthropic/claude-xxx or claude-xxx)
  if (id.includes('claude')) {
    const cleaned = modelId.replace(/^(anthropic\/)/i, '')
    if (id.includes('opus')) return `Claude Opus (${cleaned})`
    if (id.includes('sonnet')) return `Claude Sonnet (${cleaned})`
    if (id.includes('haiku')) return `Claude Haiku (${cleaned})`
    return `Claude (${cleaned})`
  }

  // Google Gemini models
  if (id.includes('gemini')) {
    const cleaned = modelId.replace(/^(google\/)/i, '')
    if (id.includes('ultra')) return `Gemini Ultra (${cleaned})`
    if (id.includes('pro')) return `Gemini Pro (${cleaned})`
    if (id.includes('flash')) return `Gemini Flash (${cleaned})`
    return `Gemini (${cleaned})`
  }

  // Meta Llama models
  if (id.includes('llama')) {
    const cleaned = modelId.replace(/^(meta-llama\/|meta\/)/i, '')
    return `Llama (${cleaned})`
  }

  // Mistral models
  if (id.includes('mistral') || id.includes('mixtral')) {
    const cleaned = modelId.replace(/^(mistralai\/)/i, '')
    if (id.includes('mixtral')) return `Mixtral (${cleaned})`
    return `Mistral (${cleaned})`
  }

  // Qwen models
  if (id.includes('qwen')) {
    const cleaned = modelId.replace(/^(qwen\/)/i, '')
    return `Qwen (${cleaned})`
  }

  // DeepSeek models
  if (id.includes('deepseek')) {
    const cleaned = modelId.replace(/^(deepseek\/)/i, '')
    return `DeepSeek (${cleaned})`
  }

  // For other models, just return the original ID
  return modelId
}
