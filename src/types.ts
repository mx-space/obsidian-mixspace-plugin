export interface MixSpaceSettings {
  apiEndpoint: string
  token: string
  siteUrl: string // e.g., https://innei.in
}

export const DEFAULT_SETTINGS: MixSpaceSettings = {
  apiEndpoint: '',
  token: '',
  siteUrl: '',
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
  topicId?: string
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
