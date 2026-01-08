import {
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from 'obsidian'
import type MixSpacePlugin from './main'

interface SuggestionItem {
  label: string
  value: string
}

// Fields that support autocompletion
const SUGGEST_FIELDS = ['categories', 'mood', 'weather', 'topicId'] as const
type SuggestField = (typeof SUGGEST_FIELDS)[number]

export class FrontmatterSuggest extends EditorSuggest<SuggestionItem> {
  plugin: MixSpacePlugin

  constructor(plugin: MixSpacePlugin) {
    super(plugin.app)
    this.plugin = plugin
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile | null,
  ): EditorSuggestTriggerInfo | null {
    // Only trigger in frontmatter (between --- lines)
    const content = editor.getValue()
    const cursorOffset = editor.posToOffset(cursor)

    // Find frontmatter boundaries
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) return null

    const frontmatterEnd = frontmatterMatch[0].length
    if (cursorOffset > frontmatterEnd) return null

    // Get current line
    const line = editor.getLine(cursor.line)

    // Check if we're after a field name and colon
    for (const field of SUGGEST_FIELDS) {
      const pattern = new RegExp(`^${field}:\\s*(.*)$`)
      const match = line.match(pattern)

      if (match) {
        const valueStart = line.indexOf(':') + 1
        const query = match[1].trim()

        return {
          start: { line: cursor.line, ch: valueStart + 1 },
          end: cursor,
          query: `${field}:${query}`,
        }
      }
    }

    return null
  }

  async getSuggestions(context: EditorSuggestContext): Promise<SuggestionItem[]> {
    const [field, query] = context.query.split(':') as [SuggestField, string]
    const lowerQuery = query.toLowerCase()

    let items: SuggestionItem[] = []

    switch (field) {
      case 'categories': {
        const categories = await this.plugin.getCategories()
        items = categories.map((c) => ({ label: c.name, value: c.slug }))
        break
      }

      case 'topicId': {
        const topics = await this.plugin.getTopics()
        items = topics.map((t) => ({ label: t.name, value: t.id }))
        break
      }

      case 'mood':
        items = this.plugin.getMoods().map((m) => ({ label: m, value: m }))
        break

      case 'weather':
        items = this.plugin.getWeathers().map((w) => ({ label: w, value: w }))
        break
    }

    // Filter by query
    if (lowerQuery) {
      items = items.filter((item) => item.label.toLowerCase().includes(lowerQuery))
    }

    return items
  }

  renderSuggestion(item: SuggestionItem, el: HTMLElement): void {
    el.createEl('div', { cls: 'suggestion-content', text: item.label })
    if (item.label !== item.value) {
      el.createEl('small', { cls: 'suggestion-note', text: item.value })
    }
  }

  selectSuggestion(item: SuggestionItem, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return

    const { editor, start, end } = this.context
    editor.replaceRange(item.value, start, end)
  }
}
