import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatBacklinkErrors, convertBacklinks, type BacklinkError } from './backlinks'
import type { MixSpaceAPI } from '../api'
import type { App, TFile, Vault } from 'obsidian'

describe('formatBacklinkErrors', () => {
  it('should return empty string for no errors', () => {
    const errors: BacklinkError[] = []
    expect(formatBacklinkErrors(errors)).toBe('')
  })

  it('should format single error', () => {
    const errors: BacklinkError[] = [{ link: 'my-note', reason: 'File not found' }]

    const result = formatBacklinkErrors(errors)

    expect(result).toContain('Backlink conversion errors:')
    expect(result).toContain('[[my-note]]: File not found')
  })

  it('should format multiple errors', () => {
    const errors: BacklinkError[] = [
      { link: 'note1', reason: 'File not found' },
      { link: 'note2', reason: 'Missing oid' },
      { link: 'note3', reason: 'Category not found' },
    ]

    const result = formatBacklinkErrors(errors)

    expect(result).toContain('[[note1]]: File not found')
    expect(result).toContain('[[note2]]: Missing oid')
    expect(result).toContain('[[note3]]: Category not found')
  })
})

describe('convertBacklinks', () => {
  const createMockApp = (files: Array<{ path: string; content: string }>): App => {
    const mockFiles: TFile[] = files.map((f) => ({
      path: f.path,
      name: f.path.split('/').pop() || f.path,
      basename: (f.path.split('/').pop() || f.path).replace(/\.md$/, ''),
      extension: 'md',
    })) as TFile[]

    const vault = {
      getMarkdownFiles: vi.fn().mockReturnValue(mockFiles),
      read: vi.fn().mockImplementation((file: TFile) => {
        const found = files.find((f) => f.path === file.path)
        return Promise.resolve(found?.content || '')
      }),
    } as unknown as Vault

    return { vault } as App
  }

  const createMockApi = (
    categories: Array<{ id: string; name: string; slug: string }> = [],
  ): MixSpaceAPI => {
    return {
      getCategories: vi.fn().mockResolvedValue(categories),
      getCategoryByNameOrSlug: vi.fn().mockImplementation((value: string) => {
        return Promise.resolve(categories.find((c) => c.slug === value || c.name === value) || null)
      }),
    } as unknown as MixSpaceAPI
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return text unchanged when no siteUrl is provided', async () => {
    const text = 'Hello [[world]] there'
    const app = createMockApp([])

    const result = await convertBacklinks(text, '', app)

    expect(result.text).toBe(text)
    expect(result.errors).toHaveLength(0)
  })

  it('should return text unchanged when no backlinks exist', async () => {
    const text = 'Hello world, no links here'
    const app = createMockApp([])

    const result = await convertBacklinks(text, 'https://example.com', app)

    expect(result.text).toBe(text)
    expect(result.errors).toHaveLength(0)
  })

  it('should report error when linked file is not found', async () => {
    const text = 'Check out [[nonexistent]]'
    const app = createMockApp([])

    const result = await convertBacklinks(text, 'https://example.com', app)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].link).toBe('nonexistent')
    expect(result.errors[0].reason).toContain('File not found')
  })

  it('should report error when linked file is not published', async () => {
    const text = 'Check out [[my-note]]'
    const app = createMockApp([
      {
        path: 'my-note.md',
        content: `---
title: My Note
---
Content`,
      },
    ])

    const result = await convertBacklinks(text, 'https://example.com', app)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].link).toBe('my-note')
    expect(result.errors[0].reason).toContain('not published')
  })

  it('should convert note backlink to URL', async () => {
    const text = 'Check out [[my-note]]'
    const app = createMockApp([
      {
        path: 'my-note.md',
        content: `---
oid: abc123
id: 42
type: note
---
Content`,
      },
    ])

    const result = await convertBacklinks(text, 'https://example.com', app)

    expect(result.errors).toHaveLength(0)
    expect(result.text).toBe('Check out [my-note](https://example.com/notes/42)')
  })

  it('should convert post backlink to URL', async () => {
    const text = 'Check out [[my-post]]'
    const app = createMockApp([
      {
        path: 'my-post.md',
        content: `---
oid: abc123
type: post
categories: tech
slug: my-post-slug
---
Content`,
      },
    ])
    const api = createMockApi([{ id: 'cat1', name: 'Technology', slug: 'tech' }])

    const result = await convertBacklinks(text, 'https://example.com', app, api)

    expect(result.errors).toHaveLength(0)
    expect(result.text).toBe('Check out [my-post](https://example.com/posts/tech/my-post-slug)')
  })

  it('should use display text when provided', async () => {
    const text = 'Check out [[my-note|Custom Display]]'
    const app = createMockApp([
      {
        path: 'my-note.md',
        content: `---
oid: abc123
id: 42
type: note
---
Content`,
      },
    ])

    const result = await convertBacklinks(text, 'https://example.com', app)

    expect(result.text).toBe('Check out [Custom Display](https://example.com/notes/42)')
  })

  it('should convert multiple backlinks', async () => {
    const text = 'See [[note1]] and [[note2]]'
    const app = createMockApp([
      {
        path: 'note1.md',
        content: `---
oid: abc1
id: 1
type: note
---`,
      },
      {
        path: 'note2.md',
        content: `---
oid: abc2
id: 2
type: note
---`,
      },
    ])

    const result = await convertBacklinks(text, 'https://example.com', app)

    expect(result.errors).toHaveLength(0)
    expect(result.text).toContain('[note1](https://example.com/notes/1)')
    expect(result.text).toContain('[note2](https://example.com/notes/2)')
  })

  it('should provide debug info about categories', async () => {
    const text = 'Test'
    const app = createMockApp([])
    const api = createMockApi([
      { id: 'cat1', name: 'Tech', slug: 'tech' },
      { id: 'cat2', name: 'Life', slug: 'life' },
    ])

    const result = await convertBacklinks(text, 'https://example.com', app, api)

    expect(result.debug.categoriesLoaded).toBe(2)
    expect(result.debug.categories).toHaveLength(2)
    expect(result.debug.categories[0]).toEqual({ id: 'cat1', name: 'Tech', slug: 'tech' })
  })

  it('should report error when post is missing slug', async () => {
    const text = '[[my-post]]'
    const app = createMockApp([
      {
        path: 'my-post.md',
        content: `---
oid: abc123
type: post
categories: tech
---
Content`,
      },
    ])
    const api = createMockApi([{ id: 'cat1', name: 'Technology', slug: 'tech' }])

    const result = await convertBacklinks(text, 'https://example.com', app, api)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].reason).toContain('missing slug')
  })

  it('should report error when post category not found', async () => {
    const text = '[[my-post]]'
    const app = createMockApp([
      {
        path: 'my-post.md',
        content: `---
oid: abc123
type: post
categories: unknown-category
slug: my-post
---
Content`,
      },
    ])
    const api = createMockApi([{ id: 'cat1', name: 'Technology', slug: 'tech' }])

    const result = await convertBacklinks(text, 'https://example.com', app, api)

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].reason).toContain('Category not found')
  })

  it('should find file by basename (case insensitive)', async () => {
    const text = '[[MY-NOTE]]'
    const app = createMockApp([
      {
        path: 'my-note.md',
        content: `---
oid: abc123
id: 42
type: note
---
Content`,
      },
    ])

    const result = await convertBacklinks(text, 'https://example.com', app)

    expect(result.errors).toHaveLength(0)
    expect(result.text).toContain('https://example.com/notes/42')
  })

  it('should track conversion debug info', async () => {
    const text = '[[my-note]]'
    const app = createMockApp([
      {
        path: 'folder/my-note.md',
        content: `---
oid: abc123
id: 42
type: note
---
Content`,
      },
    ])

    const result = await convertBacklinks(text, 'https://example.com', app)

    expect(result.debug.conversions).toHaveLength(1)
    expect(result.debug.conversions[0].link).toBe('my-note')
    expect(result.debug.conversions[0].file).toBe('folder/my-note.md')
    expect(result.debug.conversions[0].contentType).toBe('note')
    expect(result.debug.conversions[0].finalUrl).toBe('https://example.com/notes/42')
  })
})
