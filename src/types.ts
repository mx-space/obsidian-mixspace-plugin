// Mix Space API version. v2 = legacy (Authorization header, bare responses,
// camelCase fields). v3 = Mix Space v13+ (x-api-key header, { data } envelope,
// snake_case fields).
export type ApiVersion = 'v2' | 'v3'

// Profile for different environments (production, development, etc.)
export interface MixSpaceProfile {
  id: string
  name: string
  apiEndpoint: string
  token: string
  siteUrl: string
  apiVersion?: ApiVersion // optional; when absent, resolveApiVersion infers from endpoint / defaults to v3
}

// Resolve the effective API version for a profile.
// Explicit apiVersion wins; otherwise infer from the endpoint's trailing segment;
// fall back to the field-tested v3 when nothing matches.
export function resolveApiVersion(
  profile: Pick<MixSpaceProfile, 'apiVersion' | 'apiEndpoint'>,
): ApiVersion {
  if (profile.apiVersion === 'v2' || profile.apiVersion === 'v3') return profile.apiVersion
  const base = (profile.apiEndpoint || '').replace(/\/$/, '')
  if (/\/v2$/.test(base)) return 'v2'
  if (/\/v3$/.test(base)) return 'v3'
  return 'v3' // default safely to the field-tested v3
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
  apiVersion: 'v3',
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

// Mix Space Note response (v13: snake_case fields)
export interface NoteResponse {
  id: string
  nid: number
  title: string
  created_at: string
  modified_at: string | null
  mood?: string
  weather?: string
  topic_id?: string
}

// Mix Space Post response (v13: snake_case fields)
export interface PostResponse {
  id: string
  title: string
  slug: string
  created_at: string
  modified_at: string | null
  category_id: string
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
