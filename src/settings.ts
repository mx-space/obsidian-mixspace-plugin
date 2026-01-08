import { App, Notice, PluginSettingTab, Setting } from 'obsidian'
import type MixSpacePlugin from './main'
import { DEFAULT_PROFILE, getActiveProfile, type MixSpaceProfile } from './types'

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
      .setDesc('Test the API connection for current profile')
      .addButton((button) =>
        button.setButtonText('Test').onClick(async () => {
          button.setButtonText('Testing...')
          const success = await this.plugin.api.testConnection()
          if (success) {
            button.setButtonText('✓ Connected')
            setTimeout(() => button.setButtonText('Test'), 2000)
          } else {
            button.setButtonText('✗ Failed')
            setTimeout(() => button.setButtonText('Test'), 2000)
          }
        }),
      )

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
