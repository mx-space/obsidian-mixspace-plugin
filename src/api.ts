import { requestUrl } from 'obsidian'
import { resolveApiVersion, type ApiVersion } from './types'
import type {
  MixSpaceProfile,
  NotePayload,
  NoteResponse,
  PostPayload,
  PostResponse,
  Category,
  Topic,
} from './types'

// v2 raw response shapes (camelCase, bare). Normalized into the v3 snake_case
// NoteResponse / PostResponse before being returned to callers.
interface V2NoteRaw {
  id: string
  nid: number
  title: string
  created?: string
  modified?: string | null
  mood?: string
  weather?: string
  topicId?: string
}

interface V2PostRaw {
  id: string
  title: string
  slug: string
  created?: string
  modified?: string | null
  categoryId?: string
  category?: Category
}

export class MixSpaceAPI {
  private apiVersion: ApiVersion

  constructor(private profile: MixSpaceProfile) {
    this.apiVersion = resolveApiVersion(profile)
  }

  updateProfile(profile: MixSpaceProfile) {
    this.profile = profile
    this.apiVersion = resolveApiVersion(profile)
  }

  private get isV2() {
    return this.apiVersion === 'v2'
  }

  private getHeaders(hasBody: boolean) {
    const headers: Record<string, string> = this.isV2
      ? // Mix Space v2 authenticates API tokens via the bare `Authorization` header.
        { Authorization: this.profile.token }
      : // Mix Space v13 (v3) authenticates API tokens via the `x-api-key` header
        // (the `Authorization` header is reserved for better-auth session cookies).
        { 'x-api-key': this.profile.token }
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
      let json: unknown = null
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
        // v3 error shape: { error: { code, message } }. v2 error shape: { message }.
        // Prefer the version-native field, fall back to the other, then raw text.
        const j = json as { error?: { message?: string }; message?: string } | null
        const errorMsg = this.isV2
          ? j?.message || j?.error?.message || response.text || `HTTP ${response.status}`
          : j?.error?.message || j?.message || response.text || `HTTP ${response.status}`
        throw new Error(String(errorMsg))
      }

      // v3 wraps successful responses as { data, meta }; unwrap `data` so callers
      // receive the resource directly. v2 returns the resource bare, so skip unwrapping.
      let data: unknown = json
      if (!this.isV2 && json && typeof json === 'object' && 'data' in json) {
        data = (json as { data: unknown }).data
      }
      return data as T
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

  // ===== Normalization (v2 camelCase -> v3 snake_case) =====

  private normalizeNote(raw: NoteResponse | V2NoteRaw): NoteResponse {
    if (!this.isV2) return raw as NoteResponse
    const r = raw as V2NoteRaw
    return {
      id: r.id,
      nid: r.nid,
      title: r.title,
      created_at: r.created as string,
      modified_at: r.modified ?? null,
      mood: r.mood,
      weather: r.weather,
      topic_id: r.topicId,
    }
  }

  private normalizePost(raw: PostResponse | V2PostRaw): PostResponse {
    if (!this.isV2) return raw as PostResponse
    const r = raw as V2PostRaw
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      created_at: r.created as string,
      modified_at: r.modified ?? null,
      category_id: r.categoryId as string,
      category: r.category as Category,
    }
  }

  // ===== Note API =====

  async createNote(payload: NotePayload): Promise<NoteResponse> {
    return this.normalizeNote(
      await this.request<NoteResponse | V2NoteRaw>('/notes', 'POST', payload),
    )
  }

  async updateNote(id: string, payload: Partial<NotePayload>): Promise<NoteResponse> {
    return this.normalizeNote(
      await this.request<NoteResponse | V2NoteRaw>(`/notes/${id}`, 'PUT', payload),
    )
  }

  async patchNote(id: string, payload: Partial<NotePayload>): Promise<NoteResponse> {
    return this.normalizeNote(
      await this.request<NoteResponse | V2NoteRaw>(`/notes/${id}`, 'PATCH', payload),
    )
  }

  async deleteNote(nid: string): Promise<void> {
    await this.request(`/notes/${nid}`, 'DELETE')
  }

  // ===== Post API =====

  async createPost(payload: PostPayload): Promise<PostResponse> {
    return this.normalizePost(
      await this.request<PostResponse | V2PostRaw>('/posts', 'POST', payload),
    )
  }

  async updatePost(id: string, payload: Partial<PostPayload>): Promise<PostResponse> {
    return this.normalizePost(
      await this.request<PostResponse | V2PostRaw>(`/posts/${id}`, 'PUT', payload),
    )
  }

  async patchPost(id: string, payload: Partial<PostPayload>): Promise<PostResponse> {
    return this.normalizePost(
      await this.request<PostResponse | V2PostRaw>(`/posts/${id}`, 'PATCH', payload),
    )
  }

  async deletePost(id: string): Promise<void> {
    await this.request(`/posts/${id}`, 'DELETE')
  }

  // ===== Metadata API =====

  async getCategories(): Promise<Category[]> {
    try {
      // v3: request() already unwrapped the `{ data }` envelope into an array.
      // v2: list endpoints still return a `{ data }` envelope (request() leaves
      // v2 responses untouched, since v2 single resources are bare), so unwrap here.
      const res = await this.request<Category[] | { data?: Category[] }>('/categories', 'GET')
      return Array.isArray(res) ? res : (res?.data ?? [])
    } catch {
      return []
    }
  }

  async getTopics(): Promise<Topic[]> {
    try {
      // See getCategories(): v2 list endpoints wrap results in `{ data }`.
      const res = await this.request<Topic[] | { data?: Topic[] }>('/topics', 'GET')
      return Array.isArray(res) ? res : (res?.data ?? [])
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

  public async testConnection(): Promise<{ ok: boolean; isGuest?: boolean; debug?: string }> {
    return this.isV2 ? this.testConnectionV2() : this.testConnectionV3()
  }

  // Classify a thrown network error into a human-readable debug string. Shared by both versions.
  private classifyNetworkError(e: unknown, testUrl: string): string {
    let debug: string
    if (e instanceof Error) {
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
    return debug
  }

  private async testConnectionV3(): Promise<{ ok: boolean; isGuest?: boolean; debug?: string }> {
    // v13 removed /master/check_logged. Use an owner-only GET endpoint instead:
    // /snippets returns 200 with a valid owner token, 401 with an invalid one.
    const testUrl = `${this.baseUrl}/snippets`

    try {
      console.log('[MixSpace] Testing connection to:', testUrl)

      const response = await requestUrl({
        url: testUrl,
        method: 'GET',
        headers: this.getHeaders(false),
        throw: false, // inspect status ourselves
      })

      console.log('[MixSpace] Connection response:', {
        status: response.status,
        body: response.text,
      })

      const parseErr = (): string => {
        try {
          return (
            (response.json as { error?: { message?: string } })?.error?.message ||
            response.text ||
            `HTTP ${response.status}`
          )
        } catch {
          return response.text || `HTTP ${response.status}`
        }
      }

      // Reachable but token invalid / not the owner
      if (response.status === 401 || response.status === 403) {
        return { ok: false, isGuest: true, debug: `Auth failed: ${parseErr()} (URL: ${testUrl})` }
      }

      // Other non-2xx: endpoint / connection problem
      if (response.status >= 400) {
        return { ok: false, debug: `HTTP ${response.status}: ${parseErr()} (URL: ${testUrl})` }
      }

      // 2xx: reachable AND authenticated as owner
      return { ok: true, debug: `HTTP ${response.status} (URL: ${testUrl})` }
    } catch (e) {
      return { ok: false, debug: this.classifyNetworkError(e, testUrl) }
    }
  }

  private async testConnectionV2(): Promise<{ ok: boolean; isGuest?: boolean; debug?: string }> {
    // v2 exposes /master/check_logged returning { ok: 1, isGuest }.
    const testUrl = `${this.baseUrl}/master/check_logged`

    try {
      console.log('[MixSpace] Testing connection to:', testUrl)

      const response = await requestUrl({
        url: testUrl,
        method: 'GET',
        headers: this.getHeaders(false),
        throw: false, // inspect status ourselves
      })

      console.log('[MixSpace] Connection response:', {
        status: response.status,
        body: response.text,
      })

      if (response.status === 401 || response.status === 403) {
        return { ok: false, isGuest: true, debug: `Auth failed (URL: ${testUrl})` }
      }
      if (response.status >= 400) {
        return { ok: false, debug: `HTTP ${response.status} (URL: ${testUrl})` }
      }

      let body: { isGuest?: boolean } | null = null
      try {
        body = response.json as { isGuest?: boolean }
      } catch {
        // empty / non-JSON body
      }

      // v2 returns { ok: 1, isGuest }: owner is authenticated iff isGuest === false.
      if (body && body.isGuest === false) {
        return { ok: true, debug: `HTTP ${response.status} owner (URL: ${testUrl})` }
      }
      return { ok: false, isGuest: true, debug: `Guest/invalid token (URL: ${testUrl})` }
    } catch (e) {
      return { ok: false, debug: this.classifyNetworkError(e, testUrl) }
    }
  }
}
