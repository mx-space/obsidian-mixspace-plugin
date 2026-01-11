import type { App, TFile } from 'obsidian'
import type { MixSpaceAPI } from '../api'
import type { Category, NoteFrontmatter } from '../types'
import { parseFrontmatter } from './frontmatter'
import { detectContentType } from './payload'

export interface BacklinkError {
  link: string
  reason: string
}

export interface BacklinkDebugInfo {
  categoriesLoaded: number
  categories: Array<{ name: string; slug: string; id: string }>
  conversions: Array<{
    link: string
    file: string | null
    contentType: string | null
    categoryValue: string | null
    resolvedCategorySlug: string | null
    finalUrl: string | null
    error: string | null
  }>
}

export interface BacklinkConversionResult {
  text: string
  errors: BacklinkError[]
  debug: BacklinkDebugInfo
}

// Cache for categories during conversion
let categoriesCache: Category[] | null = null

/**
 * Convert Obsidian backlinks [[...]] to Mix Space URLs
 *
 * URL formats:
 * - Post: {siteUrl}/posts/{categorySlug}/{slug}
 * - Note: {siteUrl}/notes/{nid}
 */
export async function convertBacklinks(
  text: string,
  siteUrl: string,
  app: App,
  api?: MixSpaceAPI,
): Promise<BacklinkConversionResult> {
  const errors: BacklinkError[] = []
  const debug: BacklinkDebugInfo = {
    categoriesLoaded: 0,
    categories: [],
    conversions: [],
  }

  // Always pre-fetch categories for debugging (even if no siteUrl)
  if (api) {
    try {
      categoriesCache = await api.getCategories()
      debug.categoriesLoaded = categoriesCache.length
      debug.categories = categoriesCache.map((c) => ({
        name: c.name,
        slug: c.slug,
        id: c.id,
      }))
    } catch (e) {
      categoriesCache = []
      debug.categoriesLoaded = 0
      console.error('Failed to fetch categories:', e)
    }
  }

  if (!siteUrl) {
    // If no siteUrl configured, return text as-is (but still return debug info)
    return { text, errors, debug }
  }

  // Match [[link]] or [[link|display text]]
  const backlinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

  const replacements: Array<{ match: string; replacement: string }> = []

  let match: RegExpExecArray | null
  while ((match = backlinkRegex.exec(text)) !== null) {
    const [fullMatch, linkTarget, displayText] = match
    const linkName = linkTarget.trim()

    const conversionDebug: BacklinkDebugInfo['conversions'][0] = {
      link: linkName,
      file: null,
      contentType: null,
      categoryValue: null,
      resolvedCategorySlug: null,
      finalUrl: null,
      error: null,
    }

    try {
      const result = await resolveBacklinkUrlWithDebug(linkName, siteUrl, app, conversionDebug)
      const label = displayText?.trim() || linkName
      replacements.push({
        match: fullMatch,
        replacement: `[${label}](${result})`,
      })
      conversionDebug.finalUrl = result
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error'
      conversionDebug.error = reason
      errors.push({
        link: linkName,
        reason,
      })
    }

    debug.conversions.push(conversionDebug)
  }

  // Apply replacements
  let result = text
  for (const { match, replacement } of replacements) {
    result = result.replace(match, replacement)
  }

  return { text: result, errors, debug }
}

/**
 * Resolve a backlink name to its Mix Space URL (with debug info)
 */
async function resolveBacklinkUrlWithDebug(
  linkName: string,
  siteUrl: string,
  app: App,
  debug: BacklinkDebugInfo['conversions'][0],
): Promise<string> {
  // Find the file in vault
  const file = findFileByName(linkName, app)

  if (!file) {
    throw new Error(`File not found: "${linkName}"`)
  }

  debug.file = file.path

  // Read and parse frontmatter
  const content = await app.vault.read(file)
  const { frontmatter } = parseFrontmatter(content)

  // Check if published (has oid)
  if (!frontmatter.oid) {
    throw new Error(`File "${linkName}" is not published (missing oid)`)
  }

  const contentType = detectContentType(frontmatter)
  debug.contentType = contentType

  if (contentType === 'note') {
    return buildNoteUrl(frontmatter, siteUrl, linkName)
  } else {
    return buildPostUrlWithDebug(frontmatter, siteUrl, linkName, debug)
  }
}

/**
 * Build URL for a note: {siteUrl}/notes/{nid}
 */
function buildNoteUrl(frontmatter: NoteFrontmatter, siteUrl: string, linkName: string): string {
  const nid = frontmatter.id || frontmatter.nid

  if (!nid) {
    throw new Error(`Note "${linkName}" is missing nid/id field`)
  }

  return `${siteUrl}/notes/${nid}`
}

/**
 * Build URL for a post: {siteUrl}/posts/{categorySlug}/{slug}
 */
function buildPostUrlWithDebug(
  frontmatter: NoteFrontmatter,
  siteUrl: string,
  linkName: string,
  debug: BacklinkDebugInfo['conversions'][0],
): string {
  // Get category - could be slug, name, or categoryId
  const categoryValue = frontmatter.categories || frontmatter.categorySlug
  const categoryId = frontmatter.categoryId

  // Ensure we only assign string values (YAML may parse empty values as {})
  const resolvedCategoryValue =
    typeof categoryValue === 'string'
      ? categoryValue
      : typeof categoryId === 'string'
        ? categoryId
        : null
  debug.categoryValue = resolvedCategoryValue

  let categorySlug: string | undefined

  if (categoryValue) {
    // Try to find category by slug first
    const bySlug = categoriesCache?.find((c) => c.slug === categoryValue)
    if (bySlug) {
      categorySlug = bySlug.slug
      debug.resolvedCategorySlug = `${bySlug.slug} (matched by slug)`
    } else {
      // Try to find by name (e.g., "技术" -> "technology")
      const byName = categoriesCache?.find((c) => c.name === categoryValue)
      if (byName) {
        categorySlug = byName.slug
        debug.resolvedCategorySlug = `${byName.slug} (matched by name "${byName.name}")`
      } else {
        // Not found in cache - this is the error case
        debug.resolvedCategorySlug = `NOT FOUND in ${categoriesCache?.length || 0} categories`
        throw new Error(
          `Category not found: "${categoryValue}". Available: [${categoriesCache?.map((c) => `${c.name}(${c.slug})`).join(', ') || 'none'}]`,
        )
      }
    }
  } else if (categoryId) {
    // Find by ID
    const byId = categoriesCache?.find((c) => c.id === categoryId)
    if (byId) {
      categorySlug = byId.slug
      debug.resolvedCategorySlug = `${byId.slug} (matched by id)`
    } else {
      debug.resolvedCategorySlug = `NOT FOUND by id ${categoryId}`
      throw new Error(`Category with id "${categoryId}" not found`)
    }
  }

  if (!categorySlug) {
    throw new Error(`Post "${linkName}" is missing category field`)
  }

  // Get post slug
  const slug = frontmatter.slug

  if (!slug) {
    throw new Error(`Post "${linkName}" is missing slug field`)
  }

  return `${siteUrl}/posts/${categorySlug}/${slug}`
}

/**
 * Find a file by its name (with or without extension)
 */
function findFileByName(name: string, app: App): TFile | null {
  const files = app.vault.getMarkdownFiles()

  // Try exact match first (with .md extension)
  const exactMatch = files.find(
    (f) => f.basename === name || f.path === name || f.path === `${name}.md`,
  )

  if (exactMatch) {
    return exactMatch
  }

  // Try matching just the basename (case-insensitive)
  const lowerName = name.toLowerCase()
  return (
    files.find(
      (f) => f.basename.toLowerCase() === lowerName || f.name.toLowerCase() === `${lowerName}.md`,
    ) || null
  )
}

/**
 * Format backlink errors for display
 */
export function formatBacklinkErrors(errors: BacklinkError[]): string {
  if (errors.length === 0) return ''

  const lines = ['Backlink conversion errors:']
  for (const error of errors) {
    lines.push(`  • [[${error.link}]]: ${error.reason}`)
  }
  return lines.join('\n')
}
