import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateApiKey, fetchOpenAIModels } from './providers'
import type { AISettings } from '../types'

// Mock AI SDK providers - we don't need to test their internals
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn(() => ({ modelId: 'gpt-4o-mini' }))),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn(() => ({ modelId: 'claude-sonnet-4-5-20250929' }))),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('validateApiKey', () => {
  describe('OpenAI', () => {
    it('should return true for valid OpenAI API key', () => {
      expect(validateApiKey('openai', 'sk-1234567890abcdef')).toBe(true)
    })

    it('should return true for OpenAI project API key', () => {
      expect(validateApiKey('openai', 'sk-proj-1234567890abcdef')).toBe(true)
    })

    it('should return false for OpenAI key without sk- prefix', () => {
      expect(validateApiKey('openai', '1234567890abcdef')).toBe(false)
    })

    it('should return false for empty OpenAI key', () => {
      expect(validateApiKey('openai', '')).toBe(false)
    })

    it('should return false for whitespace-only OpenAI key', () => {
      expect(validateApiKey('openai', '   ')).toBe(false)
    })
  })

  describe('Anthropic', () => {
    it('should return true for valid Anthropic API key', () => {
      expect(validateApiKey('anthropic', 'sk-ant-api03-1234567890abcdef')).toBe(true)
    })

    it('should return false for Anthropic key without sk-ant- prefix', () => {
      expect(validateApiKey('anthropic', 'sk-1234567890abcdef')).toBe(false)
    })

    it('should return false for empty Anthropic key', () => {
      expect(validateApiKey('anthropic', '')).toBe(false)
    })

    it('should return false for whitespace-only Anthropic key', () => {
      expect(validateApiKey('anthropic', '   ')).toBe(false)
    })
  })

  describe('Unknown provider', () => {
    it('should return true for key longer than 10 characters', () => {
      // @ts-expect-error - testing unknown provider
      expect(validateApiKey('unknown', '12345678901')).toBe(true)
    })

    it('should return false for key shorter than or equal to 10 characters', () => {
      // @ts-expect-error - testing unknown provider
      expect(validateApiKey('unknown', '1234567890')).toBe(false)
    })
  })
})

describe('fetchOpenAIModels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockResponse = (status: number, data: unknown) => ({
    status,
    json: () => Promise.resolve(data),
  })

  describe('OpenAI format', () => {
    it('should fetch and filter models (exclude non-chat models)', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, {
          data: [
            { id: 'gpt-4o-mini', owned_by: 'openai' },
            { id: 'gpt-4o', owned_by: 'openai' },
            { id: 'text-embedding-ada-002', owned_by: 'openai' }, // Should be filtered (embedding)
            { id: 'dall-e-3', owned_by: 'openai' }, // Should be filtered (dall-e)
            { id: 'tts-1', owned_by: 'openai' }, // Should be filtered (tts)
            { id: 'whisper-1', owned_by: 'openai' }, // Should be filtered (whisper)
          ],
        }),
      )

      const models = await fetchOpenAIModels('sk-test-key')

      expect(models.map((m) => m.id)).toContain('gpt-4o-mini')
      expect(models.map((m) => m.id)).toContain('gpt-4o')
      expect(models.map((m) => m.id)).not.toContain('text-embedding-ada-002')
      expect(models.map((m) => m.id)).not.toContain('dall-e-3')
      expect(models.map((m) => m.id)).not.toContain('tts-1')
      expect(models.map((m) => m.id)).not.toContain('whisper-1')
    })

    it('should format model names when name not provided', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, {
          data: [
            { id: 'gpt-4o-mini', owned_by: 'openai' },
            { id: 'gpt-4o', owned_by: 'openai' },
            { id: 'gpt-4-turbo', owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', owned_by: 'openai' },
          ],
        }),
      )

      const models = await fetchOpenAIModels('sk-test-key')

      expect(models.find((m) => m.id === 'gpt-4o-mini')?.name).toBe('GPT-4o Mini')
      expect(models.find((m) => m.id === 'gpt-4o')?.name).toBe('GPT-4o')
      expect(models.find((m) => m.id === 'gpt-4-turbo')?.name).toBe('GPT-4 Turbo')
      expect(models.find((m) => m.id === 'gpt-3.5-turbo')?.name).toBe('GPT-3.5 Turbo')
    })
  })

  describe('OpenRouter format', () => {
    it('should use provided name from OpenRouter response', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, {
          data: [
            {
              id: 'allenai/molmo-2-8b:free',
              name: 'AllenAI: Molmo2 8B (free)',
              architecture: { output_modalities: ['text'] },
            },
            {
              id: 'anthropic/claude-3.5-sonnet',
              name: 'Anthropic: Claude 3.5 Sonnet',
              architecture: { output_modalities: ['text'] },
            },
          ],
        }),
      )

      const models = await fetchOpenAIModels('sk-test-key', 'https://openrouter.ai/api/v1')

      expect(models.find((m) => m.id === 'allenai/molmo-2-8b:free')?.name).toBe(
        'AllenAI: Molmo2 8B (free)',
      )
      expect(models.find((m) => m.id === 'anthropic/claude-3.5-sonnet')?.name).toBe(
        'Anthropic: Claude 3.5 Sonnet',
      )
    })

    it('should filter by output_modalities for OpenRouter', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, {
          data: [
            {
              id: 'openai/gpt-4o',
              name: 'OpenAI: GPT-4o',
              architecture: { output_modalities: ['text'] },
            },
            {
              id: 'openai/dall-e-3',
              name: 'OpenAI: DALL-E 3',
              architecture: { output_modalities: ['image'] }, // Should be filtered (no text output)
            },
            {
              id: 'some/audio-model',
              name: 'Audio Model',
              architecture: { output_modalities: ['audio'] }, // Should be filtered (no text output)
            },
          ],
        }),
      )

      const models = await fetchOpenAIModels('sk-test-key', 'https://openrouter.ai/api/v1')

      expect(models.map((m) => m.id)).toContain('openai/gpt-4o')
      expect(models.map((m) => m.id)).not.toContain('openai/dall-e-3')
      expect(models.map((m) => m.id)).not.toContain('some/audio-model')
    })

    it('should include models with text in output_modalities even with other modalities', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, {
          data: [
            {
              id: 'multimodal/model',
              name: 'Multimodal Model',
              architecture: { output_modalities: ['text', 'image'] }, // Has text, should be included
            },
          ],
        }),
      )

      const models = await fetchOpenAIModels('sk-test-key', 'https://openrouter.ai/api/v1')

      expect(models.map((m) => m.id)).toContain('multimodal/model')
    })

    it('should still apply pattern-based filtering for OpenRouter', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse(200, {
          data: [
            {
              id: 'openai/text-embedding-3-large',
              name: 'OpenAI: Embedding 3 Large',
              architecture: { output_modalities: ['text'] }, // Has text but is embedding model
            },
            {
              id: 'openai/gpt-4o',
              name: 'OpenAI: GPT-4o',
              architecture: { output_modalities: ['text'] },
            },
          ],
        }),
      )

      const models = await fetchOpenAIModels('sk-test-key', 'https://openrouter.ai/api/v1')

      expect(models.map((m) => m.id)).toContain('openai/gpt-4o')
      expect(models.map((m) => m.id)).not.toContain('openai/text-embedding-3-large')
    })
  })

  it('should use default base URL when not provided', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(200, { data: [] }))

    await fetchOpenAIModels('sk-test-key')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('should use custom base URL when provided', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(200, { data: [] }))

    await fetchOpenAIModels('sk-test-key', 'https://custom-api.example.com/v1')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom-api.example.com/v1/models',
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('should throw error on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(401, { error: 'Unauthorized' }))

    await expect(fetchOpenAIModels('invalid-key')).rejects.toThrow('Failed to fetch models: 401')
  })

  it('should sort models by preference', async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, {
        data: [
          { id: 'meta-llama/llama-3-70b', owned_by: 'openrouter' },
          { id: 'gpt-3.5-turbo', owned_by: 'openai' },
          { id: 'anthropic/claude-3-sonnet', owned_by: 'openrouter' },
          { id: 'gpt-4o', owned_by: 'openai' },
          { id: 'gpt-4o-mini', owned_by: 'openai' },
        ],
      }),
    )

    const models = await fetchOpenAIModels('sk-test-key')

    // Should be sorted: gpt-4o, gpt-4o-mini, gpt-3.5-turbo, claude-3, llama-3
    expect(models[0].id).toBe('gpt-4o')
    expect(models[1].id).toBe('gpt-4o-mini')
    expect(models[2].id).toBe('gpt-3.5-turbo')
    expect(models[3].id).toBe('anthropic/claude-3-sonnet')
    expect(models[4].id).toBe('meta-llama/llama-3-70b')
  })
})

describe('createModel', () => {
  it('should create OpenAI model with correct settings', async () => {
    const { createOpenAI } = await import('@ai-sdk/openai')
    const { createModel } = await import('./providers')

    const settings: AISettings = {
      enabled: true,
      provider: 'openai',
      apiKey: 'sk-test-key',
      baseUrl: '',
      model: 'gpt-4o-mini',
    }

    createModel(settings)

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'sk-test-key',
      baseURL: 'https://api.openai.com/v1',
    })
  })

  it('should create OpenAI model with custom baseUrl', async () => {
    const { createOpenAI } = await import('@ai-sdk/openai')
    const { createModel } = await import('./providers')

    const settings: AISettings = {
      enabled: true,
      provider: 'openai',
      apiKey: 'sk-test-key',
      baseUrl: 'https://custom-api.com/v1',
      model: 'gpt-4o-mini',
    }

    createModel(settings)

    expect(createOpenAI).toHaveBeenCalledWith({
      apiKey: 'sk-test-key',
      baseURL: 'https://custom-api.com/v1',
    })
  })

  it('should create Anthropic model with correct settings', async () => {
    const { createAnthropic } = await import('@ai-sdk/anthropic')
    const { createModel } = await import('./providers')

    const settings: AISettings = {
      enabled: true,
      provider: 'anthropic',
      apiKey: 'sk-ant-test-key',
      baseUrl: '',
      model: 'claude-sonnet-4-5-20250929',
    }

    createModel(settings)

    expect(createAnthropic).toHaveBeenCalledWith({
      apiKey: 'sk-ant-test-key',
      baseURL: 'https://api.anthropic.com',
    })
  })

  it('should create Anthropic model with custom baseUrl', async () => {
    const { createAnthropic } = await import('@ai-sdk/anthropic')
    const { createModel } = await import('./providers')

    const settings: AISettings = {
      enabled: true,
      provider: 'anthropic',
      apiKey: 'sk-ant-test-key',
      baseUrl: 'https://custom-anthropic.com',
      model: 'claude-sonnet-4-5-20250929',
    }

    createModel(settings)

    expect(createAnthropic).toHaveBeenCalledWith({
      apiKey: 'sk-ant-test-key',
      baseURL: 'https://custom-anthropic.com',
    })
  })

  it('should throw error for unsupported provider', async () => {
    const { createModel } = await import('./providers')

    const settings = {
      enabled: true,
      provider: 'unsupported' as never,
      apiKey: 'test-key',
      baseUrl: '',
      model: 'test-model',
    }

    expect(() => createModel(settings)).toThrow('Unsupported AI provider: unsupported')
  })
})
