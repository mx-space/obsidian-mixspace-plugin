// Profile for different environments (production, development, etc.)
export interface MixSpaceProfile {
  id: string
  name: string
  apiEndpoint: string
  token: string
  siteUrl: string
}

// AI Provider types
export type AIProvider = 'openai' | 'anthropic'

export interface AISettings {
  enabled: boolean
  provider: AIProvider
  apiKey: string
  baseUrl: string
  model: string
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o-mini',
}

// Default base URLs for each provider
export const DEFAULT_BASE_URLS: Record<AIProvider, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
}

// Available models for each provider (Anthropic hardcoded, OpenAI can be fetched dynamically)
export const AI_MODELS: Record<AIProvider, { id: string; name: string }[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o (Recommended)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5 (Recommended)' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (Fast)' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude Sonnet 3.7' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Legacy)' },
  ],
}

export interface MixSpaceSettings {
  profiles: MixSpaceProfile[]
  activeProfileId: string
  ai: AISettings
}

export const DEFAULT_PROFILE: MixSpaceProfile = {
  id: 'default',
  name: 'Production',
  apiEndpoint: '',
  token: '',
  siteUrl: '',
}

export const DEFAULT_SETTINGS: MixSpaceSettings = {
  profiles: [DEFAULT_PROFILE],
  activeProfileId: 'default',
  ai: DEFAULT_AI_SETTINGS,
}

// Helper to get active profile from settings
export function getActiveProfile(settings: MixSpaceSettings): MixSpaceProfile {
  const profile = settings.profiles.find((p) => p.id === settings.activeProfileId)
  return profile || settings.profiles[0] || DEFAULT_PROFILE
}

// Obsidian frontmatter (parsed from markdown)
export interface NoteFrontmatter {
  title?: string
  date?: string
  updated?: string
  oid?: string // MongoDB ObjectId from Mix Space (_id)
  id?: number // Note nid / Post id
  slug?: string
  mood?: string
  weather?: string
  // Note specific
  topic?: string // Topic name (resolved to topicId when publishing)
  topicId?: string // Direct topic ID (for backwards compatibility)
  location?: string
  coordinates?: { latitude: number; longitude: number }
  password?: string
  publicAt?: string
  bookmark?: boolean
  allowComment?: boolean
  // Post specific
  categories?: string // category slug
  categoryId?: string
  tags?: string[] | string
  summary?: string
  copyright?: boolean
  pin?: string
  [key: string]: unknown
}

// Mix Space Image type
export interface MxImage {
  src: string
  width?: number
  height?: number
  type?: string
  accent?: string
  blurHash?: string
}

// Mix Space Note payload (for create/update)
export interface NotePayload {
  title: string
  text: string
  mood?: string
  weather?: string
  allowComment?: boolean
  images?: MxImage[]
  password?: string | null
  publicAt?: string | null
  bookmark?: boolean
  location?: string
  coordinates?: { latitude: number; longitude: number }
  topicId?: string | null
}

// Mix Space Post payload (for create/update)
export interface PostPayload {
  title: string
  text: string
  slug: string
  categoryId: string
  tags?: string[]
  summary?: string | null
  copyright?: boolean
  allowComment?: boolean
  images?: MxImage[]
  pin?: string | null
}

// Mix Space Note response
export interface NoteResponse {
  id: string // MongoDB _id
  nid: number
  title: string
  created: string
  modified: string | null
  mood?: string
  weather?: string
  topicId?: string
}

// Mix Space Post response
export interface PostResponse {
  id: string
  title: string
  slug: string
  created: string
  modified: string | null
  categoryId: string
  category: Category
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Topic {
  id: string
  name: string
  slug: string
  description?: string
}

// Cached server metadata for autocompletion
export interface ServerMetadata {
  categories: Category[]
  topics: Topic[]
  moods: string[]
  weathers: string[]
  lastFetched: number
}

// Content type enum
export type ContentType = 'note' | 'post'
