import { MarkdownView, Notice, Plugin, TFile, setIcon } from 'obsidian'
import { MixSpaceAPI } from './api'
import { CACHE_TTL, MOOD_OPTIONS, WEATHER_OPTIONS } from './constants'
import { DrySyncModal } from './modals/DrySyncModal'
import { MixSpaceSettingTab } from './settings'
import { FrontmatterSuggest } from './suggest'
import { DEFAULT_SETTINGS, type Category, type MixSpaceSettings, type NoteFrontmatter, type Topic } from './types'
import { convertBacklinks, formatBacklinkErrors } from './utils/backlinks'
import { parseFrontmatter } from './utils/frontmatter'
import { buildNotePayload, buildPostPayload, detectContentType } from './utils/payload'

export default class MixSpacePlugin extends Plugin {
  settings: MixSpaceSettings = DEFAULT_SETTINGS
  api!: MixSpaceAPI

  // Cached metadata
  private categoriesCache: { data: Category[]; timestamp: number } | null = null
  private topicsCache: { data: Topic[]; timestamp: number } | null = null

  // Title bar button element
  private titleBarButton: HTMLElement | null = null

  async onload() {
    await this.loadSettings()
    this.api = new MixSpaceAPI(this.settings)

    // Register frontmatter suggest
    this.registerEditorSuggest(new FrontmatterSuggest(this))

    // Add ribbon icon
    this.addRibbonIcon('upload-cloud', 'Publish to Mix Space', async () => {
      await this.publishCurrent()
    })

    // Add commands
    this.registerCommands()

    // Add settings tab
    this.addSettingTab(new MixSpaceSettingTab(this.app, this))

    // Register title bar button events
    this.registerTitleBarEvents()

    // Pre-fetch metadata on load
    if (this.settings.apiEndpoint && this.settings.token) {
      this.refreshMetadataCache()
    }
  }

  onunload() {
    this.removeTitleBarButton()
  }

  private registerCommands() {
    this.addCommand({
      id: 'publish',
      name: 'Publish current file to Mix Space',
      editorCallback: async () => {
        await this.publishCurrent()
      },
    })

    this.addCommand({
      id: 'refresh-metadata',
      name: 'Refresh Mix Space metadata cache',
      callback: async () => {
        await this.refreshMetadataCache()
        new Notice('Metadata cache refreshed')
      },
    })

    this.addCommand({
      id: 'dry-sync',
      name: 'Dry Sync - Preview publish payload (Debug)',
      editorCallback: async () => {
        await this.drySync()
      },
    })
  }

  private registerTitleBarEvents() {
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.updateTitleBarButton()
      }),
    )

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        const activeFile = this.app.workspace.getActiveFile()
        if (activeFile && file.path === activeFile.path) {
          this.updateTitleBarButton()
        }
      }),
    )

    this.app.workspace.onLayoutReady(() => {
      this.updateTitleBarButton()
    })
  }

  // ===== Settings =====

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
    this.api = new MixSpaceAPI(this.settings)
  }

  // ===== Title Bar Button =====

  private async updateTitleBarButton() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    if (!view) {
      this.removeTitleBarButton()
      return
    }

    const file = view.file
    if (!file) {
      this.removeTitleBarButton()
      return
    }

    const headerEl = view.containerEl.querySelector('.view-header-title-container')
    if (!headerEl) return

    let buttonContainer = headerEl.parentElement?.querySelector('.mixspace-title-button') as HTMLElement | null

    if (!buttonContainer) {
      buttonContainer = createEl('div', { cls: 'mixspace-title-button' })

      const button = buttonContainer.createEl('button', {
        cls: 'clickable-icon view-action',
        attr: { 'aria-label': 'Publish to Mix Space' },
      })

      button.addEventListener('click', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await this.publishCurrent()
        this.updateTitleBarButton()
      })

      headerEl.parentElement?.insertBefore(buttonContainer, headerEl.nextSibling)
      this.titleBarButton = buttonContainer
    }

    const button = buttonContainer.querySelector('button')
    if (button) {
      const content = await this.app.vault.read(file)
      const { frontmatter } = parseFrontmatter(content)
      const isPublished = !!frontmatter.oid
      const contentType = detectContentType(frontmatter)

      button.empty()
      if (isPublished) {
        setIcon(button, 'refresh-cw')
        button.setAttribute('aria-label', `Update ${contentType} on Mix Space`)
        button.classList.add('is-published')
      } else {
        setIcon(button, 'upload-cloud')
        button.setAttribute('aria-label', `Publish ${contentType} to Mix Space`)
        button.classList.remove('is-published')
      }
    }
  }

  private removeTitleBarButton() {
    if (this.titleBarButton) {
      this.titleBarButton.remove()
      this.titleBarButton = null
    }
  }

  // ===== Metadata Cache =====

  async getCategories(): Promise<Category[]> {
    const now = Date.now()
    if (this.categoriesCache && now - this.categoriesCache.timestamp < CACHE_TTL) {
      return this.categoriesCache.data
    }

    const categories = await this.api.getCategories()
    this.categoriesCache = { data: categories, timestamp: now }
    return categories
  }

  async getTopics(): Promise<Topic[]> {
    const now = Date.now()
    if (this.topicsCache && now - this.topicsCache.timestamp < CACHE_TTL) {
      return this.topicsCache.data
    }

    const topics = await this.api.getTopics()
    this.topicsCache = { data: topics, timestamp: now }
    return topics
  }

  getMoods(): string[] {
    return MOOD_OPTIONS
  }

  getWeathers(): string[] {
    return WEATHER_OPTIONS
  }

  async refreshMetadataCache() {
    this.categoriesCache = null
    this.topicsCache = null
    await Promise.all([this.getCategories(), this.getTopics()])
  }

  // ===== Publish =====

  async publishCurrent() {
    const file = this.app.workspace.getActiveFile()
    if (!file) {
      new Notice('No active file')
      return
    }

    if (!this.settings.apiEndpoint || !this.settings.token) {
      new Notice('Please configure API endpoint and token in settings')
      return
    }

    try {
      const content = await this.app.vault.read(file)
      const { frontmatter, body } = parseFrontmatter(content)
      const contentType = detectContentType(frontmatter)
      const existingId = frontmatter.oid
      const isUpdate = !!existingId

      // Convert backlinks to URLs
      const { text: convertedBody, errors: backlinkErrors } = await convertBacklinks(
        body,
        this.settings.siteUrl,
        this.app,
        this.api,
      )

      // If there are backlink conversion errors, stop and report
      if (backlinkErrors.length > 0) {
        const errorMsg = formatBacklinkErrors(backlinkErrors)
        console.error(errorMsg)
        new Notice(`Backlink conversion failed:\n${backlinkErrors.map((e) => `[[${e.link}]]: ${e.reason}`).join('\n')}`, 10000)
        return
      }

      if (contentType === 'note') {
        const payload = buildNotePayload(frontmatter, convertedBody, file.basename)

        new Notice(isUpdate ? 'Updating note...' : 'Creating note...')
        const response = isUpdate
          ? await this.api.updateNote(existingId, payload)
          : await this.api.createNote(payload)

        await this.updateFrontmatter(file, {
          oid: response.id,
          id: response.nid,
          updated: new Date().toISOString(),
          type: 'note',
        })

        new Notice(`Note ${isUpdate ? 'updated' : 'created'}: ${response.title}`)
      } else {
        const payload = await buildPostPayload(frontmatter, convertedBody, file.basename, this.api)

        new Notice(isUpdate ? 'Updating post...' : 'Creating post...')
        const response = isUpdate
          ? await this.api.updatePost(existingId, payload)
          : await this.api.createPost(payload)

        await this.updateFrontmatter(file, {
          oid: response.id,
          slug: response.slug,
          categoryId: response.categoryId,
          updated: new Date().toISOString(),
          type: 'post',
        })

        new Notice(`Post ${isUpdate ? 'updated' : 'created'}: ${response.title}`)
      }
    } catch (error) {
      console.error('Failed to publish:', error)
      new Notice(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ===== Dry Sync =====

  async drySync() {
    const file = this.app.workspace.getActiveFile()
    if (!file) {
      new Notice('No active file')
      return
    }

    try {
      const content = await this.app.vault.read(file)
      const { frontmatter, body } = parseFrontmatter(content)
      const contentType = detectContentType(frontmatter)
      const existingId = frontmatter.oid
      const isUpdate = !!existingId

      // Convert backlinks to URLs
      const { text: convertedBody, errors: backlinkErrors, debug: backlinkDebug } = await convertBacklinks(
        body,
        this.settings.siteUrl,
        this.app,
        this.api,
      )

      const payload =
        contentType === 'note'
          ? buildNotePayload(frontmatter, convertedBody, file.basename)
          : await buildPostPayload(frontmatter, convertedBody, file.basename, this.api)

      const endpoint = isUpdate
        ? `${this.settings.apiEndpoint}/${contentType}s/${existingId}`
        : `${this.settings.apiEndpoint}/${contentType}s`

      new DrySyncModal(this.app, {
        file: file.path,
        contentType,
        action: isUpdate ? 'UPDATE' : 'CREATE',
        endpoint,
        method: isUpdate ? 'PUT' : 'POST',
        frontmatter,
        payload,
        bodyPreview: convertedBody.slice(0, 500) + (convertedBody.length > 500 ? '...' : ''),
        bodyLength: convertedBody.length,
        backlinkErrors,
        backlinkDebug,
      }).open()
    } catch (error) {
      new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ===== Frontmatter =====

  async updateFrontmatter(file: TFile, updates: Partial<NoteFrontmatter>) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      Object.assign(frontmatter, updates)
    })
  }
}
