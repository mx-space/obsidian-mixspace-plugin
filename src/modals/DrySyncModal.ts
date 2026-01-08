import { App, Modal, Notice } from 'obsidian'
import type { BacklinkDebugInfo, BacklinkError } from '../utils/backlinks'
import type {
  ContentType,
  NoteFrontmatter,
  NotePayload,
  PostPayload,
} from '../types'

export interface DrySyncData {
  file: string
  contentType: ContentType
  action: 'CREATE' | 'UPDATE'
  endpoint: string
  method: string
  frontmatter: NoteFrontmatter
  payload: NotePayload | PostPayload
  bodyPreview: string
  bodyLength: number
  backlinkErrors?: BacklinkError[]
  backlinkDebug?: BacklinkDebugInfo
}

export class DrySyncModal extends Modal {
  private data: DrySyncData

  constructor(app: App, data: DrySyncData) {
    super(app)
    this.data = data
  }

  onOpen() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass('mixspace-dry-sync-modal')

    contentEl.createEl('h2', {
      text: `Dry Sync - ${this.data.action} ${this.data.contentType.toUpperCase()}`,
    })

    // Backlink Debug Info
    if (this.data.backlinkDebug) {
      const debug = this.data.backlinkDebug

      // Categories loaded
      const catSection = contentEl.createDiv({ cls: 'dry-sync-section' })
      catSection.createEl('h4', { text: `Categories from API (${debug.categoriesLoaded})` })
      if (debug.categories.length > 0) {
        const catPre = catSection.createEl('pre')
        catPre.createEl('code', {
          text: debug.categories.map((c) => `${c.name} → ${c.slug} (${c.id})`).join('\n'),
        })
      } else {
        catSection.createEl('p', { text: 'No categories loaded!', cls: 'debug-error' })
      }

      // Conversions
      if (debug.conversions.length > 0) {
        const convSection = contentEl.createDiv({ cls: 'dry-sync-section' })
        convSection.createEl('h4', { text: `Backlink Conversions (${debug.conversions.length})` })
        for (const conv of debug.conversions) {
          const convDiv = convSection.createDiv({ cls: 'debug-conversion' })
          convDiv.createEl('strong', { text: `[[${conv.link}]]` })
          const details = convDiv.createEl('ul')
          details.createEl('li', { text: `File: ${conv.file || 'NOT FOUND'}` })
          details.createEl('li', { text: `Type: ${conv.contentType || 'unknown'}` })
          if (conv.categoryValue) {
            details.createEl('li', { text: `Category value: "${conv.categoryValue}"` })
          }
          if (conv.resolvedCategorySlug) {
            details.createEl('li', { text: `Resolved: ${conv.resolvedCategorySlug}` })
          }
          if (conv.finalUrl) {
            details.createEl('li', { text: `URL: ${conv.finalUrl}` })
          }
          if (conv.error) {
            details.createEl('li', { text: `Error: ${conv.error}`, cls: 'debug-error' })
          }
        }
      }
    }

    // Backlink errors (show at top if any)
    if (this.data.backlinkErrors && this.data.backlinkErrors.length > 0) {
      const errorSection = contentEl.createDiv({ cls: 'dry-sync-section dry-sync-errors' })
      errorSection.createEl('h4', {
        text: `Backlink Errors (${this.data.backlinkErrors.length})`,
        cls: 'debug-error',
      })
      const errorList = errorSection.createEl('ul')
      for (const error of this.data.backlinkErrors) {
        const li = errorList.createEl('li')
        li.createEl('code', { text: `[[${error.link}]]` })
        li.createSpan({ text: `: ${error.reason}` })
      }
      errorSection.createEl('p', {
        text: 'Publishing will be blocked until these errors are fixed.',
        cls: 'debug-error',
      })
    }

    // File info
    const fileSection = contentEl.createDiv({ cls: 'dry-sync-section' })
    fileSection.createEl('h4', { text: 'File' })
    fileSection.createEl('code', { text: this.data.file })

    // Content type
    const typeSection = contentEl.createDiv({ cls: 'dry-sync-section' })
    typeSection.createEl('h4', { text: 'Content Type' })
    typeSection.createEl('code', { text: this.data.contentType })

    // Request info
    const requestSection = contentEl.createDiv({ cls: 'dry-sync-section' })
    requestSection.createEl('h4', { text: 'Request' })
    const requestInfo = requestSection.createEl('pre')
    requestInfo.createEl('code', {
      text: `${this.data.method} ${this.data.endpoint}`,
    })

    // Frontmatter
    const fmSection = contentEl.createDiv({ cls: 'dry-sync-section' })
    fmSection.createEl('h4', { text: 'Frontmatter (parsed)' })
    const fmPre = fmSection.createEl('pre')
    fmPre.createEl('code', {
      text: JSON.stringify(this.data.frontmatter, null, 2),
    })

    // Payload
    const payloadSection = contentEl.createDiv({ cls: 'dry-sync-section' })
    payloadSection.createEl('h4', { text: 'Payload (will be sent)' })
    const payloadPre = payloadSection.createEl('pre')

    const payloadDisplay = { ...this.data.payload } as Record<string, unknown>
    payloadDisplay.text = `[${this.data.bodyLength} chars]`

    payloadPre.createEl('code', {
      text: JSON.stringify(payloadDisplay, null, 2),
    })

    // Body preview
    const bodySection = contentEl.createDiv({ cls: 'dry-sync-section' })
    bodySection.createEl('h4', {
      text: `Body Preview (${this.data.bodyLength} chars)`,
    })
    const bodyPre = bodySection.createEl('pre', { cls: 'body-preview' })
    bodyPre.createEl('code', { text: this.data.bodyPreview })

    // Actions
    const actionsSection = contentEl.createDiv({ cls: 'dry-sync-actions' })

    const copyBtn = actionsSection.createEl('button', { text: 'Copy Payload' })
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(this.data.payload, null, 2))
      new Notice('Payload copied to clipboard')
    })

    const closeBtn = actionsSection.createEl('button', {
      text: 'Close',
      cls: 'mod-cta',
    })
    closeBtn.addEventListener('click', () => this.close())
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}
