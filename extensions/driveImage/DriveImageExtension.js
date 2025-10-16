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
      maxConcurrentUploads: 2, // CORS対応のため2に変更
      galleryTimeout: 15000,
      galleryCacheTimeout: 0, // キャッシュを無効化（毎回リフレッシュ）
      permissionsEndpoint: '',
      permissionCacheTimeout: DriveImageHandler.DEFAULT_PERMISSION_CACHE_TTL,
      userAuthority: null,
      userRole: '',
      defaultFolderName: '',
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

      deleteImage:
        (imageId) =>
        () => {
          if (!imageId) {
            if (this.options.debug) {
              console.error('No image ID provided to deleteImage command');
            }
            return false;
          }
          DriveImageHandler.deleteImage(imageId, this.options);
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

      refreshGallery:
        () =>
        () => {
          if (this.modal && this.modal.isVisible && this.modal.currentTab === 'gallery') {
            const content = this.modal.modal.querySelector('.tab-content');
            this.modal.showGalleryTab(content);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-i': () => this.editor.commands.openImageModal(),
      'Mod-Alt-i': () => this.editor.commands.insertImageFromGallery(),
      'Mod-Shift-r': () => this.editor.commands.refreshGallery(),
    };
  },

  onCreate() {
    const addToolbarButton = () => {
      const toolbar = document.querySelector(this.options.toolbarSelector);
      if (!toolbar) {
        console.warn('[DriveImageExtension] Toolbar element not found:', this.options.toolbarSelector);
        return;
      }
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
  
    const setupEditorEvents = () => {
      const editorElement = this.editor.view.dom;
  
      if (this.options.enablePasteUpload) {
        editorElement.addEventListener('paste', (e) => {
          const items = Array.from(e.clipboardData?.items || []);
          const files = items
            .filter((i) => i.type.startsWith('image/'))
            .map((i) => i.getAsFile())
            .filter(Boolean);
          if (files.length) {
            e.preventDefault();
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
        
        // ドラッグオーバー時のデフォルト動作を防止
        editorElement.addEventListener('dragover', (e) => {
          e.preventDefault();
        });
      }
    };
  
    const ensureToolbarStyles = () => {
      if (document.getElementById('drive-image-toolbar-styles')) return;
      const style = document.createElement('style');
      style.id = 'drive-image-toolbar-styles';
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
          min-width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .toolbar-button:hover {
          background: #f8f9fa;
          border-color: #dee2e6;
        }
        .toolbar-button:focus {
          outline: 2px solid #007bff;
          outline-offset: 2px;
        }
        .toolbar-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `;
      document.head.appendChild(style);
    };
  
    // 実際に実行
    if (this.options.addToToolbar) addToolbarButton();
    if (this.options.enablePasteUpload || this.options.enableDropUpload) setupEditorEvents();
    ensureToolbarStyles();
  },

  onDestroy() {
    if (this.options.debug) {
      console.log(`DriveImageExtension destroyed (${this.instanceId})`);
    }
    if (this.modal?.cleanup) {
      this.modal.cleanup();
      this.modal = null;
    }
    if (this.toolbarButton && this.toolbarButton.parentNode) {
      this.toolbarButton.parentNode.removeChild(this.toolbarButton);
      this.toolbarButton = null;
    }
  },
});
