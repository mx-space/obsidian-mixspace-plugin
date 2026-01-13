import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIService } from './service'
import type { AISettings } from '../types'
import type { GenerationContext } from './types'

// Mock the AI SDK generateText
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

// Mock providers
vi.mock('./providers', () => ({
  createModel: vi.fn(() => ({ modelId: 'test-model' })),
}))

describe('AIService', () => {
  const createSettings = (overrides: Partial<AISettings> = {}): AISettings => ({
    enabled: true,
    provider: 'openai',
    apiKey: 'sk-test-key',
    baseUrl: '',
    model: 'gpt-4o-mini',
    ...overrides,
  })

  const createContext = (overrides: Partial<GenerationContext> = {}): GenerationContext => ({
    content: 'Test content for generation.',
    fileName: 'test-file',
    contentType: 'post',
    frontmatter: {},
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isConfigured', () => {
    it('should return true when all required fields are set', () => {
      const settings = createSettings()
      const service = new AIService(settings)

      expect(service.isConfigured()).toBe(true)
    })

    it('should return false when disabled', () => {
      const settings = createSettings({ enabled: false })
      const service = new AIService(settings)

      expect(service.isConfigured()).toBe(false)
    })

    it('should return false when apiKey is empty', () => {
      const settings = createSettings({ apiKey: '' })
      const service = new AIService(settings)

      expect(service.isConfigured()).toBe(false)
    })

    it('should return false when apiKey is whitespace only', () => {
      const settings = createSettings({ apiKey: '   ' })
      const service = new AIService(settings)

      expect(service.isConfigured()).toBe(false)
    })

    it('should return false when model is empty', () => {
      const settings = createSettings({ model: '' })
      const service = new AIService(settings)

      expect(service.isConfigured()).toBe(false)
    })

    it('should return false when model is whitespace only', () => {
      const settings = createSettings({ model: '   ' })
      const service = new AIService(settings)

      expect(service.isConfigured()).toBe(false)
    })
  })

  describe('updateSettings', () => {
    it('should update settings', () => {
      const initialSettings = createSettings({ model: 'gpt-4o-mini' })
      const service = new AIService(initialSettings)

      const newSettings = createSettings({ model: 'gpt-4o' })
      service.updateSettings(newSettings)

      // Verify by checking isConfigured still works
      expect(service.isConfigured()).toBe(true)
    })

    it('should update to disabled state', () => {
      const settings = createSettings({ enabled: true })
      const service = new AIService(settings)

      expect(service.isConfigured()).toBe(true)

      service.updateSettings(createSettings({ enabled: false }))

      expect(service.isConfigured()).toBe(false)
    })
  })

  describe('generateTitle', () => {
    it('should throw error when not configured', async () => {
      const settings = createSettings({ enabled: false })
      const service = new AIService(settings)
      const context = createContext()

      await expect(service.generateTitle(context)).rejects.toThrow('AI service not configured')
    })

    it('should generate title successfully', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockResolvedValueOnce({
        text: 'Generated Title',
        usage: { totalTokens: 50 },
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateTitle(context)

      expect(result.value).toBe('Generated Title')
      expect(result.tokensUsed).toBe(50)
      expect(result.model).toBe('gpt-4o-mini')
    })

    it('should trim generated title', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockResolvedValueOnce({
        text: '  Generated Title with Spaces  ',
        usage: { totalTokens: 50 },
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateTitle(context)

      expect(result.value).toBe('Generated Title with Spaces')
    })

    it('should handle missing usage data', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockResolvedValueOnce({
        text: 'Generated Title',
        usage: undefined,
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateTitle(context)

      expect(result.value).toBe('Generated Title')
      expect(result.tokensUsed).toBeUndefined()
    })
  })

  describe('generateSlug', () => {
    it('should throw error when not configured', async () => {
      const settings = createSettings({ enabled: false })
      const service = new AIService(settings)
      const context = createContext()

      await expect(service.generateSlug(context)).rejects.toThrow('AI service not configured')
    })

    it('should generate and sanitize slug', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockResolvedValueOnce({
        text: 'my-awesome-slug',
        usage: { totalTokens: 30 },
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateSlug(context)

      expect(result.value).toBe('my-awesome-slug')
      expect(result.tokensUsed).toBe(30)
    })

    it('should sanitize slug with uppercase letters', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockResolvedValueOnce({
        text: 'My-Awesome-SLUG',
        usage: { totalTokens: 30 },
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateSlug(context)

      expect(result.value).toBe('my-awesome-slug')
    })

    it('should sanitize slug with special characters', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockResolvedValueOnce({
        text: 'my@awesome#slug!',
        usage: { totalTokens: 30 },
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateSlug(context)

      expect(result.value).toBe('my-awesome-slug')
    })

    it('should collapse multiple hyphens', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockResolvedValueOnce({
        text: 'my---awesome---slug',
        usage: { totalTokens: 30 },
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateSlug(context)

      expect(result.value).toBe('my-awesome-slug')
    })

    it('should remove leading and trailing hyphens', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockResolvedValueOnce({
        text: '-my-awesome-slug-',
        usage: { totalTokens: 30 },
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateSlug(context)

      expect(result.value).toBe('my-awesome-slug')
    })

    it('should enforce max length of 50 characters', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      const longSlug = 'a'.repeat(100)
      mockGenerateText.mockResolvedValueOnce({
        text: longSlug,
        usage: { totalTokens: 30 },
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateSlug(context)

      expect(result.value.length).toBe(50)
    })

    it('should allow Chinese characters in slug', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockResolvedValueOnce({
        text: '我的博客文章',
        usage: { totalTokens: 30 },
      } as never)

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      const result = await service.generateSlug(context)

      expect(result.value).toBe('我的博客文章')
    })
  })

  describe('error handling', () => {
    it('should categorize invalid API key error', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce(new Error('Invalid API key'))

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as Error).message).toContain('Invalid API key')
        expect((error as { code: string }).code).toBe('INVALID_API_KEY')
      }
    })

    it('should categorize 401 error as invalid API key', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce(new Error('401 Unauthorized'))

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as { code: string }).code).toBe('INVALID_API_KEY')
      }
    })

    it('should categorize rate limit error', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce(new Error('Rate limit exceeded'))

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as { code: string }).code).toBe('RATE_LIMIT')
      }
    })

    it('should categorize 429 error as rate limit', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce(new Error('429 Too Many Requests'))

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as { code: string }).code).toBe('RATE_LIMIT')
      }
    })

    it('should categorize model not found error', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce(new Error('model gpt-5 not found'))

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as { code: string }).code).toBe('MODEL_NOT_FOUND')
      }
    })

    it('should categorize network error', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce(new Error('network error'))

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as { code: string }).code).toBe('NETWORK_ERROR')
      }
    })

    it('should categorize ECONNREFUSED as network error', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as { code: string }).code).toBe('NETWORK_ERROR')
      }
    })

    it('should categorize unknown errors', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce(new Error('Some unexpected error'))

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as { code: string }).code).toBe('UNKNOWN')
        expect((error as Error).message).toBe('Some unexpected error')
      }
    })

    it('should handle non-Error objects', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce('String error')

      const settings = createSettings()
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as { code: string }).code).toBe('UNKNOWN')
        expect((error as Error).message).toBe('String error')
      }
    })

    it('should include provider in error', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      mockGenerateText.mockRejectedValueOnce(new Error('Some error'))

      const settings = createSettings({ provider: 'anthropic' })
      const service = new AIService(settings)
      const context = createContext()

      try {
        await service.generateTitle(context)
        expect.fail('Should have thrown')
      } catch (error) {
        expect((error as { provider: string }).provider).toBe('anthropic')
      }
    })
  })
})
