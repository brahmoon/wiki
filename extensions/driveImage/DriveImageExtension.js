import { Extension } from 'https://esm.sh/@tiptap/core';
import { DriveImageHandler } from './DriveImageHandler.js';
import { ImageModal } from './ImageModal.js';

export const DriveImageExtension = Extension.create({
  name: 'driveImage',

  addOptions() {
    return {
      webAppUrl: '',
      maxFileSize: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      uploadTimeout: 30000,
      maxConcurrentUploads: 3,
      galleryTimeout: 15000,
      galleryCacheTimeout: 300000,
      recaptchaSiteKey: null,
      addToToolbar: true,
      toolbarButtonHTML: '🖼️',
      toolbarButtonTitle: '画像挿入',
      toolbarSelector: '.toolbar',
      buttonClass: 'toolbar-button',
      enablePasteUpload: true,
      enableDropUpload: true,
      debug: false
    };
  },

  addCommands() {
    return {
      openImageModal:
        () =>
        ({ editor }) => {
          if (this.options.debug) {
            console.log('Opening image modal with options:', this.options);
          }
          if (!this.options.webAppUrl) {
            DriveImageHandler.showMessage('WebApp URLが設定されていません。', 'error');
            return false;
          }
          if (!this.modal) {
            this.modal = new ImageModal(editor, this.options, DriveImageHandler);
          }
          this.modal.show();
          return true;
        },

      uploadImage:
        (file) =>
        ({ editor }) => {
          if (!file || !(file instanceof File)) {
            if (this.options.debug) {
              console.error('Invalid file provided to uploadImage command');
            }
            return false;
          }
          DriveImageHandler.uploadImage(file, editor, this.options);
          return true;
        },

      uploadMultipleImages:
        (files) =>
        ({ editor }) => {
          if (!Array.isArray(files) || files.length === 0) {
            if (this.options.debug) {
              console.error('Invalid files array provided to uploadMultipleImages command');
            }
            return false;
          }
          DriveImageHandler.uploadMultipleImages(files, editor, this.options);
          return true;
        },

      insertImageFromGallery:
        () =>
        ({ editor }) => {
          if (!this.modal) {
            this.modal = new ImageModal(editor, this.options, DriveImageHandler);
          }
          this.modal.show();
          this.modal.switchTab('gallery');
          return true;
        },

      clearImageCache:
        () =>
        () => {
          DriveImageHandler.clearCache();
          if (this.options.debug) {
            console.log('Image cache cleared');
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-i': () => this.editor.commands.openImageModal(),
      'Mod-Alt-i': () => this.editor.commands.insertImageFromGallery(),
    };
  },

  onCreate() {
    if (this.options.debug) {
      console.log('DriveImageExtension created with options:', this.options);
    }

    this.instanceId = `drive_ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.validateOptions();

    if (this.options.addToToolbar) {
      this.addToolbarButton();
    }
    if (this.options.enablePasteUpload || this.options.enableDropUpload) {
      this.setupEditorEvents();
    }
    this.ensureToolbarStyles();
  },

  onDestroy() {
    if (this.options.debug) {
      console.log(`DriveImageExtension destroyed (${this.instanceId})`);
    }
    if (this.modal) {
      this.modal.cleanup?.();
      this.modal = null;
    }
    if (this.toolbarButton && this.toolbarButton.parentNode) {
      this.toolbarButton.parentNode.removeChild(this.toolbarButton);
      this.toolbarButton = null;
    }
    this.removeEditorEvents();
  },

  // 🔽 validateOptions を Extension 内に組み込み
  validateOptions() {
    const errors = [];
    const warnings = [];

    if (!this.options.webAppUrl) {
      errors.push('webAppUrl is required');
    }
    if (this.options.webAppUrl && !/^https?:\/\//.test(this.options.webAppUrl)) {
      errors.push('webAppUrl must be a valid URL');
    }
    if (this.options.maxFileSize <= 0) {
      errors.push('maxFileSize must be greater than 0');
    }
    if (this.options.maxFileSize > 100 * 1024 * 1024) {
      warnings.push('maxFileSize が大きすぎます');
    }
    if (!Array.isArray(this.options.allowedMimeTypes) || this.options.allowedMimeTypes.length === 0) {
      errors.push('allowedMimeTypes must be a non-empty array');
    }

    if (errors.length > 0) {
      console.error('[DriveImageExtension] Invalid options:', errors);
    }
    if (warnings.length > 0) {
      console.warn('[DriveImageExtension] Option warnings:', warnings);
    }
  },
});
