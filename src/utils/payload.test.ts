import { describe, it, expect, vi } from 'vitest'
import {
  detectContentType,
  stripFirstH1IfMatchesTitle,
  buildNotePayload,
  buildPostPayload,
  generateSlug,
} from './payload'
import type { MixSpaceAPI } from '../api'
import type { NoteFrontmatter } from '../types'

describe('detectContentType', () => {
  it('should return "post" when type field is explicitly set to post', () => {
    const frontmatter: NoteFrontmatter = { type: 'post' }
    expect(detectContentType(frontmatter)).toBe('post')
  })

  it('should return "note" when type field is explicitly set to note', () => {
    const frontmatter: NoteFrontmatter = { type: 'note' }
    expect(detectContentType(frontmatter)).toBe('note')
  })

  it('should return "post" when categories field is present', () => {
    const frontmatter: NoteFrontmatter = { categories: 'technology' }
    expect(detectContentType(frontmatter)).toBe('post')
  })

  it('should return "post" when categoryId field is present', () => {
    const frontmatter: NoteFrontmatter = { categoryId: 'cat123' }
    expect(detectContentType(frontmatter)).toBe('post')
  })

  it('should return "note" when mood field is present', () => {
    const frontmatter: NoteFrontmatter = { mood: 'happy' }
    expect(detectContentType(frontmatter)).toBe('note')
  })

  it('should return "note" when weather field is present', () => {
    const frontmatter: NoteFrontmatter = { weather: 'sunny' }
    expect(detectContentType(frontmatter)).toBe('note')
  })

  it('should return "note" when topicId field is present', () => {
    const frontmatter: NoteFrontmatter = { topicId: 'topic123' }
    expect(detectContentType(frontmatter)).toBe('note')
  })

  it('should default to "note" when no specific fields are present', () => {
    const frontmatter: NoteFrontmatter = { title: 'Test' }
    expect(detectContentType(frontmatter)).toBe('note')
  })

  it('should default to "note" for empty frontmatter', () => {
    const frontmatter: NoteFrontmatter = {}
    expect(detectContentType(frontmatter)).toBe('note')
  })

  it('should prioritize explicit type over other fields', () => {
    const frontmatter: NoteFrontmatter = {
      type: 'note',
      categories: 'technology', // Would normally make it a post
    }
    expect(detectContentType(frontmatter)).toBe('note')
  })
})

describe('stripFirstH1IfMatchesTitle', () => {
  it('should strip H1 when it matches the title', () => {
    const body = '# My Title\n\nContent here'
    const result = stripFirstH1IfMatchesTitle(body, 'My Title')
    expect(result).toBe('Content here')
  })

  it('should strip H1 and following blank lines', () => {
    const body = '# My Title\n\n\n\nContent here'
    const result = stripFirstH1IfMatchesTitle(body, 'My Title')
    expect(result).toBe('Content here')
  })

  it('should not strip H1 when it does not match the title', () => {
    const body = '# Different Title\n\nContent here'
    const result = stripFirstH1IfMatchesTitle(body, 'My Title')
    expect(result).toBe('# Different Title\n\nContent here')
  })

  it('should not strip H2 or other headings', () => {
    const body = '## My Title\n\nContent here'
    const result = stripFirstH1IfMatchesTitle(body, 'My Title')
    expect(result).toBe('## My Title\n\nContent here')
  })

  it('should handle body without headings', () => {
    const body = 'Just plain content'
    const result = stripFirstH1IfMatchesTitle(body, 'My Title')
    expect(result).toBe('Just plain content')
  })

  it('should handle empty body', () => {
    const body = ''
    const result = stripFirstH1IfMatchesTitle(body, 'My Title')
    expect(result).toBe('')
  })

  it('should handle H1 with extra spaces', () => {
    const body = '#   My Title  \n\nContent'
    const result = stripFirstH1IfMatchesTitle(body, 'My Title')
    expect(result).toBe('Content')
  })

  it('should preserve content when H1 is not on first line', () => {
    const body = 'Some intro\n# My Title\n\nContent'
    const result = stripFirstH1IfMatchesTitle(body, 'My Title')
    expect(result).toBe('Some intro\n# My Title\n\nContent')
  })
})

describe('generateSlug', () => {
  it('should convert title to lowercase', () => {
    expect(generateSlug('My Title')).toBe('my-title')
  })

  it('should replace spaces with hyphens', () => {
    expect(generateSlug('hello world')).toBe('hello-world')
  })

  it('should remove special characters', () => {
    expect(generateSlug('Hello! World?')).toBe('hello-world')
  })

  it('should preserve Chinese characters', () => {
    expect(generateSlug('你好世界')).toBe('你好世界')
  })

  it('should handle mixed Chinese and English', () => {
    expect(generateSlug('Hello 你好 World')).toBe('hello-你好-world')
  })

  it('should remove leading and trailing hyphens', () => {
    expect(generateSlug('---hello---')).toBe('hello')
  })

  it('should collapse multiple hyphens', () => {
    expect(generateSlug('hello   world')).toBe('hello-world')
  })

  it('should handle numbers', () => {
    expect(generateSlug('Version 2.0')).toBe('version-2-0')
  })
})

describe('buildNotePayload', () => {
  it('should build basic note payload with fileName as title', () => {
    const frontmatter: NoteFrontmatter = {}
    const body = 'Note content'
    const fileName = 'My Note'

    const payload = buildNotePayload(frontmatter, body, fileName)

    expect(payload.title).toBe('My Note')
    expect(payload.text).toBe('Note content')
  })

  it('should ignore frontmatter.title and use fileName', () => {
    const frontmatter: NoteFrontmatter = { title: 'Frontmatter Title' }
    const body = 'Note content'
    const fileName = 'File Name'

    const payload = buildNotePayload(frontmatter, body, fileName)

    expect(payload.title).toBe('File Name')
  })

  it('should strip H1 if it matches fileName', () => {
    const frontmatter: NoteFrontmatter = {}
    const body = '# My Note\n\nActual content'
    const fileName = 'My Note'

    const payload = buildNotePayload(frontmatter, body, fileName)

    expect(payload.title).toBe('My Note')
    expect(payload.text).toBe('Actual content')
  })

  it('should include optional fields when present', () => {
    const frontmatter: NoteFrontmatter = {
      mood: 'happy',
      weather: 'sunny',
      allowComment: true,
      password: 'secret',
      publicAt: '2024-01-01',
      bookmark: true,
      location: 'Tokyo',
      coordinates: { latitude: 35.6762, longitude: 139.6503 },
      topicId: 'topic123',
    }
    const body = 'Content'
    const fileName = 'Note'

    const payload = buildNotePayload(frontmatter, body, fileName)

    expect(payload.mood).toBe('happy')
    expect(payload.weather).toBe('sunny')
    expect(payload.allowComment).toBe(true)
    expect(payload.password).toBe('secret')
    expect(payload.publicAt).toBe('2024-01-01')
    expect(payload.bookmark).toBe(true)
    expect(payload.location).toBe('Tokyo')
    expect(payload.coordinates).toEqual({ latitude: 35.6762, longitude: 139.6503 })
    expect(payload.topicId).toBe('topic123')
  })

  it('should not include optional fields when not present', () => {
    const frontmatter: NoteFrontmatter = {}
    const body = 'Content'
    const fileName = 'Note'

    const payload = buildNotePayload(frontmatter, body, fileName)

    expect(payload.mood).toBeUndefined()
    expect(payload.weather).toBeUndefined()
    expect(payload.allowComment).toBeUndefined()
  })
})

describe('buildPostPayload', () => {
  const createMockApi = (categories: Array<{ id: string; name: string; slug: string }>) => {
    return {
      getCategoryByNameOrSlug: vi.fn().mockImplementation((value: string) => {
        return Promise.resolve(categories.find((c) => c.slug === value || c.name === value) || null)
      }),
      getCategories: vi.fn().mockResolvedValue(categories),
    } as unknown as MixSpaceAPI
  }

  it('should build basic post payload with categoryId', async () => {
    const frontmatter: NoteFrontmatter = { categoryId: 'cat123' }
    const body = 'Post content'
    const fileName = 'My Post'
    const api = createMockApi([])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.title).toBe('My Post')
    expect(payload.text).toBe('Post content')
    expect(payload.categoryId).toBe('cat123')
    expect(payload.slug).toBe('my-post')
  })

  it('should resolve category by name', async () => {
    const frontmatter: NoteFrontmatter = { categories: 'Technology' }
    const body = 'Content'
    const fileName = 'Post'
    const api = createMockApi([{ id: 'cat123', name: 'Technology', slug: 'tech' }])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.categoryId).toBe('cat123')
  })

  it('should resolve category by slug', async () => {
    const frontmatter: NoteFrontmatter = { categories: 'tech' }
    const body = 'Content'
    const fileName = 'Post'
    const api = createMockApi([{ id: 'cat123', name: 'Technology', slug: 'tech' }])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.categoryId).toBe('cat123')
  })

  it('should throw error when category not found', async () => {
    const frontmatter: NoteFrontmatter = { categories: 'nonexistent' }
    const body = 'Content'
    const fileName = 'Post'
    const api = createMockApi([{ id: 'cat123', name: 'Technology', slug: 'tech' }])

    await expect(buildPostPayload(frontmatter, body, fileName, api)).rejects.toThrow(
      'Category not found: "nonexistent"',
    )
  })

  it('should throw error when no category provided', async () => {
    const frontmatter: NoteFrontmatter = {}
    const body = 'Content'
    const fileName = 'Post'
    const api = createMockApi([])

    await expect(buildPostPayload(frontmatter, body, fileName, api)).rejects.toThrow(
      'Post requires categoryId or categories field',
    )
  })

  it('should use frontmatter.slug when provided', async () => {
    const frontmatter: NoteFrontmatter = { categoryId: 'cat123', slug: 'custom-slug' }
    const body = 'Content'
    const fileName = 'Post Title'
    const api = createMockApi([])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.slug).toBe('custom-slug')
  })

  it('should handle array tags', async () => {
    const frontmatter: NoteFrontmatter = {
      categoryId: 'cat123',
      tags: ['tag1', 'tag2', 'tag3'],
    }
    const body = 'Content'
    const fileName = 'Post'
    const api = createMockApi([])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.tags).toEqual(['tag1', 'tag2', 'tag3'])
  })

  it('should handle string tags (comma-separated)', async () => {
    const frontmatter: NoteFrontmatter = {
      categoryId: 'cat123',
      tags: 'tag1, tag2, tag3',
    }
    const body = 'Content'
    const fileName = 'Post'
    const api = createMockApi([])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.tags).toEqual(['tag1', 'tag2', 'tag3'])
  })

  it('should filter empty tags from array', async () => {
    const frontmatter: NoteFrontmatter = {
      categoryId: 'cat123',
      tags: ['tag1', '', '  ', 'tag2'],
    }
    const body = 'Content'
    const fileName = 'Post'
    const api = createMockApi([])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.tags).toEqual(['tag1', 'tag2'])
  })

  it('should handle empty array string "[]"', async () => {
    const frontmatter: NoteFrontmatter = {
      categoryId: 'cat123',
      tags: '[]',
    }
    const body = 'Content'
    const fileName = 'Post'
    const api = createMockApi([])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.tags).toBeUndefined()
  })

  it('should include optional post fields', async () => {
    const frontmatter: NoteFrontmatter = {
      categoryId: 'cat123',
      summary: 'Post summary',
      copyright: true,
      allowComment: false,
      pin: 'true',
    }
    const body = 'Content'
    const fileName = 'Post'
    const api = createMockApi([])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.summary).toBe('Post summary')
    expect(payload.copyright).toBe(true)
    expect(payload.allowComment).toBe(false)
    expect(payload.pin).toBe('true')
  })

  it('should strip H1 if it matches fileName', async () => {
    const frontmatter: NoteFrontmatter = { categoryId: 'cat123' }
    const body = '# My Post\n\nActual content'
    const fileName = 'My Post'
    const api = createMockApi([])

    const payload = await buildPostPayload(frontmatter, body, fileName, api)

    expect(payload.text).toBe('Actual content')
  })
})
