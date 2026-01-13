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

  private getHeaders(hasBody: boolean) {
    const headers: Record<string, string> = {
      Authorization: this.profile.token,
    }
    if (hasBody) {
      headers['Content-Type'] = 'application/json'
    }
    return headers
  }

  private get baseUrl() {
    return this.profile.apiEndpoint.replace(/\/$/, '')
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    console.log(`[MixSpace] ${method} ${url}`)
    if (body) {
      console.log(`[MixSpace] Request body:`, body)
    }

    try {
      const response = await requestUrl({
        url,
        method,
        headers: this.getHeaders(!!body),
        body: body ? JSON.stringify(body) : undefined,
        throw: false, // Don't throw on 4xx/5xx, let us handle it
      })

      // Handle empty response body (common for DELETE requests)
      let json: T | null = null
      try {
        json = response.json
      } catch {
        // Empty body, json will be null
      }

      console.log(`[MixSpace] Response ${response.status}:`, {
        json,
        text: response.text,
        headers: response.headers,
      })

      if (response.status >= 400) {
        const errorMsg =
          (json as Record<string, unknown>)?.message || response.text || `HTTP ${response.status}`
        throw new Error(String(errorMsg))
      }

      return json as T
    } catch (error) {
      // Log full error details including any response data
      const err = error as Record<string, unknown>
      console.error(`[MixSpace] Request failed:`, {
        error,
        message: error instanceof Error ? error.message : String(error),
        response: err?.response,
        status: err?.status,
      })
      throw error
    }
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

  async deleteNote(nid: string): Promise<void> {
    await this.request(`/notes/${nid}`, 'DELETE')
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

  async deletePost(id: string): Promise<void> {
    await this.request(`/posts/${id}`, 'DELETE')
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

  /**
   * Find topic by name or slug
   * Tries slug match first, then name match
   */
  async getTopicByNameOrSlug(value: string): Promise<Topic | null> {
    const topics = await this.getTopics()
    // Try slug first
    const bySlug = topics.find((t) => t.slug === value)
    if (bySlug) return bySlug
    // Try name
    const byName = topics.find((t) => t.name === value)
    return byName || null
  }

  // ===== Connection Test =====

  async testConnection(): Promise<{ ok: boolean; isGuest?: boolean; debug?: string }> {
    const testUrl = `${this.baseUrl}/master/check_logged`

    try {
      console.log('[MixSpace] Testing connection to:', testUrl)

      const response = await requestUrl({
        url: testUrl,
        method: 'GET',
        headers: this.getHeaders(false),
      })

      console.log('[MixSpace] Connection response:', {
        status: response.status,
        body: response.json,
      })

      // Check for HTTP error status
      if (response.status >= 400) {
        const errorMsg = response.json?.message || response.text || `HTTP ${response.status}`
        return {
          ok: false,
          debug: `HTTP ${response.status}: ${errorMsg} (URL: ${testUrl})`,
        }
      }

      const data = response.json as { ok: number; isGuest: boolean } | null
      const ok = !!(data && data.ok === 1 && !data.isGuest)
      const isGuest = !!(data && data.isGuest)
      const debug = response.json
        ? `Response: ${JSON.stringify(response.json)}`
        : 'Empty response body'

      return { ok, isGuest, debug }
    } catch (e) {
      // Parse different error types for better debugging
      let debug: string

      if (e instanceof Error) {
        // Check for common network error patterns
        if (e.message.includes('ENOTFOUND') || e.message.includes('getaddrinfo')) {
          debug = `DNS lookup failed - host not found (URL: ${testUrl})`
        } else if (e.message.includes('ECONNREFUSED')) {
          debug = `Connection refused - server may be down (URL: ${testUrl})`
        } else if (e.message.includes('ETIMEDOUT') || e.message.includes('timeout')) {
          debug = `Connection timeout - server not responding (URL: ${testUrl})`
        } else if (e.message.includes('CERT') || e.message.includes('SSL')) {
          debug = `SSL/Certificate error: ${e.message} (URL: ${testUrl})`
        } else if (e.message.includes('net::ERR_')) {
          debug = `Network error: ${e.message} (URL: ${testUrl})`
        } else {
          debug = `${e.message} (URL: ${testUrl})`
        }
      } else {
        debug = `Unknown error: ${String(e)} (URL: ${testUrl})`
      }

      console.error('[MixSpace] Connection test failed:', debug)
      return { ok: false, debug }
    }
  }
}
