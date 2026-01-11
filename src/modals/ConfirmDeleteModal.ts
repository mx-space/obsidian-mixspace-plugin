import { Modal, App, Setting } from 'obsidian'

export interface ConfirmDeleteOptions {
  title: string
  contentType: 'note' | 'post'
  onConfirm: () => Promise<void>
}

export class ConfirmDeleteModal extends Modal {
  private options: ConfirmDeleteOptions
  private isDeleting = false

  constructor(app: App, options: ConfirmDeleteOptions) {
    super(app)
    this.options = options
  }

  onOpen() {
    const { contentEl, titleEl } = this
    contentEl.empty()
    contentEl.addClass('mixspace-confirm-delete-modal')

    // Use Obsidian's modal title element for proper alignment with close button
    titleEl.setText('Delete from Mix Space')
    titleEl.addClass('mixspace-delete-title')

    contentEl.createEl('p', {
      text: `Are you sure you want to delete "${this.options.title}" from Mix Space?`,
      cls: 'mixspace-confirm-message',
    })

    contentEl.createEl('p', {
      text: `This will delete the ${this.options.contentType} from Mix Space server. The local file will remain unchanged.`,
      cls: 'mixspace-confirm-note',
    })

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText('Cancel').onClick(() => {
          this.close()
        }),
      )
      .addButton((btn) =>
        btn
          .setButtonText('Delete')
          .setWarning()
          .onClick(async () => {
            if (this.isDeleting) return
            this.isDeleting = true
            btn.setDisabled(true)
            btn.setButtonText('Deleting...')

            try {
              await this.options.onConfirm()
              this.close()
            } catch (error) {
              this.isDeleting = false
              btn.setDisabled(false)
              btn.setButtonText('Delete')
              throw error
            }
          }),
      )
  }

  onClose() {
    const { contentEl } = this
    contentEl.empty()
  }
}
