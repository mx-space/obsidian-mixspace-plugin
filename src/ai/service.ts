import { generateText } from 'ai'
import type { AISettings } from '../types'
import type {
  AIGenerationError,
  AIGenerationErrorCode,
  GenerationContext,
  GenerationResult,
} from './types'
import { createModel } from './providers'
import { buildTitlePrompt, buildSlugPrompt } from './prompts'

export class AIService {
  private settings: AISettings

  constructor(settings: AISettings) {
    this.settings = settings
  }

  updateSettings(settings: AISettings) {
    this.settings = settings
  }

  /**
   * Check if AI service is properly configured
   */
  isConfigured(): boolean {
    return (
      this.settings.enabled &&
      this.settings.apiKey.trim() !== '' &&
      this.settings.model.trim() !== ''
    )
  }

  /**
   * Generate a title for the given content
   */
  async generateTitle(context: GenerationContext): Promise<GenerationResult> {
    if (!this.isConfigured()) {
      throw this.createError('AI service not configured. Please check settings.', 'NOT_CONFIGURED')
    }

    const prompt = buildTitlePrompt(context)
    return this.generate(prompt)
  }

  /**
   * Generate a slug for the given context
   */
  async generateSlug(context: GenerationContext): Promise<GenerationResult> {
    if (!this.isConfigured()) {
      throw this.createError('AI service not configured. Please check settings.', 'NOT_CONFIGURED')
    }

    const prompt = buildSlugPrompt(context)
    const result = await this.generate(prompt)

    // Post-process slug to ensure validity
    result.value = this.sanitizeSlug(result.value)
    return result
  }

  /**
   * Core generation method using Vercel AI SDK
   */
  private async generate(prompt: string): Promise<GenerationResult> {
    try {
      const model = createModel(this.settings)

      const { text, usage } = await generateText({
        model,
        prompt,
        maxTokens: 100,
        temperature: 0.3,
      })

      return {
        value: text.trim(),
        tokensUsed: usage?.totalTokens,
        model: this.settings.model,
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Sanitize generated slug to ensure URL-friendliness
   */
  private sanitizeSlug(slug: string): string {
    return (
      slug
        .toLowerCase()
        // Allow alphanumeric, Chinese chars, and hyphens
        .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '-')
        // Collapse multiple hyphens
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-|-$/g, '')
        // Enforce max length
        .slice(0, 50)
    )
  }

  /**
   * Handle and categorize errors from AI providers
   */
  private handleError(error: unknown): AIGenerationError {
    const message = error instanceof Error ? error.message : String(error)

    if (
      message.includes('Invalid API key') ||
      message.includes('Unauthorized') ||
      message.includes('401') ||
      message.includes('invalid_api_key')
    ) {
      return this.createError('Invalid API key. Please check your settings.', 'INVALID_API_KEY')
    }
    if (
      message.includes('Rate limit') ||
      message.includes('429') ||
      message.includes('rate_limit')
    ) {
      return this.createError('Rate limit exceeded. Please try again later.', 'RATE_LIMIT')
    }
    if (
      message.includes('model') &&
      (message.includes('not found') || message.includes('does not exist'))
    ) {
      return this.createError(`Model "${this.settings.model}" not found.`, 'MODEL_NOT_FOUND')
    }
    if (
      message.includes('network') ||
      message.includes('ECONNREFUSED') ||
      message.includes('fetch')
    ) {
      return this.createError('Network error. Please check your connection.', 'NETWORK_ERROR')
    }

    return this.createError(message, 'UNKNOWN')
  }

  private createError(message: string, code: AIGenerationErrorCode): AIGenerationError {
    const error = new Error(message) as AIGenerationError
    error.code = code
    error.provider = this.settings.provider
    return error
  }
}
