import { requestUrl } from 'obsidian'
import type {
  MixSpaceProfile,
  NotePayload,
  NoteResponse,
  PostPayload,
  PostResponse,
  Category,
  Topic,
} from './types'

export class MixSpaceAPI {
  constructor(private profile: MixSpaceProfile) {}

  updateProfile(profile: MixSpaceProfile) {
    this.profile = profile
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.profile.token}`,
    }
  }

  private get baseUrl() {
    return this.profile.apiEndpoint.replace(/\/$/, '')
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown,
  ): Promise<T> {
    const response = await requestUrl({
      url: `${this.baseUrl}${path}`,
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status >= 400) {
      const errorMsg = response.json?.message || response.text || `HTTP ${response.status}`
      throw new Error(errorMsg)
    }

    return response.json
  }

  // ===== Note API =====

  async createNote(payload: NotePayload): Promise<NoteResponse> {
    return this.request('/notes', 'POST', payload)
  }

  async updateNote(id: string, payload: Partial<NotePayload>): Promise<NoteResponse> {
    return this.request(`/notes/${id}`, 'PUT', payload)
  }

  async patchNote(id: string, payload: Partial<NotePayload>): Promise<NoteResponse> {
    return this.request(`/notes/${id}`, 'PATCH', payload)
  }

  // ===== Post API =====

  async createPost(payload: PostPayload): Promise<PostResponse> {
    return this.request('/posts', 'POST', payload)
  }

  async updatePost(id: string, payload: Partial<PostPayload>): Promise<PostResponse> {
    return this.request(`/posts/${id}`, 'PUT', payload)
  }

  async patchPost(id: string, payload: Partial<PostPayload>): Promise<PostResponse> {
    return this.request(`/posts/${id}`, 'PATCH', payload)
  }

  // ===== Metadata API =====

  async getCategories(): Promise<Category[]> {
    try {
      const response = await this.request<{ data: Category[] }>('/categories', 'GET')
      return response.data || []
    } catch {
      return []
    }
  }

  async getTopics(): Promise<Topic[]> {
    try {
      const response = await this.request<{ data: Topic[] }>('/topics', 'GET')
      return response.data || []
    } catch {
      return []
    }
  }

  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const categories = await this.getCategories()
    return categories.find((c) => c.slug === slug) || null
  }

  /**
   * Find category by name or slug
   * Tries slug match first, then name match
   */
  async getCategoryByNameOrSlug(value: string): Promise<Category | null> {
    const categories = await this.getCategories()
    // Try slug first
    const bySlug = categories.find((c) => c.slug === value)
    if (bySlug) return bySlug
    // Try name
    const byName = categories.find((c) => c.name === value)
    return byName || null
  }

  // ===== Connection Test =====

  async testConnection(): Promise<boolean> {
    try {
      await requestUrl({
        url: `${this.baseUrl}`,
        method: 'GET',
        headers: this.headers,
      })
      return true
    } catch {
      return false
    }
  }
}
