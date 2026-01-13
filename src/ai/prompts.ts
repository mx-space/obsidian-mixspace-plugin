import type { GenerationContext } from './types'

/**
 * Generate prompt for title generation
 * Designed to produce concise, descriptive titles
 */
export function buildTitlePrompt(context: GenerationContext): string {
  const contentPreview = context.content.slice(0, 2000)

  return `You are a content title generator for a blog/notes system.
Generate a concise, engaging title for the following ${context.contentType} content.

Requirements:
- Title should be descriptive and capture the main topic
- Keep it under 60 characters
- Use the content's language (detect from content)
- Do not use quotes or special formatting
- Return ONLY the title text, nothing else

Content:
${contentPreview}

Title:`
}

/**
 * Generate prompt for slug generation
 * Produces URL-friendly slugs
 */
export function buildSlugPrompt(context: GenerationContext): string {
  const title = context.existingTitle || context.fileName

  return `You are a URL slug generator for a blog/notes system.
Generate a URL-friendly slug for the following title.

Requirements:
- Use lowercase letters, numbers, and hyphens only
- Keep it under 50 characters
- Preserve meaning while being concise
- For non-English titles (e.g., Chinese, Japanese), use pinyin/romanization
- Return ONLY the slug, nothing else

Title: ${title}

Slug:`
}
