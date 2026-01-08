import type { NoteFrontmatter } from '../types'

export interface ParsedContent {
  frontmatter: NoteFrontmatter
  body: string
}

/**
 * Parse YAML frontmatter from markdown content
 * Handles basic key: value pairs, booleans, numbers, and arrays
 */
export function parseFrontmatter(content: string): ParsedContent {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)

  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const [, yamlContent, body] = match
  const frontmatter: NoteFrontmatter = {}

  const lines = yamlContent.split('\n')
  let currentKey: string | null = null
  let currentArray: string[] | null = null

  for (const line of lines) {
    // Array item
    if (line.match(/^\s+-\s+/)) {
      if (currentKey && currentArray) {
        const value = line.replace(/^\s+-\s+/, '').trim()
        currentArray.push(value.replace(/^['"](.*)['"]$/, '$1'))
      }
      continue
    }

    // Save previous array if any
    if (currentKey && currentArray) {
      frontmatter[currentKey] = currentArray
      currentKey = null
      currentArray = null
    }

    // Key: value pair
    const keyValue = line.match(/^(\w+):\s*(.*)$/)
    if (keyValue) {
      const [, key, value] = keyValue
      if (value.trim() === '') {
        // Empty value might indicate start of array
        currentKey = key
        currentArray = []
      } else if (value === 'true' || value === 'false') {
        frontmatter[key] = value === 'true'
      } else if (!isNaN(Number(value)) && value.trim() !== '') {
        frontmatter[key] = Number(value)
      } else {
        frontmatter[key] = value.replace(/^['"](.*)['"]$/, '$1')
      }
    }
  }

  // Save last array if any
  if (currentKey && currentArray) {
    frontmatter[currentKey] = currentArray
  }

  return { frontmatter, body: body.trim() }
}
