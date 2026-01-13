import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestUrl } from 'obsidian'
import { MixSpaceAPI } from './api'
import type { MixSpaceProfile, NotePayload, PostPayload } from './types'

// Helper to create mock response with all required fields
const mockResponse = (status: number, json: unknown) => ({
  status,
  headers: {},
  arrayBuffer: new ArrayBuffer(0),
  json,
  text: json == null ? '' : typeof json === 'string' ? json : JSON.stringify(json),
})

describe('MixSpaceAPI', () => {
  const testProfile: MixSpaceProfile = {
    id: 'test',
    name: 'Test',
    apiEndpoint: 'https://api.example.com',
    token: 'test-token',
    siteUrl: 'https://example.com',
  }

  let api: MixSpaceAPI

  beforeEach(() => {
    vi.clearAllMocks()
    api = new MixSpaceAPI(testProfile)
  })

  describe('constructor and updateProfile', () => {
    it('should create API with profile', () => {
      expect(api).toBeInstanceOf(MixSpaceAPI)
    })

    it('should update profile', () => {
      const newProfile = { ...testProfile, apiEndpoint: 'https://new-api.example.com' }
      api.updateProfile(newProfile)
      // We verify this works by making a request and checking the URL
    })
  })

  describe('Note API', () => {
    it('should create note', async () => {
      const notePayload: NotePayload = {
        title: 'Test Note',
        text: 'Note content',
      }

      const responseData = {
        id: 'note123',
        nid: 42,
        title: 'Test Note',
        created: '2024-01-01',
        modified: null,
      }

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, responseData))

      const result = await api.createNote(notePayload)

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/notes',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'test-token',
          },
          body: JSON.stringify(notePayload),
        }),
      )
      expect(result).toEqual(responseData)
    })

    it('should update note', async () => {
      const notePayload: Partial<NotePayload> = {
        title: 'Updated Note',
      }

      vi.mocked(requestUrl).mockResolvedValue(
        mockResponse(200, { id: 'note123', nid: 42, title: 'Updated Note' }),
      )

      await api.updateNote('note123', notePayload)

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/notes/note123',
          method: 'PUT',
          body: JSON.stringify(notePayload),
        }),
      )
    })

    it('should patch note', async () => {
      const notePayload: Partial<NotePayload> = {
        mood: 'happy',
      }

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { id: 'note123', mood: 'happy' }))

      await api.patchNote('note123', notePayload)

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/notes/note123',
          method: 'PATCH',
          body: JSON.stringify(notePayload),
        }),
      )
    })

    it('should delete note', async () => {
      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, {}))

      await api.deleteNote('note123')

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/notes/note123',
          method: 'DELETE',
        }),
      )
    })
  })

  describe('Post API', () => {
    it('should create post', async () => {
      const postPayload: PostPayload = {
        title: 'Test Post',
        text: 'Post content',
        slug: 'test-post',
        categoryId: 'cat123',
      }

      const responseData = {
        id: 'post123',
        title: 'Test Post',
        slug: 'test-post',
        categoryId: 'cat123',
      }

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, responseData))

      const result = await api.createPost(postPayload)

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/posts',
          method: 'POST',
          body: JSON.stringify(postPayload),
        }),
      )
      expect(result).toEqual(responseData)
    })

    it('should update post', async () => {
      const postPayload: Partial<PostPayload> = {
        title: 'Updated Post',
      }

      vi.mocked(requestUrl).mockResolvedValue(
        mockResponse(200, { id: 'post123', title: 'Updated Post' }),
      )

      await api.updatePost('post123', postPayload)

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/posts/post123',
          method: 'PUT',
          body: JSON.stringify(postPayload),
        }),
      )
    })

    it('should delete post', async () => {
      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, {}))

      await api.deletePost('post123')

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/posts/post123',
          method: 'DELETE',
        }),
      )
    })
  })

  describe('Metadata API', () => {
    it('should get categories', async () => {
      const categories = [
        { id: 'cat1', name: 'Tech', slug: 'tech' },
        { id: 'cat2', name: 'Life', slug: 'life' },
      ]

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: categories }))

      const result = await api.getCategories()

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/categories',
          method: 'GET',
        }),
      )
      expect(result).toEqual(categories)
    })

    it('should return empty array when getCategories fails', async () => {
      vi.mocked(requestUrl).mockRejectedValue(new Error('Network error'))

      const result = await api.getCategories()

      expect(result).toEqual([])
    })

    it('should get topics', async () => {
      const topics = [
        { id: 'topic1', name: 'Topic 1', slug: 'topic-1' },
        { id: 'topic2', name: 'Topic 2', slug: 'topic-2' },
      ]

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: topics }))

      const result = await api.getTopics()

      expect(result).toEqual(topics)
    })

    it('should return empty array when getTopics fails', async () => {
      vi.mocked(requestUrl).mockRejectedValue(new Error('Network error'))

      const result = await api.getTopics()

      expect(result).toEqual([])
    })

    it('should get category by slug', async () => {
      const categories = [
        { id: 'cat1', name: 'Tech', slug: 'tech' },
        { id: 'cat2', name: 'Life', slug: 'life' },
      ]

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: categories }))

      const result = await api.getCategoryBySlug('tech')

      expect(result).toEqual({ id: 'cat1', name: 'Tech', slug: 'tech' })
    })

    it('should return null when category by slug not found', async () => {
      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: [] }))

      const result = await api.getCategoryBySlug('nonexistent')

      expect(result).toBeNull()
    })

    it('should get category by name or slug - by slug', async () => {
      const categories = [{ id: 'cat1', name: 'Technology', slug: 'tech' }]

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: categories }))

      const result = await api.getCategoryByNameOrSlug('tech')

      expect(result).toEqual({ id: 'cat1', name: 'Technology', slug: 'tech' })
    })

    it('should get category by name or slug - by name', async () => {
      const categories = [{ id: 'cat1', name: 'Technology', slug: 'tech' }]

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: categories }))

      const result = await api.getCategoryByNameOrSlug('Technology')

      expect(result).toEqual({ id: 'cat1', name: 'Technology', slug: 'tech' })
    })

    it('should get topic by name or slug - by slug', async () => {
      const topics = [{ id: 'topic1', name: 'My Topic', slug: 'my-topic' }]

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: topics }))

      const result = await api.getTopicByNameOrSlug('my-topic')

      expect(result).toEqual({ id: 'topic1', name: 'My Topic', slug: 'my-topic' })
    })

    it('should get topic by name or slug - by name', async () => {
      const topics = [{ id: 'topic1', name: 'My Topic', slug: 'my-topic' }]

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: topics }))

      const result = await api.getTopicByNameOrSlug('My Topic')

      expect(result).toEqual({ id: 'topic1', name: 'My Topic', slug: 'my-topic' })
    })

    it('should return null when topic by name or slug not found', async () => {
      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: [] }))

      const result = await api.getTopicByNameOrSlug('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('Error handling', () => {
    it('should throw error on HTTP 400+', async () => {
      vi.mocked(requestUrl).mockResolvedValue(mockResponse(400, { message: 'Bad request' }))

      await expect(api.createNote({ title: 'Test', text: 'Content' })).rejects.toThrow(
        'Bad request',
      )
    })

    it('should throw error with HTTP status when no message', async () => {
      vi.mocked(requestUrl).mockResolvedValue(mockResponse(500, null))

      await expect(api.createNote({ title: 'Test', text: 'Content' })).rejects.toThrow('HTTP 500')
    })
  })

  describe('testConnection', () => {
    it('should return ok when connection is successful', async () => {
      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { ok: 1, isGuest: false }))

      const result = await api.testConnection()

      expect(result.ok).toBe(true)
      expect(result.isGuest).toBe(false)
    })

    it('should return not ok when user is guest', async () => {
      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { ok: 1, isGuest: true }))

      const result = await api.testConnection()

      expect(result.ok).toBe(false)
      expect(result.isGuest).toBe(true)
    })

    it('should return not ok on HTTP error', async () => {
      vi.mocked(requestUrl).mockResolvedValue(mockResponse(401, { message: 'Unauthorized' }))

      const result = await api.testConnection()

      expect(result.ok).toBe(false)
      expect(result.debug).toContain('HTTP 401')
    })

    it('should handle network errors', async () => {
      vi.mocked(requestUrl).mockRejectedValue(new Error('ENOTFOUND'))

      const result = await api.testConnection()

      expect(result.ok).toBe(false)
      expect(result.debug).toContain('DNS lookup failed')
    })

    it('should handle connection refused', async () => {
      vi.mocked(requestUrl).mockRejectedValue(new Error('ECONNREFUSED'))

      const result = await api.testConnection()

      expect(result.ok).toBe(false)
      expect(result.debug).toContain('Connection refused')
    })

    it('should handle timeout', async () => {
      vi.mocked(requestUrl).mockRejectedValue(new Error('ETIMEDOUT'))

      const result = await api.testConnection()

      expect(result.ok).toBe(false)
      expect(result.debug).toContain('timeout')
    })

    it('should handle SSL errors', async () => {
      vi.mocked(requestUrl).mockRejectedValue(new Error('SSL_ERROR_HANDSHAKE_FAILURE_ALERT'))

      const result = await api.testConnection()

      expect(result.ok).toBe(false)
      expect(result.debug).toContain('SSL/Certificate error')
    })
  })

  describe('URL handling', () => {
    it('should strip trailing slash from apiEndpoint', async () => {
      const profileWithSlash = { ...testProfile, apiEndpoint: 'https://api.example.com/' }
      const apiWithSlash = new MixSpaceAPI(profileWithSlash)

      vi.mocked(requestUrl).mockResolvedValue(mockResponse(200, { data: [] }))

      await apiWithSlash.getCategories()

      expect(requestUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/categories',
        }),
      )
    })
  })
})
