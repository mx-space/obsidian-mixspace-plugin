import { describe, it, expect } from 'vitest'
import {
  getActiveProfile,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
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
    }

    const result = getActiveProfile(settings)

    expect(result).toEqual(profile1)
  })

  it('should return DEFAULT_PROFILE when profiles array is empty', () => {
    const settings: MixSpaceSettings = {
      profiles: [],
      activeProfileId: 'any',
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
})
