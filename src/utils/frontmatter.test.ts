import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from './frontmatter'

describe('parseFrontmatter', () => {
  describe('basic parsing', () => {
    it('should return empty frontmatter and full body when no frontmatter exists', () => {
      const content = 'This is just body content'
      const result = parseFrontmatter(content)

      expect(result.frontmatter).toEqual({})
      expect(result.body).toBe('This is just body content')
    })

    it('should parse simple key-value pairs', () => {
      const content = `---
title: My Title
slug: my-slug
---
Body content here`

      const result = parseFrontmatter(content)

      expect(result.frontmatter.title).toBe('My Title')
      expect(result.frontmatter.slug).toBe('my-slug')
      expect(result.body).toBe('Body content here')
    })

    it('should handle empty frontmatter with newline', () => {
      const content = `---

---
Body content`

      const result = parseFrontmatter(content)

      expect(result.frontmatter).toEqual({})
      expect(result.body).toBe('Body content')
    })

    it('should return full content as body when frontmatter is malformed', () => {
      // Frontmatter without internal newline doesn't match the regex
      const content = `---
---
Body content`

      const result = parseFrontmatter(content)

      // This is treated as no frontmatter since the regex doesn't match
      expect(result.body).toBe(content)
    })
  })

  describe('value types', () => {
    it('should parse boolean values', () => {
      const content = `---
bookmark: true
allowComment: false
---
Body`

      const result = parseFrontmatter(content)

      expect(result.frontmatter.bookmark).toBe(true)
      expect(result.frontmatter.allowComment).toBe(false)
    })

    it('should parse number values', () => {
      const content = `---
id: 123
nid: 456
---
Body`

      const result = parseFrontmatter(content)

      expect(result.frontmatter.id).toBe(123)
      expect(result.frontmatter.nid).toBe(456)
    })

    it('should parse quoted string values', () => {
      const content = `---
title: "Quoted Title"
slug: 'single-quoted'
---
Body`

      const result = parseFrontmatter(content)

      expect(result.frontmatter.title).toBe('Quoted Title')
      expect(result.frontmatter.slug).toBe('single-quoted')
    })

    it('should parse array values', () => {
      const content = `---
tags:
  - tag1
  - tag2
  - tag3
---
Body`

      const result = parseFrontmatter(content)

      expect(result.frontmatter.tags).toEqual(['tag1', 'tag2', 'tag3'])
    })

    it('should parse quoted array items', () => {
      const content = `---
tags:
  - "quoted tag"
  - 'single quoted'
---
Body`

      const result = parseFrontmatter(content)

      expect(result.frontmatter.tags).toEqual(['quoted tag', 'single quoted'])
    })
  })

  describe('edge cases', () => {
    it('should handle frontmatter with no trailing newline', () => {
      const content = `---
title: Test
---Body without newline`

      const result = parseFrontmatter(content)

      expect(result.frontmatter.title).toBe('Test')
      expect(result.body).toBe('Body without newline')
    })

    it('should trim body content', () => {
      const content = `---
title: Test
---

  Body with whitespace

`

      const result = parseFrontmatter(content)

      expect(result.body).toBe('Body with whitespace')
    })

    it('should handle complex markdown body', () => {
      const content = `---
title: Test
---
# Heading

This is a paragraph.

- List item 1
- List item 2

\`\`\`javascript
const code = 'example';
\`\`\``

      const result = parseFrontmatter(content)

      expect(result.frontmatter.title).toBe('Test')
      expect(result.body).toContain('# Heading')
      expect(result.body).toContain('- List item 1')
      expect(result.body).toContain("const code = 'example';")
    })

    it('should handle Mix Space specific fields', () => {
      const content = `---
title: My Note
oid: 507f1f77bcf86cd799439011
id: 42
type: note
mood: happy
weather: sunny
topicId: topic123
categories: technology
categoryId: cat456
---
Content`

      const result = parseFrontmatter(content)

      expect(result.frontmatter.oid).toBe('507f1f77bcf86cd799439011')
      expect(result.frontmatter.id).toBe(42)
      expect(result.frontmatter.type).toBe('note')
      expect(result.frontmatter.mood).toBe('happy')
      expect(result.frontmatter.weather).toBe('sunny')
      expect(result.frontmatter.topicId).toBe('topic123')
      expect(result.frontmatter.categories).toBe('technology')
      expect(result.frontmatter.categoryId).toBe('cat456')
    })

    it('should handle multiple arrays in frontmatter', () => {
      const content = `---
tags:
  - tag1
  - tag2
images:
  - image1.png
  - image2.jpg
---
Body`

      const result = parseFrontmatter(content)

      expect(result.frontmatter.tags).toEqual(['tag1', 'tag2'])
      expect(result.frontmatter.images).toEqual(['image1.png', 'image2.jpg'])
    })
  })
})
