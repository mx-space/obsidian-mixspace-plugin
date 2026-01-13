import { App, Notice, PluginSettingTab, Setting } from 'obsidian'
import type MixSpacePlugin from './main'
import {
  AI_MODELS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_BASE_URLS,
  DEFAULT_PROFILE,
  getActiveProfile,
  type AIProvider,
  type MixSpaceProfile,
} from './types'
import { fetchOpenAIModels, type OpenAIModel } from './ai'

export class MixSpaceSettingTab extends PluginSettingTab {
  plugin: MixSpacePlugin

  constructor(app: App, plugin: MixSpacePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Mix Space Publisher Settings' })

    // ===== Profile Section =====
    containerEl.createEl('h3', { text: 'Profile' })

    const activeProfile = getActiveProfile(this.plugin.settings)

    // Profile selector
    new Setting(containerEl)
      .setName('Active Profile')
      .setDesc('Switch between different environments (production, development, etc.)')
      .addDropdown((dropdown) => {
        for (const profile of this.plugin.settings.profiles) {
          dropdown.addOption(profile.id, profile.name)
        }
        dropdown.setValue(this.plugin.settings.activeProfileId)
        dropdown.onChange(async (value) => {
          this.plugin.settings.activeProfileId = value
          await this.plugin.saveSettings()
          this.plugin.onProfileChange()
          this.display() // Refresh UI
        })
      })
      .addExtraButton((button) => {
        button
          .setIcon('plus')
          .setTooltip('Add new profile')
          .onClick(async () => {
            await this.addNewProfile()
          })
      })
      .addExtraButton((button) => {
        button
          .setIcon('trash')
          .setTooltip('Delete current profile')
          .onClick(async () => {
            await this.deleteCurrentProfile()
          })
      })

    // Profile name
    new Setting(containerEl)
      .setName('Profile Name')
      .setDesc('A friendly name for this profile')
      .addText((text) =>
        text
          .setPlaceholder('Production')
          .setValue(activeProfile.name)
          .onChange(async (value) => {
            activeProfile.name = value
            await this.plugin.saveSettings()
          }),
      )

    // ===== API Settings =====
    containerEl.createEl('h3', { text: 'API Settings' })

    new Setting(containerEl)
      .setName('API Endpoint')
      .setDesc('Your Mix Space API endpoint (e.g., https://api.innei.in/v2)')
      .addText((text) =>
        text
          .setPlaceholder('https://api.example.com/v2')
          .setValue(activeProfile.apiEndpoint)
          .onChange(async (value) => {
            activeProfile.apiEndpoint = value
            await this.plugin.saveSettings()
            this.plugin.onProfileChange()
          }),
      )

    new Setting(containerEl)
      .setName('Bearer Token')
      .setDesc('Your Mix Space API token')
      .addText((text) => {
        text
          .setPlaceholder('Enter your token')
          .setValue(activeProfile.token)
          .onChange(async (value) => {
            activeProfile.token = value
            await this.plugin.saveSettings()
            this.plugin.onProfileChange()
          })
        text.inputEl.type = 'password'
      })

    new Setting(containerEl)
      .setName('Site URL')
      .setDesc('Your website URL for converting backlinks (e.g., https://innei.in)')
      .addText((text) =>
        text
          .setPlaceholder('https://example.com')
          .setValue(activeProfile.siteUrl)
          .onChange(async (value) => {
            activeProfile.siteUrl = value.replace(/\/$/, '') // Remove trailing slash
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Test the API connection and verify authentication')
      .addButton((button) =>
        button.setButtonText('Test').onClick(async () => {
          button.setButtonText('Testing...')
          const result = await this.plugin.api.testConnection()
          if (result.ok) {
            button.setButtonText('✓ Authenticated')
            new Notice('✓ Connection successful! You are authenticated.')
            setTimeout(() => button.setButtonText('Test'), 2000)
          } else if (result.isGuest) {
            button.setButtonText('✗ Invalid Token')
            new Notice(
              `✗ Authentication failed: Invalid or expired token.\n\nDebug info: ${result.debug || 'No additional details'}`,
              10000,
            )
            console.error('[MixSpace] Auth failed:', result.debug)
            setTimeout(() => button.setButtonText('Test'), 2000)
          } else {
            button.setButtonText('✗ Connection Failed')
            new Notice(
              `✗ Connection failed!\n\nEndpoint: ${activeProfile.apiEndpoint}\n\nError: ${result.debug || 'Unknown error'}\n\nPlease check:\n1. API endpoint is correct\n2. Network connection is available\n3. Server is running`,
              15000,
            )
            console.error('[MixSpace] Connection failed:', {
              endpoint: activeProfile.apiEndpoint,
              error: result.debug,
            })
            setTimeout(() => button.setButtonText('Test'), 2000)
          }
        }),
      )

    // ===== AI Settings =====
    this.renderAISettings(containerEl)

    // ===== Import/Export Section =====
    this.renderImportExportSettings(containerEl)

    // ===== Debug Section =====
    containerEl.createEl('h3', { text: 'Debug Information' })

    const debugContainer = containerEl.createDiv({ cls: 'mixspace-debug' })

    new Setting(containerEl)
      .setName('Fetch Debug Data')
      .setDesc('Fetch and display categories, topics from server')
      .addButton((button) =>
        button.setButtonText('Fetch').onClick(async () => {
          button.setButtonText('Fetching...')
          await this.renderDebugInfo(debugContainer)
          button.setButtonText('Fetch')
        }),
      )

    // Auto-fetch if already configured
    if (activeProfile.apiEndpoint && activeProfile.token) {
      this.renderDebugInfo(debugContainer)
    }
  }

  async addNewProfile(): Promise<void> {
    const id = `profile-${Date.now()}`
    const newProfile: MixSpaceProfile = {
      ...DEFAULT_PROFILE,
      id,
      name: `Profile ${this.plugin.settings.profiles.length + 1}`,
    }

    this.plugin.settings.profiles.push(newProfile)
    this.plugin.settings.activeProfileId = id
    await this.plugin.saveSettings()
    this.plugin.onProfileChange()
    this.display()

    new Notice('New profile created')
  }

  async deleteCurrentProfile(): Promise<void> {
    if (this.plugin.settings.profiles.length <= 1) {
      new Notice('Cannot delete the last profile')
      return
    }

    const currentId = this.plugin.settings.activeProfileId
    const currentName = getActiveProfile(this.plugin.settings).name

    this.plugin.settings.profiles = this.plugin.settings.profiles.filter((p) => p.id !== currentId)

    // Switch to first available profile
    this.plugin.settings.activeProfileId = this.plugin.settings.profiles[0].id
    await this.plugin.saveSettings()
    this.plugin.onProfileChange()
    this.display()

    new Notice(`Profile "${currentName}" deleted`)
  }

  // Cache for dynamically fetched OpenAI models
  private openAIModels: OpenAIModel[] = []

  renderAISettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'AI Settings' })
    containerEl.createEl('p', {
      text: 'Configure AI-powered title and slug generation.',
      cls: 'setting-item-description',
    })

    // Ensure ai settings exist (migration support)
    if (!this.plugin.settings.ai) {
      this.plugin.settings.ai = { ...DEFAULT_AI_SETTINGS }
    }

    const aiSettings = this.plugin.settings.ai

    // Enable AI toggle
    new Setting(containerEl)
      .setName('Enable AI Generation')
      .setDesc('Enable AI-powered title and slug generation')
      .addToggle((toggle) =>
        toggle.setValue(aiSettings.enabled).onChange(async (value) => {
          this.plugin.settings.ai.enabled = value
          await this.plugin.saveSettings()
          this.plugin.updateAIService()
          this.display()
        }),
      )

    // Only show remaining settings if AI is enabled
    if (!aiSettings.enabled) {
      return
    }

    // Provider selection
    new Setting(containerEl)
      .setName('AI Provider')
      .setDesc('Select your AI provider')
      .addDropdown((dropdown) => {
        dropdown.addOption('openai', 'OpenAI')
        dropdown.addOption('anthropic', 'Anthropic')
        dropdown.setValue(aiSettings.provider)
        dropdown.onChange(async (value: string) => {
          const provider = value as AIProvider
          this.plugin.settings.ai.provider = provider
          // Reset model to default for new provider
          this.plugin.settings.ai.model = AI_MODELS[provider][0].id
          // Reset baseUrl when switching providers
          this.plugin.settings.ai.baseUrl = ''
          // Clear cached OpenAI models
          this.openAIModels = []
          await this.plugin.saveSettings()
          this.plugin.updateAIService()
          this.display()
        })
      })

    // API Key (password field)
    const providerName = aiSettings.provider === 'openai' ? 'OpenAI' : 'Anthropic'
    new Setting(containerEl)
      .setName('API Key')
      .setDesc(`Enter your ${providerName} API key`)
      .addText((text) => {
        text
          .setPlaceholder(aiSettings.provider === 'openai' ? 'sk-...' : 'sk-ant-...')
          .setValue(aiSettings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.ai.apiKey = value
            await this.plugin.saveSettings()
            this.plugin.updateAIService()
          })
        text.inputEl.type = 'password'
      })

    // Base URL (optional, for custom endpoints)
    new Setting(containerEl)
      .setName('Base URL')
      .setDesc(
        `Custom API endpoint (leave empty for default: ${DEFAULT_BASE_URLS[aiSettings.provider]})`,
      )
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_BASE_URLS[aiSettings.provider])
          .setValue(aiSettings.baseUrl)
          .onChange(async (value) => {
            this.plugin.settings.ai.baseUrl = value
            await this.plugin.saveSettings()
            this.plugin.updateAIService()
          }),
      )

    // Model selection - different UI for OpenAI (with refresh) vs Anthropic (static)
    if (aiSettings.provider === 'openai') {
      this.renderOpenAIModelSelector(containerEl, aiSettings)
    } else {
      // Anthropic - static model list
      new Setting(containerEl)
        .setName('Model')
        .setDesc('Select the AI model to use')
        .addDropdown((dropdown) => {
          const models = AI_MODELS.anthropic
          for (const model of models) {
            dropdown.addOption(model.id, model.name)
          }
          dropdown.setValue(aiSettings.model)
          dropdown.onChange(async (value) => {
            this.plugin.settings.ai.model = value
            await this.plugin.saveSettings()
            this.plugin.updateAIService()
          })
        })
    }

    // Test AI Connection
    new Setting(containerEl)
      .setName('Test AI Connection')
      .setDesc('Test the AI configuration')
      .addButton((button) =>
        button.setButtonText('Test').onClick(async () => {
          if (!this.plugin.aiService?.isConfigured()) {
            new Notice('Please configure AI settings first')
            return
          }

          button.setButtonText('Testing...')
          button.setDisabled(true)

          try {
            const result = await this.plugin.aiService.generateTitle({
              content: 'This is a test content for AI connection verification.',
              fileName: 'test',
              contentType: 'note',
              frontmatter: {},
            })
            button.setButtonText('✓ Success')
            new Notice(`AI connection successful! Model: ${result.model}`)
          } catch (error) {
            button.setButtonText('✗ Failed')
            new Notice(
              `AI test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
          }

          setTimeout(() => {
            button.setButtonText('Test')
            button.setDisabled(false)
          }, 2000)
        }),
      )
  }

  private renderOpenAIModelSelector(
    containerEl: HTMLElement,
    aiSettings: typeof this.plugin.settings.ai,
  ): void {
    // Use cached models if available, otherwise use defaults
    const models = this.openAIModels.length > 0 ? this.openAIModels : AI_MODELS.openai

    const modelSetting = new Setting(containerEl)
      .setName('Model')
      .setDesc(
        'Select the AI model to use. Click refresh to fetch available models from your API endpoint.',
      )
      .addDropdown((dropdown) => {
        for (const model of models) {
          dropdown.addOption(model.id, model.name)
        }
        // If current model is not in list, add it
        if (!models.find((m) => m.id === aiSettings.model)) {
          dropdown.addOption(aiSettings.model, aiSettings.model)
        }
        dropdown.setValue(aiSettings.model)
        dropdown.onChange(async (value) => {
          this.plugin.settings.ai.model = value
          await this.plugin.saveSettings()
          this.plugin.updateAIService()
        })
      })
      .addExtraButton((button) => {
        button
          .setIcon('refresh-cw')
          .setTooltip('Fetch models from API')
          .onClick(async () => {
            if (!aiSettings.apiKey) {
              new Notice('Please enter your API key first')
              return
            }

            button.setDisabled(true)
            new Notice('Fetching models...')

            try {
              this.openAIModels = await fetchOpenAIModels(
                aiSettings.apiKey,
                aiSettings.baseUrl || undefined,
              )
              new Notice(`Found ${this.openAIModels.length} models`)
              this.display() // Refresh to show new models
            } catch (error) {
              new Notice(
                `Failed to fetch models: ${error instanceof Error ? error.message : 'Unknown error'}`,
              )
              button.setDisabled(false)
            }
          })
      })

    // Show hint if using cached models
    if (this.openAIModels.length > 0) {
      modelSetting.setDesc(
        `${this.openAIModels.length} models loaded from API. Click refresh to update.`,
      )
    }
  }

  renderImportExportSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Import / Export' })
    containerEl.createEl('p', {
      text: 'Backup or restore your plugin configuration.',
      cls: 'setting-item-description',
    })

    // Export settings
    new Setting(containerEl)
      .setName('Export Configuration')
      .setDesc('Download your settings as a JSON file')
      .addButton((button) =>
        button.setButtonText('Export').onClick(() => {
          this.exportSettings()
        }),
      )

    // Import settings
    new Setting(containerEl)
      .setName('Import Configuration')
      .setDesc('Load settings from a JSON file')
      .addButton((button) =>
        button.setButtonText('Import').onClick(() => {
          this.importSettings()
        }),
      )
  }

  private exportSettings(): void {
    try {
      // Create export data with metadata
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: this.plugin.settings,
      }

      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      // Create download link and trigger download
      const link = document.createElement('a')
      link.href = url
      link.download = `mixspace-settings-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      new Notice('Settings exported successfully')
    } catch (error) {
      new Notice(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private importSettings(): void {
    // Create file input element
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const importData = JSON.parse(text)

        // Validate import data
        if (!this.validateImportData(importData)) {
          new Notice('Invalid configuration file format')
          return
        }

        // Merge with defaults to ensure all fields exist
        const importedSettings = importData.settings

        // Validate and apply settings
        if (importedSettings.profiles && Array.isArray(importedSettings.profiles)) {
          this.plugin.settings.profiles = importedSettings.profiles
        }
        if (importedSettings.activeProfileId) {
          // Ensure activeProfileId exists in profiles
          const profileExists = this.plugin.settings.profiles.some(
            (p) => p.id === importedSettings.activeProfileId,
          )
          if (profileExists) {
            this.plugin.settings.activeProfileId = importedSettings.activeProfileId
          } else if (this.plugin.settings.profiles.length > 0) {
            this.plugin.settings.activeProfileId = this.plugin.settings.profiles[0].id
          }
        }
        if (importedSettings.ai) {
          this.plugin.settings.ai = {
            ...this.plugin.settings.ai,
            ...importedSettings.ai,
          }
        }

        await this.plugin.saveSettings()
        this.plugin.onProfileChange()
        this.plugin.updateAIService()
        this.display() // Refresh UI

        new Notice('Settings imported successfully')
      } catch (error) {
        if (error instanceof SyntaxError) {
          new Notice('Invalid JSON file')
        } else {
          new Notice(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    input.click()
  }

  private validateImportData(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false

    const obj = data as Record<string, unknown>

    // Check for required fields
    if (typeof obj.version !== 'number') return false
    if (!obj.settings || typeof obj.settings !== 'object') return false

    const settings = obj.settings as Record<string, unknown>

    // Validate profiles array if present
    if (settings.profiles !== undefined) {
      if (!Array.isArray(settings.profiles)) return false
      for (const profile of settings.profiles) {
        if (!profile || typeof profile !== 'object') return false
        const p = profile as Record<string, unknown>
        if (typeof p.id !== 'string' || typeof p.name !== 'string') return false
      }
    }

    return true
  }

  async renderDebugInfo(container: HTMLElement): Promise<void> {
    container.empty()

    const activeProfile = getActiveProfile(this.plugin.settings)

    // Show current profile info
    const profileInfo = container.createDiv({ cls: 'debug-section' })
    profileInfo.createEl('h4', { text: 'Current Profile' })
    profileInfo.createEl('p', { text: `Name: ${activeProfile.name}` })
    profileInfo.createEl('p', { text: `Endpoint: ${activeProfile.apiEndpoint || '(not set)'}` })
    profileInfo.createEl('p', { text: `Site URL: ${activeProfile.siteUrl || '(not set)'}` })

    if (!activeProfile.apiEndpoint || !activeProfile.token) {
      container.createEl('p', {
        text: 'Please configure API endpoint and token first',
        cls: 'debug-empty',
      })
      return
    }

    try {
      // Fetch data
      const [categories, topics] = await Promise.all([
        this.plugin.api.getCategories(),
        this.plugin.api.getTopics(),
      ])

      // Categories
      const catSection = container.createDiv({ cls: 'debug-section' })
      catSection.createEl('h4', { text: `Categories (${categories.length})` })

      if (categories.length > 0) {
        const catList = catSection.createEl('ul')
        for (const cat of categories) {
          catList.createEl('li', {
            text: `${cat.name} (slug: ${cat.slug}, id: ${cat.id})`,
          })
        }
      } else {
        catSection.createEl('p', {
          text: 'No categories found',
          cls: 'debug-empty',
        })
      }

      // Topics
      const topicSection = container.createDiv({ cls: 'debug-section' })
      topicSection.createEl('h4', { text: `Topics (${topics.length})` })

      if (topics.length > 0) {
        const topicList = topicSection.createEl('ul')
        for (const topic of topics) {
          topicList.createEl('li', {
            text: `${topic.name} (slug: ${topic.slug}, id: ${topic.id})`,
          })
        }
      } else {
        topicSection.createEl('p', {
          text: 'No topics found',
          cls: 'debug-empty',
        })
      }

      // Predefined options
      const predefSection = container.createDiv({ cls: 'debug-section' })
      predefSection.createEl('h4', { text: 'Predefined Options' })

      const moodP = predefSection.createEl('p')
      moodP.createEl('strong', { text: 'Moods: ' })
      moodP.createSpan({ text: this.plugin.getMoods().filter(Boolean).join(', ') })

      const weatherP = predefSection.createEl('p')
      weatherP.createEl('strong', { text: 'Weather: ' })
      weatherP.createSpan({
        text: this.plugin.getWeathers().filter(Boolean).join(', '),
      })

      // Cache status
      const cacheSection = container.createDiv({ cls: 'debug-section' })
      cacheSection.createEl('h4', { text: 'Cache Status' })
      cacheSection.createEl('p', {
        text: `Categories cached: ${categories.length} items`,
      })
      cacheSection.createEl('p', {
        text: `Topics cached: ${topics.length} items`,
      })
    } catch (error) {
      container.createEl('p', {
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cls: 'debug-error',
      })
    }
  }
}
