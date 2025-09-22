import { Extension } from '@tiptap/core';
import { DriveImageHandler } from './DriveImageHandler.js';
import { ImageModal } from './ImageModal.js';

/**
 * Google Drive画像挿入機能をTiptapエディターに統合するExtension（改善版）
 * @extends Extension
 */
export const DriveImageExtension = Extension.create({
  name: 'driveImage',
  
  /**
   * デフォルトオプション
   */
  addOptions() {
    return {
      // 必須: Google Apps Script WebApp URL
      webAppUrl: '',
      
      // ファイル制限設定
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/jpg', 
        'image/png', 
        'image/gif', 
        'image/webp'
      ],
      
      // アップロード設定
      uploadTimeout: 30000, // 30秒
      maxConcurrentUploads: 3, // 同時アップロード数
      
      // ギャラリー設定
      galleryTimeout: 15000, // 15秒
      galleryCacheTimeout: 300000, // 5分
      
      // reCAPTCHA設定（オプション）
      recaptchaSiteKey: null,
      
      // ツールバーボタンの設定
      addToToolbar: true,
      toolbarButtonHTML: '🖼️',
      toolbarButtonTitle: '画像挿入',
      toolbarSelector: '.toolbar',
      
      // カスタムボタンクラス
      buttonClass: 'toolbar-button',
      
      // ドラッグ&ドロップ・ペースト機能
      enablePasteUpload: true,
      enableDropUpload: true,
      
      // デバッグモード
      debug: false
    };
  },
  
  /**
   * エディターコマンドを追加
   */
  addCommands() {
    return {
      /**
       * 画像挿入モーダルを開く
       */
      openImageModal:
        () =>
        ({ editor }) => {
          if (this.options.debug) {
            console.log('Opening image modal with options:', this.options);
          }
          
          // WebApp URLが設定されているかチェック
          if (!this.options.webAppUrl) {
            DriveImageHandler.showMessage(
              'WebApp URLが設定されていません。Extension設定を確認してください。', 
              'error'
            );
            return false;
          }
          
          // モーダルインスタンスを作成または再利用
          if (!this.modal) {
            this.modal = new ImageModal(editor, this.options, DriveImageHandler);
          }
          
          this.modal.show();
          return true;
        },
      
      /**
       * 画像を直接アップロード（プログラム的に使用）
       */
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
      
      /**
       * 複数画像を並列アップロード
       */
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
      
      /**
       * ギャラリーから画像を挿入
       */
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
      
      /**
       * キャッシュをクリア
       */
      clearImageCache:
        () =>
        () => {
          DriveImageHandler.clearCache();
          if (this.options.debug) {
            console.log('Image cache cleared');
          }
          return true;
        }
    };
  },
  
  /**
   * キーボードショートカットを追加
   */
  addKeyboardShortcuts() {
    return {
      // Ctrl+Shift+I で画像モーダルを開く
      'Mod-Shift-i': () => this.editor.commands.openImageModal(),
      // Ctrl+Alt+I でギャラリーを開く  
      'Mod-Alt-i': () => this.editor.commands.insertImageFromGallery(),
    };
  },
  
  /**
   * Extension作成時の処理
   */
  onCreate() {
    if (this.options.debug) {
      console.log('DriveImageExtension created with options:', this.options);
    }
    
    // エディター固有のインスタンスIDを生成
    this.instanceId = `drive_ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // バリデーション
    this.validateOptions();
    
    // ツールバーボタンを追加
    if (this.options.addToToolbar) {
      this.addToolbarButton();
    }
    
    // グローバルイベントリスナーを設定（エディター固有）
    if (this.options.enablePasteUpload || this.options.enableDropUpload) {
      this.setupEditorEvents();
    }
    
    // グローバルスタイルシートを確実に追加
    this.ensureToolbarStyles();
  },
  
  /**
   * Extension破棄時の処理
   */
  onDestroy() {
    if (this.options.debug) {
      console.log(`DriveImageExtension destroyed (${this.instanceId})`);
    }
    
    // モーダルを破棄
    if (this.modal) {
      this.modal.cleanup();
      this.modal = null;
    }
    
    // ツールバーボタンを削除
    if (this.toolbarButton && this.toolbarButton.parentNode) {
      this.toolbarButton.parentNode.removeChild(this.toolbarButton);
      this.toolbarButton = null;
    }
    
    // エディター固有イベントリスナーを削除
    this.removeEditorEvents();
  },
  
  /**
   * エディター固有のイベントリスナーを設定（二重登録回避）
   */
  setupEditorEvents() {
    const editorElement = this.editor.view.dom;
    
    // ペーストイベント（エディター固有）
    if (this.options.enablePasteUpload) {
      this.pasteHandler = this.createPasteHandler();
      editorElement.addEventListener('paste', this.pasteHandler);
      
      if (this.options.debug) {
        console.log(`Paste handler attached to editor ${this.instanceId}`);
      }
    }
    
    // ドロップイベント（エディター固有）
    if (this.options.enableDropUpload) {
      this.dropHandler = this.createDropHandler();
      this.dragOverHandler = this.createDragOverHandler();
      
      editorElement.addEventListener('drop', this.dropHandler);
      editorElement.addEventListener('dragover', this.dragOverHandler);
      
      if (this.options.debug) {
        console.log(`Drop handlers attached to editor ${this.instanceId}`);
      }
    }
  },
  
  /**
   * エディター固有のイベントリスナーを削除
   */
  removeEditorEvents() {
    const editorElement = this.editor?.view?.dom;
    if (!editorElement) return;
    
    if (this.pasteHandler) {
      editorElement.removeEventListener('paste', this.pasteHandler);
      this.pasteHandler = null;
    }
    
    if (this.dropHandler) {
      editorElement.removeEventListener('drop', this.dropHandler);
      this.dropHandler = null;
    }
    
    if (this.dragOverHandler) {
      editorElement.removeEventListener('dragover', this.dragOverHandler);
      this.dragOverHandler = null;
    }
    
    if (this.options.debug) {
      console.log(`Event handlers removed from editor ${this.instanceId}`);
    }
  },
  
  /**
   * ペーストハンドラーを作成（クロージャーでエディター固有性を保持）
   * @returns {Function} ペーストイベントハンドラー
   */
  createPasteHandler() {
    const editor = this.editor;
    const options = this.options;
    const instanceId = this.instanceId;
    
    return async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      
      if (imageItems.length > 0) {
        e.preventDefault();
        
        if (options.debug) {
          console.log(`Paste upload triggered for editor ${instanceId}:`, imageItems.length, 'images');
        }
        
        const files = imageItems.map(item => item.getAsFile()).filter(Boolean);
        
        try {
          if (files.length === 1) {
            await DriveImageHandler.uploadImage(files[0], editor, options);
          } else {
            await DriveImageHandler.uploadMultipleImages(files, editor, options);
          }
        } catch (error) {
          console.error(`Paste upload error in editor ${instanceId}:`, error);
        }
      }
    };
  },
  
  /**
   * ドロップハンドラーを作成（クロージャーでエディター固有性を保持）
   * @returns {Function} ドロップイベントハンドラー
   */
  createDropHandler() {
    const editor = this.editor;
    const options = this.options;
    const instanceId = this.instanceId;
    
    return async (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      const imageFiles = files.filter(file => 
        options.allowedMimeTypes.includes(file.type)
      );
      
      if (imageFiles.length > 0) {
        e.preventDefault();
        
        if (options.debug) {
          console.log(`Drop upload triggered for editor ${instanceId}:`, imageFiles.length, 'images');
        }
        
        // 画像以外のファイルがある場合は警告
        if (imageFiles.length !== files.length) {
          DriveImageHandler.showMessage(
            '一部のファイルはサポートされていない形式です', 
            'warning'
          );
        }
        
        try {
          if (imageFiles.length === 1) {
            await DriveImageHandler.uploadImage(imageFiles[0], editor, options);
          } else {
            await DriveImageHandler.uploadMultipleImages(imageFiles, editor, options);
          }
        } catch (error) {
          console.error(`Drop upload error in editor ${instanceId}:`, error);
        }
      }
    };
  },
  
  /**
   * ドラッグオーバーハンドラーを作成
   * @returns {Function} ドラッグオーバーイベントハンドラー
   */
  createDragOverHandler() {
    const options = this.options;
    
    return (e) => {
      const files = Array.from(e.dataTransfer?.files || []);
      const hasImages = files.some(file => 
        options.allowedMimeTypes.includes(file.type)
      );
      
      if (hasImages) {
        e.preventDefault();
        // ドロップ可能であることを示すカーソルを表示
        e.dataTransfer.dropEffect = 'copy';
      }
    };
  },
  
  /**
   * ツールバーにボタンを追加（重複回避）
   */
  addToolbarButton() {
    const toolbar = document.querySelector(this.options.toolbarSelector);
    if (!toolbar) {
      if (this.options.debug) {
        console.warn(`Toolbar not found with selector: ${this.options.toolbarSelector}`);
      }
      return;
    }
    
    // 既存のボタンをチェック（他のエディターインスタンスによる追加を考慮）
    const existingButton = toolbar.querySelector(`[data-drive-image-btn="${this.instanceId}"]`);
    if (existingButton) {
      if (this.options.debug) {
        console.log('Toolbar button already exists, reusing');
      }
      this.toolbarButton = existingButton;
      return;
    }
    
    // セパレーターを追加（必要に応じて）
    const needsSeparator = toolbar.children.length > 0 && 
      !toolbar.lastElementChild.classList.contains('toolbar-separator');
    
    if (needsSeparator) {
      const separator = document.createElement('div');
      separator.className = 'toolbar-separator';
      separator.setAttribute('data-drive-separator', this.instanceId);
      toolbar.appendChild(separator);
    }
    
    // 画像挿入ボタンを作成
    this.toolbarButton = document.createElement('button');
    this.toolbarButton.className = this.options.buttonClass;
    this.toolbarButton.innerHTML = this.options.toolbarButtonHTML;
    this.toolbarButton.title = this.options.toolbarButtonTitle;
    this.toolbarButton.type = 'button';
    this.toolbarButton.setAttribute('data-drive-image-btn', this.instanceId);
    this.toolbarButton.setAttribute('aria-label', this.options.toolbarButtonTitle);
    
    // クリックイベント（エディター固有）
    this.toolbarButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.editor.commands.openImageModal();
    });
    
    toolbar.appendChild(this.toolbarButton);
    
    if (this.options.debug) {
      console.log(`Toolbar button added for editor ${this.instanceId}`);
    }
  },
  
  /**
   * ツールバースタイルを確実に追加（一度だけ）
   */
  ensureToolbarStyles() {
    const styleId = 'drive-image-toolbar-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Drive Image Toolbar Styles */
      .toolbar-separator {
        width: 1px;
        height: 20px;
        background: #dee2e6;
        margin: 0 8px;
        display: inline-block;
        vertical-align: middle;
      }
      
      .toolbar-button {
        background: none;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 6px 8px;
        cursor: pointer;
        font-size: 16px;
        color: #495057;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        height: 32px;
        vertical-align: middle;
      }
      
      .toolbar-button:hover {
        background: #f8f9fa;
        border-color: #dee2e6;
        transform: translateY(-1px);
      }
      
      .toolbar-button:active {
        background: #e9ecef;
        border-color: #adb5bd;
        transform: translateY(0);
      }
      
      .toolbar-button:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }
      
      .toolbar-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      
      /* レスポンシブ対応 */
      @media (max-width: 768px) {
        .toolbar-button {
          min-width: 36px;
          height: 36px;
          padding: 8px;
        }
        
        .toolbar-separator {
          margin: 0 6px;
        }
      }
    `;
    document.head.appendChild(style);
  },
  
  /**
   * オプションのバリデーション（詳細化）
   */
  validateOptions() {
    const errors = [];
    const warnings = [];
    
    // 必須設定のチェック
    if (!this.options.webAppUrl) {
      errors.push('webAppUrl is required');
    }
    
    // URL形式のチェック
    if (this.options.webAppUrl && !this.isValidUrl(this.options.webAppUrl)) {
      errors.push('webAppUrl must be a valid URL');
    }
    
    // ファイルサイズの妥当性チェック
    if (this.options.maxFileSize <= 0) {
      errors.push('maxFileSize must be greater than 0');
    }
    
    if (this.options.maxFileSize > 100 * 1024 * 1024) { // 100MB
      warnings.push('maxFileSize is very large, may cause performance issues');
    }
    
    // MIMEタイプの妥当性チェック
    if (!Array.isArray(this.options.allowedMimeTypes) || this.options.allowedMimeTypes.length === 0) {
      errors.push('allowedMimeTypes must be a non-empty array');
    }
    
    // タイムアウト値のチェック
    if (this.options.uploadTimeout < 5000) {
      warnings.push('uploadTimeout is very short, may cause timeout errors');
    }
    
    if (this.options.galleryTimeout < 3000) {
      warnings.push('galleryTimeout is very short, may cause timeout errors');
    }
    
    // 同時アップロード数のチェック
    if (this.options.maxConcurrentUploads > 10) {
      warnings.push('maxConcurrentUploads is high, may cause performance issues');
    }
    
    // ツールバーセレクタのチェック
    if (this.options.addToToolbar && !document.querySelector(this.options.toolbarSelector)) {
      warnings.push(`Toolbar element not found: ${this.options.toolbarSelector}`);
    }
    
    // エラーがある場合は表示
    if (errors.length > 0) {
      const message = `DriveImageExtension configuration errors:\n${errors.join('\n')}`;
      console.error(message);
      
      if (!this.options.webAppUrl) {
        DriveImageHandler.showMessage(
          'Google Drive画像機能: 設定が不完全です', 
          'error'
        );
      }
    }
    
    // 警告がある場合は表示（デバッグモードのみ）
    if (warnings.length > 0 && this.options.debug) {
      const message = `DriveImageExtension configuration warnings:\n${warnings.join('\n')}`;
      console.warn(message);
    }
  },
  
  /**
   * URL形式の妥当性をチェック
   * @param {string} url - チェックするURL
   * @returns {boolean} 妥当性
   */
  isValidUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  },
  
  /**
   * Extension設定を動的に更新
   * @param {Object} newOptions - 新しい設定オプション
   */
  updateOptions(newOptions) {
    // 既存設定をマージ
    this.options = { ...this.options, ...newOptions };
    
    // 再バリデーション
    this.validateOptions();
    
    // モーダルが存在する場合は新しい設定を反映
    if (this.modal) {
      this.modal.options = this.options;
    }
    
    if (this.options.debug) {
      console.log(`Options updated for editor ${this.instanceId}:`, this.options);
    }
  },
  
  /**
   * Extension統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats() {
    return {
      name: this.name,
      instanceId: this.instanceId,
      isConfigured: !!this.options.webAppUrl,
      hasModal: !!this.modal,
      hasToolbarButton: !!this.toolbarButton,
      eventHandlers: {
        paste: !!this.pasteHandler,
        drop: !!this.dropHandler,
        dragover: !!this.dragOverHandler
      },
      options: { ...this.options }
    };
  },
  
  /**
   * Extension の健全性チェック
   * @returns {Object} ヘルスチェック結果
   */
  healthCheck() {
    const issues = [];
    const warnings = [];
    
    if (!this.options.webAppUrl) {
      issues.push('WebApp URL not configured');
    }
    
    if (this.options.addToToolbar && !this.toolbarButton) {
      issues.push('Toolbar button not created');
    }
    
    if (!this.editor?.view?.dom) {
      issues.push('Editor DOM not accessible');
    }
    
    if (this.options.enablePasteUpload && !this.pasteHandler) {
      warnings.push('Paste upload enabled but handler not attached');
    }
    
    if (this.options.enableDropUpload && (!this.dropHandler || !this.dragOverHandler)) {
      warnings.push('Drop upload enabled but handlers not attached');
    }
    
    return {
      instanceId: this.instanceId,
      healthy: issues.length === 0,
      issues,
      warnings,
      timestamp: new Date().toISOString()
    };
  }
});