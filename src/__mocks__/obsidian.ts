/* eslint-disable @typescript-eslint/no-explicit-any */
// Mock for obsidian module used in tests
import { vi } from 'vitest'

export class TFile {
  path: string
  basename: string
  name: string
  extension: string
  stat = { ctime: 0, mtime: 0, size: 0 }
  vault: any = null
  parent: any = null

  constructor(path: string) {
    this.path = path
    this.name = path.split('/').pop() || path
    this.basename = this.name.replace(/\.md$/, '')
    this.extension = 'md'
  }
}

export interface Vault {
  adapter: any
  configDir: string
  getName(): string
  getFileByPath(path: string): TFile | null
  getMarkdownFiles(): TFile[]
  read(file: TFile): Promise<string>
  [key: string]: any
}

export interface App {
  vault: Vault
  [key: string]: any
}

export interface RequestUrlResponse {
  status: number
  headers: Record<string, string>
  arrayBuffer: ArrayBuffer
  json: any
  text: string
}

// Export a mockable requestUrl function
export const requestUrl = vi.fn(
  (_options: {
    url: string
    method: string
    headers?: Record<string, string>
    body?: string
  }): Promise<RequestUrlResponse> => {
    return Promise.resolve({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      json: {},
      text: '',
    })
  },
)

export class Notice {
  constructor(_message: string, _timeout?: number) {}
}

export class Modal {
  app: App
  contentEl: HTMLElement = document.createElement('div')

  constructor(app: App) {
    this.app = app
  }

  open() {}
  close() {}
  onOpen() {}
  onClose() {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_name: string) {
    return this
  }
  setDesc(_desc: string) {
    return this
  }
  addText(_cb: (text: any) => void) {
    return this
  }
  addButton(_cb: (button: any) => void) {
    return this
  }
}

export class Plugin {
  app: App = {} as App
  manifest = {}

  async loadData() {
    return {}
  }
  async saveData(_data: any) {}
  addCommand(_command: any) {}
  addRibbonIcon(_icon: string, _title: string, _callback: () => void) {}
  addSettingTab(_tab: any) {}
  registerEditorSuggest(_suggest: any) {}
  registerEvent(_event: any) {}
}

export class PluginSettingTab {
  app: App
  plugin: Plugin
  containerEl: HTMLElement = document.createElement('div')

  constructor(app: App, plugin: Plugin) {
    this.app = app
    this.plugin = plugin
  }

  display() {}
  hide() {}
}

export class MarkdownView {
  file: TFile | null = null
  containerEl: HTMLElement = document.createElement('div')
}

export function setIcon(_el: HTMLElement, _icon: string) {}

export class Menu {
  addItem(_cb: (item: MenuItem) => void) {
    return this
  }
  addSeparator() {
    return this
  }
  showAtMouseEvent(_event: MouseEvent) {}
}

export class MenuItem {
  setTitle(_title: string) {
    return this
  }
  setIcon(_icon: string) {
    return this
  }
  onClick(_cb: () => void) {
    return this
  }
}
