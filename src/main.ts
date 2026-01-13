import { MarkdownView, Menu, Notice, Plugin, TFile, setIcon } from 'obsidian'
import { AIService } from './ai'
import { MixSpaceAPI } from './api'
import { CACHE_TTL, MOOD_OPTIONS, WEATHER_OPTIONS } from './constants'
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal'
import { DrySyncModal } from './modals/DrySyncModal'
import { MixSpaceSettingTab } from './settings'
import { FrontmatterSuggest } from './suggest'
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_SETTINGS,
  getActiveProfile,
  type Category,
  type MixSpaceSettings,
  type NoteFrontmatter,
  type Topic,
} from './types'
import { convertBacklinks, formatBacklinkErrors } from './utils/backlinks'
import { parseFrontmatter } from './utils/frontmatter'
import { buildNotePayload, buildPostPayload, detectContentType } from './utils/payload'

export default class MixSpacePlugin extends Plugin {
  settings: MixSpaceSettings = DEFAULT_SETTINGS
  api!: MixSpaceAPI
  aiService!: AIService

  // Cached metadata
  private categoriesCache: { data: Category[]; timestamp: number } | null = null
  private topicsCache: { data: Topic[]; timestamp: number } | null = null

  // Title bar button element
  private titleBarButton: HTMLElement | null = null

  async onload() {
    await this.loadSettings()

    const profile = getActiveProfile(this.settings)
    this.api = new MixSpaceAPI(profile)

    // Initialize AI service
    this.aiService = new AIService(this.settings.ai || DEFAULT_AI_SETTINGS)

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
    if (profile.apiEndpoint && profile.token) {
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

    this.addCommand({
      id: 'delete-from-mixspace',
      name: 'Delete current file from Mix Space',
      editorCallback: async () => {
        await this.deleteFromMixSpace()
      },
    })

    this.addCommand({
      id: 'unlink-from-mixspace',
      name: 'Unlink current file from Mix Space (keep remote)',
      editorCallback: async () => {
        await this.unlinkFromMixSpace()
      },
    })

    // AI Generation Commands
    this.addCommand({
      id: 'ai-generate-title',
      name: 'Generate Title with AI',
      editorCallback: async (_editor, view) => {
        await this.generateTitleWithAI(view.file)
      },
    })

    this.addCommand({
      id: 'ai-generate-slug',
      name: 'Generate Slug with AI',
      editorCallback: async (_editor, view) => {
        await this.generateSlugWithAI(view.file)
      },
    })

    this.addCommand({
      id: 'ai-generate-both',
      name: 'Generate Title and Slug with AI',
      editorCallback: async (_editor, view) => {
        await this.generateTitleWithAI(view.file)
        await this.generateSlugWithAI(view.file)
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
    const data = await this.loadData()
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data)

    // Migration: convert old flat settings to new profile-based settings
    if (data && !data.profiles && (data.apiEndpoint || data.token)) {
      this.settings = {
        profiles: [
          {
            id: 'default',
            name: 'Production',
            apiEndpoint: data.apiEndpoint || '',
            token: data.token || '',
            siteUrl: data.siteUrl || '',
          },
        ],
        activeProfileId: 'default',
        ai: DEFAULT_AI_SETTINGS,
      }
      await this.saveSettings()
    }

    // Ensure AI settings exist (migration from pre-AI versions)
    if (!this.settings.ai) {
      this.settings.ai = DEFAULT_AI_SETTINGS
      await this.saveSettings()
    }
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  /**
   * Called when the active profile changes
   * Updates the API client and clears caches
   */
  onProfileChange() {
    const profile = getActiveProfile(this.settings)
    this.api.updateProfile(profile)
    this.refreshMetadataCache()
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

    let buttonContainer = headerEl.parentElement?.querySelector(
      '.mixspace-title-button',
    ) as HTMLElement | null

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

      // Right-click context menu for management options
      button.addEventListener('contextmenu', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await this.showTitleBarMenu(e)
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

  private async showTitleBarMenu(event: MouseEvent) {
    const file = this.app.workspace.getActiveFile()
    if (!file) return

    const content = await this.app.vault.read(file)
    const { frontmatter } = parseFrontmatter(content)
    const isPublished = !!frontmatter.oid
    const contentType = detectContentType(frontmatter)

    const menu = new Menu()

    if (isPublished) {
      menu.addItem((item) =>
        item
          .setTitle(`Update ${contentType}`)
          .setIcon('refresh-cw')
          .onClick(async () => {
            await this.publishCurrent()
            this.updateTitleBarButton()
          }),
      )

      menu.addSeparator()

      menu.addItem((item) =>
        item
          .setTitle('Delete from Mix Space')
          .setIcon('trash-2')
          .onClick(async () => {
            await this.deleteFromMixSpace()
          }),
      )

      menu.addItem((item) =>
        item
          .setTitle('Unlink (keep remote)')
          .setIcon('unlink')
          .onClick(async () => {
            await this.unlinkFromMixSpace()
          }),
      )
    } else {
      menu.addItem((item) =>
        item
          .setTitle(`Publish ${contentType}`)
          .setIcon('upload-cloud')
          .onClick(async () => {
            await this.publishCurrent()
            this.updateTitleBarButton()
          }),
      )
    }

    menu.addSeparator()

    menu.addItem((item) =>
      item
        .setTitle('Dry Sync (Debug)')
        .setIcon('bug')
        .onClick(async () => {
          await this.drySync()
        }),
    )

    // AI generation options
    if (this.aiService.isConfigured()) {
      menu.addSeparator()

      menu.addItem((item) =>
        item
          .setTitle('Generate Title with AI')
          .setIcon('sparkles')
          .onClick(async () => {
            await this.generateTitleWithAI(file)
          }),
      )

      menu.addItem((item) =>
        item
          .setTitle('Generate Slug with AI')
          .setIcon('sparkles')
          .onClick(async () => {
            await this.generateSlugWithAI(file)
          }),
      )
    }

    menu.showAtMouseEvent(event)
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

    const profile = getActiveProfile(this.settings)
    if (!profile.apiEndpoint || !profile.token) {
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
        profile.siteUrl,
        this.app,
        this.api,
      )

      // If there are backlink conversion errors, stop and report
      if (backlinkErrors.length > 0) {
        const errorMsg = formatBacklinkErrors(backlinkErrors)
        console.error(errorMsg)
        new Notice(
          `Backlink conversion failed:\n${backlinkErrors.map((e) => `[[${e.link}]]: ${e.reason}`).join('\n')}`,
          10000,
        )
        return
      }

      if (contentType === 'note') {
        const payload = await buildNotePayload(frontmatter, convertedBody, file.basename, this.api)

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

    const profile = getActiveProfile(this.settings)

    try {
      const content = await this.app.vault.read(file)
      const { frontmatter, body } = parseFrontmatter(content)
      const contentType = detectContentType(frontmatter)
      const existingId = frontmatter.oid
      const isUpdate = !!existingId

      // Convert backlinks to URLs
      const {
        text: convertedBody,
        errors: backlinkErrors,
        debug: backlinkDebug,
      } = await convertBacklinks(body, profile.siteUrl, this.app, this.api)

      const payload =
        contentType === 'note'
          ? await buildNotePayload(frontmatter, convertedBody, file.basename, this.api)
          : await buildPostPayload(frontmatter, convertedBody, file.basename, this.api)

      const endpoint = isUpdate
        ? `${profile.apiEndpoint}/${contentType}s/${existingId}`
        : `${profile.apiEndpoint}/${contentType}s`

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

  // ===== Delete from Mix Space =====

  async deleteFromMixSpace() {
    const file = this.app.workspace.getActiveFile()
    if (!file) {
      new Notice('No active file')
      return
    }

    const profile = getActiveProfile(this.settings)
    if (!profile.apiEndpoint || !profile.token) {
      new Notice('Please configure API endpoint and token in settings')
      return
    }

    const content = await this.app.vault.read(file)
    const { frontmatter } = parseFrontmatter(content)

    if (!frontmatter.oid) {
      new Notice('This file is not linked to Mix Space')
      return
    }

    const contentType = detectContentType(frontmatter)

    new ConfirmDeleteModal(this.app, {
      title: file.basename,
      contentType,
      onConfirm: async () => {
        const id = frontmatter.oid
        if (!id) {
          new Notice('This file is not linked to Mix Space')
          return
        }
        try {
          if (contentType === 'note') {
            await this.api.deleteNote(id)
          } else {
            await this.api.deletePost(id)
          }

          // Clear Mix Space related frontmatter fields
          await this.clearMixSpaceFrontmatter(file)

          new Notice(`${contentType === 'note' ? 'Note' : 'Post'} deleted from Mix Space`)
          this.updateTitleBarButton()
        } catch (error) {
          console.error('Failed to delete:', error)
          new Notice(
            `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`,
          )
          throw error
        }
      },
    }).open()
  }

  // ===== Unlink from Mix Space =====

  async unlinkFromMixSpace() {
    const file = this.app.workspace.getActiveFile()
    if (!file) {
      new Notice('No active file')
      return
    }

    const content = await this.app.vault.read(file)
    const { frontmatter } = parseFrontmatter(content)

    if (!frontmatter.oid) {
      new Notice('This file is not linked to Mix Space')
      return
    }

    await this.clearMixSpaceFrontmatter(file)
    new Notice('File unlinked from Mix Space (remote content preserved)')
    this.updateTitleBarButton()
  }

  // ===== Clear Mix Space Frontmatter =====

  private async clearMixSpaceFrontmatter(file: TFile) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      // Remove Mix Space specific fields
      delete frontmatter.oid
      delete frontmatter.id
      delete frontmatter.slug
      delete frontmatter.categoryId
      delete frontmatter.updated
      // Keep 'type' field as it may be useful for future publishes
    })
  }

  // ===== AI Service =====

  updateAIService() {
    if (this.settings.ai) {
      this.aiService.updateSettings(this.settings.ai)
    }
  }

  async generateTitleWithAI(file: TFile | null) {
    if (!file) {
      new Notice('No active file')
      return
    }

    if (!this.aiService.isConfigured()) {
      new Notice('AI not configured. Please check settings.')
      return
    }

    try {
      new Notice('Generating title...')

      const content = await this.app.vault.read(file)
      const { frontmatter, body } = parseFrontmatter(content)
      const contentType = detectContentType(frontmatter)

      const result = await this.aiService.generateTitle({
        content: body,
        fileName: file.basename,
        existingTitle: frontmatter.title as string | undefined,
        contentType,
        frontmatter,
      })

      // Update frontmatter with generated title
      await this.updateFrontmatter(file, { title: result.value })

      new Notice(`Title generated: ${result.value}`)
      if (result.tokensUsed) {
        console.log(`[MixSpace AI] Tokens used: ${result.tokensUsed}`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      new Notice(`Failed to generate title: ${msg}`)
      console.error('[MixSpace AI]', error)
    }
  }

  async generateSlugWithAI(file: TFile | null) {
    if (!file) {
      new Notice('No active file')
      return
    }

    if (!this.aiService.isConfigured()) {
      new Notice('AI not configured. Please check settings.')
      return
    }

    try {
      new Notice('Generating slug...')

      const content = await this.app.vault.read(file)
      const { frontmatter, body } = parseFrontmatter(content)
      const contentType = detectContentType(frontmatter)

      const result = await this.aiService.generateSlug({
        content: body,
        fileName: file.basename,
        existingTitle: frontmatter.title as string | undefined,
        existingSlug: frontmatter.slug as string | undefined,
        contentType,
        frontmatter,
      })

      // Update frontmatter with generated slug
      await this.updateFrontmatter(file, { slug: result.value })

      new Notice(`Slug generated: ${result.value}`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      new Notice(`Failed to generate slug: ${msg}`)
      console.error('[MixSpace AI]', error)
    }
  }
}
