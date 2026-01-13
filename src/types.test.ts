import { describe, it, expect } from 'vitest'
import {
  getActiveProfile,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_BASE_URLS,
  AI_MODELS,
  type MixSpaceSettings,
  type MixSpaceProfile,
} from './types'

describe('getActiveProfile', () => {
  it('should return the active profile when it exists', () => {
    const profile1: MixSpaceProfile = {
      id: 'prod',
      name: 'Production',
      apiEndpoint: 'https://api.example.com',
      token: 'token1',
      siteUrl: 'https://example.com',
    }
    const profile2: MixSpaceProfile = {
      id: 'dev',
      name: 'Development',
      apiEndpoint: 'https://dev-api.example.com',
      token: 'token2',
      siteUrl: 'https://dev.example.com',
    }

    const settings: MixSpaceSettings = {
      profiles: [profile1, profile2],
      activeProfileId: 'dev',
      ai: DEFAULT_AI_SETTINGS,
    }

    const result = getActiveProfile(settings)

    expect(result).toEqual(profile2)
  })

  it('should return the first profile when active profile is not found', () => {
    const profile1: MixSpaceProfile = {
      id: 'prod',
      name: 'Production',
      apiEndpoint: 'https://api.example.com',
      token: 'token1',
      siteUrl: 'https://example.com',
    }

    const settings: MixSpaceSettings = {
      profiles: [profile1],
      activeProfileId: 'nonexistent',
      ai: DEFAULT_AI_SETTINGS,
    }

    const result = getActiveProfile(settings)

    expect(result).toEqual(profile1)
  })

  it('should return DEFAULT_PROFILE when profiles array is empty', () => {
    const settings: MixSpaceSettings = {
      profiles: [],
      activeProfileId: 'any',
      ai: DEFAULT_AI_SETTINGS,
    }

    const result = getActiveProfile(settings)

    expect(result).toEqual(DEFAULT_PROFILE)
  })

  it('should work with DEFAULT_SETTINGS', () => {
    const result = getActiveProfile(DEFAULT_SETTINGS)

    expect(result).toEqual(DEFAULT_PROFILE)
    expect(result.id).toBe('default')
    expect(result.name).toBe('Production')
  })
})

describe('DEFAULT_PROFILE', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_PROFILE.id).toBe('default')
    expect(DEFAULT_PROFILE.name).toBe('Production')
    expect(DEFAULT_PROFILE.apiEndpoint).toBe('')
    expect(DEFAULT_PROFILE.token).toBe('')
    expect(DEFAULT_PROFILE.siteUrl).toBe('')
  })
})

describe('DEFAULT_SETTINGS', () => {
  it('should have correct default structure', () => {
    expect(DEFAULT_SETTINGS.profiles).toHaveLength(1)
    expect(DEFAULT_SETTINGS.profiles[0]).toEqual(DEFAULT_PROFILE)
    expect(DEFAULT_SETTINGS.activeProfileId).toBe('default')
  })

  it('should include AI settings', () => {
    expect(DEFAULT_SETTINGS.ai).toEqual(DEFAULT_AI_SETTINGS)
  })
})

describe('DEFAULT_AI_SETTINGS', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_AI_SETTINGS.enabled).toBe(false)
    expect(DEFAULT_AI_SETTINGS.provider).toBe('openai')
    expect(DEFAULT_AI_SETTINGS.apiKey).toBe('')
    expect(DEFAULT_AI_SETTINGS.baseUrl).toBe('')
    expect(DEFAULT_AI_SETTINGS.model).toBe('gpt-4o-mini')
  })
})

describe('DEFAULT_BASE_URLS', () => {
  it('should have correct OpenAI base URL', () => {
    expect(DEFAULT_BASE_URLS.openai).toBe('https://api.openai.com/v1')
  })

  it('should have correct Anthropic base URL', () => {
    expect(DEFAULT_BASE_URLS.anthropic).toBe('https://api.anthropic.com')
  })
})

describe('AI_MODELS', () => {
  describe('OpenAI models', () => {
    it('should have OpenAI models defined', () => {
      expect(AI_MODELS.openai).toBeDefined()
      expect(AI_MODELS.openai.length).toBeGreaterThan(0)
    })

    it('should include gpt-4o-mini', () => {
      const model = AI_MODELS.openai.find((m) => m.id === 'gpt-4o-mini')
      expect(model).toBeDefined()
    })

    it('should include gpt-4o', () => {
      const model = AI_MODELS.openai.find((m) => m.id === 'gpt-4o')
      expect(model).toBeDefined()
    })

    it('should have id and name for each model', () => {
      for (const model of AI_MODELS.openai) {
        expect(model.id).toBeDefined()
        expect(model.id.length).toBeGreaterThan(0)
        expect(model.name).toBeDefined()
        expect(model.name.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Anthropic models', () => {
    it('should have Anthropic models defined', () => {
      expect(AI_MODELS.anthropic).toBeDefined()
      expect(AI_MODELS.anthropic.length).toBeGreaterThan(0)
    })

    it('should include Claude Sonnet 4.5', () => {
      const model = AI_MODELS.anthropic.find((m) => m.id === 'claude-sonnet-4-5-20250929')
      expect(model).toBeDefined()
      expect(model?.name).toContain('Sonnet 4.5')
    })

    it('should include Claude Haiku 4.5', () => {
      const model = AI_MODELS.anthropic.find((m) => m.id === 'claude-haiku-4-5-20251001')
      expect(model).toBeDefined()
      expect(model?.name).toContain('Haiku 4.5')
    })

    it('should include Claude Opus 4.5', () => {
      const model = AI_MODELS.anthropic.find((m) => m.id === 'claude-opus-4-5-20251101')
      expect(model).toBeDefined()
      expect(model?.name).toContain('Opus 4.5')
    })

    it('should have id and name for each model', () => {
      for (const model of AI_MODELS.anthropic) {
        expect(model.id).toBeDefined()
        expect(model.id.length).toBeGreaterThan(0)
        expect(model.name).toBeDefined()
        expect(model.name.length).toBeGreaterThan(0)
      }
    })
  })
})
