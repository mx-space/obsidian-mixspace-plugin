import type { ContentType } from '../types'

export interface GenerationContext {
  content: string
  fileName: string
  existingTitle?: string
  existingSlug?: string
  contentType: ContentType
  frontmatter: Record<string, unknown>
}

export interface GenerationResult {
  value: string
  tokensUsed?: number
  model: string
}

export type AIGenerationErrorCode =
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT'
  | 'MODEL_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN'

export interface AIGenerationError extends Error {
  code: AIGenerationErrorCode
  provider: string
}
