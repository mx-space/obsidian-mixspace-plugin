import { App, PluginSettingTab, Setting } from 'obsidian'
import type MixSpacePlugin from './main'

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

    new Setting(containerEl)
      .setName('API Endpoint')
      .setDesc('Your Mix Space API endpoint (e.g., https://api.innei.in/v2)')
      .addText((text) =>
        text
          .setPlaceholder('https://api.example.com/v2')
          .setValue(this.plugin.settings.apiEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.apiEndpoint = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Bearer Token')
      .setDesc('Your Mix Space API token')
      .addText((text) => {
        text
          .setPlaceholder('Enter your token')
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value
            await this.plugin.saveSettings()
          })
        text.inputEl.type = 'password'
      })

    new Setting(containerEl)
      .setName('Site URL')
      .setDesc('Your website URL for converting backlinks (e.g., https://innei.in)')
      .addText((text) =>
        text
          .setPlaceholder('https://example.com')
          .setValue(this.plugin.settings.siteUrl)
          .onChange(async (value) => {
            this.plugin.settings.siteUrl = value.replace(/\/$/, '') // Remove trailing slash
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Test the API connection')
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

    // Debug Section
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
    if (this.plugin.settings.apiEndpoint && this.plugin.settings.token) {
      this.renderDebugInfo(debugContainer)
    }
  }

  async renderDebugInfo(container: HTMLElement): Promise<void> {
    container.empty()

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
