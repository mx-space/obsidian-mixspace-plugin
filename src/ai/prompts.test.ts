import { describe, it, expect } from 'vitest'
import { buildTitlePrompt, buildSlugPrompt } from './prompts'
import type { GenerationContext } from './types'

describe('buildTitlePrompt', () => {
  const createContext = (overrides: Partial<GenerationContext> = {}): GenerationContext => ({
    content: 'This is test content for the blog post.',
    fileName: 'test-file',
    contentType: 'post',
    frontmatter: {},
    ...overrides,
  })

  it('should generate a prompt with content preview', () => {
    const context = createContext({
      content: 'This is my blog post about TypeScript and testing.',
    })

    const prompt = buildTitlePrompt(context)

    expect(prompt).toContain('This is my blog post about TypeScript and testing.')
    expect(prompt).toContain('post')
    expect(prompt).toContain('Title:')
  })

  it('should include content type in the prompt', () => {
    const noteContext = createContext({ contentType: 'note' })
    const postContext = createContext({ contentType: 'post' })

    const notePrompt = buildTitlePrompt(noteContext)
    const postPrompt = buildTitlePrompt(postContext)

    expect(notePrompt).toContain('note')
    expect(postPrompt).toContain('post')
  })

  it('should truncate long content to 2000 characters', () => {
    const longContent = 'A'.repeat(3000)
    const context = createContext({ content: longContent })

    const prompt = buildTitlePrompt(context)

    // Content should be truncated to 2000 chars
    const contentInPrompt = prompt.match(/Content:\n([\s\S]*)\n\nTitle:/)?.[1] || ''
    expect(contentInPrompt.length).toBe(2000)
  })

  it('should include requirements for title generation', () => {
    const context = createContext()
    const prompt = buildTitlePrompt(context)

    expect(prompt).toContain('under 60 characters')
    expect(prompt).toContain('detect from content')
    expect(prompt).toContain('Return ONLY the title text')
  })

  it('should work with Chinese content', () => {
    const context = createContext({
      content: '这是一篇关于TypeScript和测试的博客文章。',
    })

    const prompt = buildTitlePrompt(context)

    expect(prompt).toContain('这是一篇关于TypeScript和测试的博客文章。')
  })

  it('should work with empty frontmatter', () => {
    const context = createContext({ frontmatter: {} })
    const prompt = buildTitlePrompt(context)

    expect(prompt).toBeDefined()
    expect(prompt.length).toBeGreaterThan(0)
  })
})

describe('buildSlugPrompt', () => {
  const createContext = (overrides: Partial<GenerationContext> = {}): GenerationContext => ({
    content: 'Test content',
    fileName: 'test-file',
    contentType: 'post',
    frontmatter: {},
    ...overrides,
  })

  it('should use existing title when available', () => {
    const context = createContext({
      existingTitle: 'My Awesome Blog Post',
    })

    const prompt = buildSlugPrompt(context)

    expect(prompt).toContain('My Awesome Blog Post')
    expect(prompt).toContain('Title: My Awesome Blog Post')
  })

  it('should fallback to fileName when no existing title', () => {
    const context = createContext({
      existingTitle: undefined,
      fileName: 'my-test-file',
    })

    const prompt = buildSlugPrompt(context)

    expect(prompt).toContain('Title: my-test-file')
  })

  it('should include slug requirements', () => {
    const context = createContext()
    const prompt = buildSlugPrompt(context)

    expect(prompt).toContain('lowercase letters, numbers, and hyphens only')
    expect(prompt).toContain('under 50 characters')
    expect(prompt).toContain('Return ONLY the slug')
  })

  it('should mention pinyin/romanization for non-English titles', () => {
    const context = createContext({
      existingTitle: '我的博客文章',
    })

    const prompt = buildSlugPrompt(context)

    expect(prompt).toContain('pinyin/romanization')
    expect(prompt).toContain('我的博客文章')
  })

  it('should prefer existing title over fileName', () => {
    const context = createContext({
      existingTitle: 'Existing Title',
      fileName: 'file-name',
    })

    const prompt = buildSlugPrompt(context)

    expect(prompt).toContain('Title: Existing Title')
    expect(prompt).not.toContain('Title: file-name')
  })

  it('should use empty string title when both are empty', () => {
    const context = createContext({
      existingTitle: '',
      fileName: '',
    })

    const prompt = buildSlugPrompt(context)

    expect(prompt).toContain('Title: ')
  })
})
