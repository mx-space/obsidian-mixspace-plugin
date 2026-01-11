import type { MixSpaceAPI } from '../api'
import type { ContentType, NoteFrontmatter, NotePayload, PostPayload } from '../types'

/**
 * Detect content type based on frontmatter fields
 */
export function detectContentType(frontmatter: NoteFrontmatter): ContentType {
  // Explicit type field
  if (frontmatter.type === 'post') return 'post'
  if (frontmatter.type === 'note') return 'note'

  // Has category info -> post
  if (frontmatter.categories || frontmatter.categoryId) return 'post'

  // Has note-specific fields -> note
  if (frontmatter.mood || frontmatter.weather || frontmatter.topicId) return 'note'

  // Default to note
  return 'note'
}

/**
 * Strip the first H1 heading from body if it matches the title
 * This handles cases where the title appears both as filename and as H1 in content
 */
export function stripFirstH1IfMatchesTitle(body: string, title: string): string {
  const lines = body.split('\n')
  if (lines.length === 0) return body

  const firstLine = lines[0].trim()
  // Check if first line is an H1 heading (starts with single #)
  const h1Match = firstLine.match(/^#\s+(.+)$/)
  if (h1Match) {
    const h1Title = h1Match[1].trim()
    // If H1 title matches the file title, remove it
    if (h1Title === title) {
      // Remove the first line and any immediately following blank lines
      let startIndex = 1
      while (startIndex < lines.length && lines[startIndex].trim() === '') {
        startIndex++
      }
      return lines.slice(startIndex).join('\n')
    }
  }
  return body
}

/**
 * Build Note payload for Mix Space API
 */
export function buildNotePayload(
  frontmatter: NoteFrontmatter,
  body: string,
  fileName: string,
): NotePayload {
  // Use fileName as title (ignoring frontmatter.title)
  const title = fileName
  // Strip first H1 if it matches the title
  const processedBody = stripFirstH1IfMatchesTitle(body, title)

  const payload: NotePayload = {
    title,
    text: processedBody,
  }

  // Optional fields - only include if present
  if (frontmatter.mood) payload.mood = frontmatter.mood
  if (frontmatter.weather) payload.weather = frontmatter.weather
  if (frontmatter.allowComment !== undefined) payload.allowComment = frontmatter.allowComment
  if (frontmatter.password) payload.password = frontmatter.password
  if (frontmatter.publicAt) payload.publicAt = frontmatter.publicAt
  if (frontmatter.bookmark !== undefined) payload.bookmark = frontmatter.bookmark
  if (frontmatter.location) payload.location = frontmatter.location
  if (frontmatter.coordinates) payload.coordinates = frontmatter.coordinates
  if (frontmatter.topicId) payload.topicId = frontmatter.topicId

  return payload
}

/**
 * Build Post payload for Mix Space API
 */
export async function buildPostPayload(
  frontmatter: NoteFrontmatter,
  body: string,
  fileName: string,
  api: MixSpaceAPI,
): Promise<PostPayload> {
  // Resolve categoryId from categories (name or slug)
  let categoryId = frontmatter.categoryId
  if (!categoryId && frontmatter.categories) {
    // Try to find by name or slug
    const category = await api.getCategoryByNameOrSlug(frontmatter.categories)
    if (category) {
      categoryId = category.id
    } else {
      // Provide helpful error with available categories
      const allCategories = await api.getCategories()
      const available = allCategories.map((c) => `${c.name}(${c.slug})`).join(', ')
      throw new Error(
        `Category not found: "${frontmatter.categories}". Available: [${available || 'none'}]`,
      )
    }
  }

  if (!categoryId) {
    throw new Error('Post requires categoryId or categories field')
  }

  // Use fileName as title (ignoring frontmatter.title)
  const title = fileName
  // Strip first H1 if it matches the title
  const processedBody = stripFirstH1IfMatchesTitle(body, title)

  const payload: PostPayload = {
    title,
    text: processedBody,
    slug: frontmatter.slug || generateSlug(title),
    categoryId,
  }

  // Handle tags - can be array or comma-separated string
  if (frontmatter.tags) {
    if (Array.isArray(frontmatter.tags)) {
      // Filter out empty strings
      payload.tags = frontmatter.tags.filter((t) => t && t.trim())
    } else if (typeof frontmatter.tags === 'string') {
      const tagsStr = frontmatter.tags.trim()
      // Handle empty array string "[]" or empty string
      if (tagsStr && tagsStr !== '[]' && tagsStr !== '[ ]') {
        payload.tags = tagsStr
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      }
    }
  }

  // Optional fields
  if (frontmatter.summary) payload.summary = frontmatter.summary
  if (frontmatter.copyright !== undefined) payload.copyright = frontmatter.copyright
  if (frontmatter.allowComment !== undefined) payload.allowComment = frontmatter.allowComment
  if (frontmatter.pin) payload.pin = frontmatter.pin

  return payload
}

/**
 * Generate URL-friendly slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
}
