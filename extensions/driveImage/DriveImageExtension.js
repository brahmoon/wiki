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
      debug: false,
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

    // ✅ 内部関数: validateOptions
    const validateOptions = (options) => {
      const errors = [];
      const warnings = [];

      if (!options.webAppUrl) {
        errors.push('webAppUrl is required');
      }
      if (options.webAppUrl && !/^https?:\/\//.test(options.webAppUrl)) {
        errors.push('webAppUrl must be a valid URL');
      }
      if (options.maxFileSize <= 0) {
        errors.push('maxFileSize must be greater than 0');
      }
      if (options.maxFileSize > 100 * 1024 * 1024) {
        warnings.push('maxFileSize が大きすぎます');
      }
      if (!Array.isArray(options.allowedMimeTypes) || options.allowedMimeTypes.length === 0) {
        errors.push('allowedMimeTypes must be a non-empty array');
      }

      if (errors.length > 0) {
        console.error('[DriveImageExtension] Invalid options:', errors);
      }
      if (warnings.length > 0) {
        console.warn('[DriveImageExtension] Option warnings:', warnings);
      }
    };

    // ✅ 内部関数: addToolbarButton
    const addToolbarButton = () => {
      const toolbar = document.querySelector(this.options.toolbarSelector);
      if (!toolbar) return;

      const btn = document.createElement('button');
      btn.className = this.options.buttonClass;
      btn.innerHTML = this.options.toolbarButtonHTML;
      btn.title = this.options.toolbarButtonTitle;
      btn.type = 'button';

      btn.addEventListener('click', () => {
        this.editor.commands.openImageModal();
      });

      toolbar.appendChild(btn);
      this.toolbarButton = btn;
    };

    // ✅ 内部関数: setupEditorEvents
    const setupEditorEvents = () => {
      const editorElement = this.editor.view.dom;
      if (this.options.enablePasteUpload) {
        editorElement.addEventListener('paste', (e) => {
          const items = Array.from(e.clipboardData?.items || []);
          const imageItems = items.filter((i) => i.type.startsWith('image/'));
          if (imageItems.length) {
            e.preventDefault();
            const files = imageItems.map((i) => i.getAsFile()).filter(Boolean);
            DriveImageHandler.uploadMultipleImages(files, this.editor, this.options);
          }
        });
      }
      if (this.options.enableDropUpload) {
        editorElement.addEventListener('drop', (e) => {
          const files = Array.from(e.dataTransfer?.files || []);
          const imageFiles = files.filter((f) => this.options.allowedMimeTypes.includes(f.type));
          if (imageFiles.length) {
            e.preventDefault();
            DriveImageHandler.uploadMultipleImages(imageFiles, this.editor, this.options);
          }
        });
      }
    };

    // ✅ 内部関数: ensureToolbarStyles
    const ensureToolbarStyles = () => {
      const styleId = 'drive-image-toolbar-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .toolbar-button {
          background: none;
          border: 1px solid transparent;
          border-radius: 4px;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 16px;
          color: #495057;
          transition: all 0.2s;
        }
        .toolbar-button:hover {
          background: #f8f9fa;
          border-color: #dee2e6;
        }
        .toolbar-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `;
      document.head.appendChild(style);
    };

    // ---- 実行部分 ----
    validateOptions(this.options);
    if (this.options.addToToolbar) addToolbarButton();
    if (this.options.enablePasteUpload || this.options.enableDropUpload) setupEditorEvents();
    ensureToolbarStyles();
  },

  onDestroy() {
    if (this.options.debug) {
      console.log(`DriveImageExtension destroyed (${this.instanceId})`);
    }
    if (this.modal?.destroy) {
      this.modal.destroy();
      this.modal = null;
    }
    if (this.toolbarButton && this.toolbarButton.parentNode) {
      this.toolbarButton.parentNode.removeChild(this.toolbarButton);
      this.toolbarButton = null;
    }
  },
});
