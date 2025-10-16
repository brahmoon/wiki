/**
 * 画像挿入用モーダルダイアログクラス（アクセシビリティ対応・削除機能付き）
 * @class ImageModal
 */
export class ImageModal {
  /**
   * @param {Object} editor - Tiptapエディターインスタンス
   * @param {Object} options - 設定オプション
   * @param {Object} handler - DriveImageHandlerクラス
   */
  constructor(editor, options, handler) {
    this.editor = editor;
    this.options = options;
    this.handler = handler;
    this.modal = null;
    this.currentTab = 'gallery';
    this.isVisible = false;
    this.instanceId = `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.galleryFolders = [];
    this.permissions = {};
    this.permissionsLoaded = false;
    this.shouldReloadGallery = true;
    this.currentFolderKey = null;
    this.currentUploadFolderKey = null;
    this.uploadElements = null;

    // アクセシビリティ用
    this.previousActiveElement = null;
    this.focusableElements = [];
    this.firstFocusableElement = null;
    this.lastFocusableElement = null;
    
    // イベントハンドラーをバインド
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleFocus = this.handleFocus.bind(this);
    
    // スタイルシートを一度だけ挿入
    this.ensureGlobalStyles();
  }
  
  /**
   * グローバルスタイルを確実に挿入
   */
  ensureGlobalStyles() {
    const styleId = 'drive-image-modal-global-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = this.getGlobalStyles();
    document.head.appendChild(style);
  }
  
  /**
   * グローバルスタイルを取得（外部CSS化を想定）
   * @returns {string} CSSスタイル
   */
  getGlobalStyles() {
    return `
      /* Drive Image Modal Base Styles */
      .drive-image-modal {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .drive-image-modal .modal-content {
        background: white; 
        border-radius: 12px; 
        width: 90%; 
        max-width: 800px;
        max-height: 80vh; 
        overflow: hidden; 
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
      }
      
      .drive-image-modal .modal-header {
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        padding: 20px; 
        border-bottom: 1px solid #e9ecef;
        background: #f8f9fa;
        flex-shrink: 0;
      }
      
      .drive-image-modal .tab-buttons {
        display: flex;
        gap: 8px;
      }
      
      .drive-image-modal .tab-btn {
        padding: 8px 16px; 
        border: 1px solid #dee2e6; 
        background: white;
        border-radius: 6px; 
        cursor: pointer; 
        transition: all 0.2s; 
        font-size: 14px; 
        font-weight: 500;
        position: relative;
      }
      
      .drive-image-modal .tab-btn:hover {
        background: #f8f9fa; 
        border-color: #adb5bd;
      }
      
      .drive-image-modal .tab-btn:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }
      
      .drive-image-modal .tab-btn.active {
        background: #007bff; 
        color: white; 
        border-color: #007bff;
      }
      
      .drive-image-modal .close-btn {
        background: none; 
        border: none; 
        font-size: 24px; 
        cursor: pointer;
        color: #6c757d; 
        width: 32px; 
        height: 32px; 
        display: flex;
        align-items: center; 
        justify-content: center; 
        border-radius: 50%;
        transition: all 0.2s;
      }
      
      .drive-image-modal .close-btn:hover {
        background: #f8f9fa;
        color: #495057;
      }
      
      .drive-image-modal .close-btn:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }
      
      .drive-image-modal .tab-content {
        padding: 20px; 
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }
      
      /* ギャラリースタイル */
      .drive-image-modal .gallery-grid {
        display: grid; 
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 12px; 
        justify-content: center;
      }
      
      .drive-image-modal .gallery-item {
        aspect-ratio: 1;
        background: #f8f9fa; 
        display: flex;
        align-items: center; 
        justify-content: center; 
        border: 2px solid #dee2e6;
        border-radius: 6px; 
        overflow: hidden; 
        cursor: pointer;
        transition: all 0.2s; 
        position: relative;
      }
      
      .drive-image-modal .gallery-item:hover {
        transform: scale(1.02); 
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        border-color: #007bff;
      }
      
      .drive-image-modal .gallery-item:focus {
        outline: 3px solid #007bff;
        outline-offset: 2px;
      }
      
      .drive-image-modal .gallery-item img {
        max-width: 100%; 
        max-height: 100%; 
        object-fit: contain;
        background: white;
      }
      
      /* 削除ボタン */
      .drive-image-modal .gallery-item .delete-btn {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 24px;
        height: 24px;
        background: rgba(220, 53, 69, 0.9);
        color: white;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: none;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
        transition: all 0.2s;
        z-index: 1;
      }
      
      .drive-image-modal .gallery-item:hover .delete-btn,
      .drive-image-modal .gallery-item:focus-within .delete-btn {
        display: flex;
      }
      
      .drive-image-modal .gallery-item .delete-btn:hover {
        background: rgba(220, 53, 69, 1);
        transform: scale(1.1);
      }
      
      .drive-image-modal .gallery-item .delete-btn:focus {
        outline: 2px solid #fff;
        outline-offset: 1px;
      }
      
      .drive-image-modal .gallery-loading,
      .drive-image-modal .gallery-empty {
        text-align: center; 
        padding: 60px 20px; 
        color: #6c757d;
        font-size: 16px;
      }
      
      .drive-image-modal .gallery-error {
        text-align: center;
        padding: 40px 20px;
        color: #dc3545;
        background: #f8d7da;
        border-radius: 8px;
        margin: 20px 0;
      }

      .drive-image-modal .folder-grid-wrapper {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .drive-image-modal .folder-grid-header h3 {
        margin: 0 0 4px 0;
        font-size: 20px;
        font-weight: 600;
      }

      .drive-image-modal .folder-grid-header p {
        margin: 0;
        color: #6c757d;
        font-size: 14px;
      }

      .drive-image-modal .drive-folder-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }

      .drive-image-modal .drive-folder-card {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 16px;
        border-radius: 10px;
        border: 1px solid #dee2e6;
        background: #fff;
        cursor: pointer;
        text-align: left;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }

      .drive-image-modal .drive-folder-card:hover,
      .drive-image-modal .drive-folder-card:focus {
        transform: translateY(-2px);
        box-shadow: 0 10px 24px rgba(0,0,0,0.08);
        border-color: #0d6efd;
      }

      .drive-image-modal .drive-folder-card:focus {
        outline: 3px solid rgba(13,110,253,0.35);
        outline-offset: 2px;
      }

      .drive-image-modal .folder-card-icon {
        font-size: 32px;
      }

      .drive-image-modal .folder-card-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .drive-image-modal .folder-card-title {
        font-size: 16px;
        font-weight: 600;
        color: #343a40;
      }

      .drive-image-modal .folder-card-meta {
        font-size: 13px;
        color: #6c757d;
      }

      .drive-image-modal .folder-card-permissions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 4px;
      }

      .drive-image-modal .permission-tag {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 999px;
        border: 1px solid transparent;
      }

      .drive-image-modal .permission-tag.allowed {
        background: rgba(25,135,84,0.12);
        color: #198754;
        border-color: rgba(25,135,84,0.3);
      }

      .drive-image-modal .permission-tag.denied {
        background: rgba(220,53,69,0.12);
        color: #dc3545;
        border-color: rgba(220,53,69,0.3);
      }

      .drive-image-modal .folder-content-wrapper {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .drive-image-modal .folder-content-header {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .drive-image-modal .folder-back-btn {
        border: 1px solid #dee2e6;
        background: #fff;
        padding: 6px 12px;
        border-radius: 999px;
        cursor: pointer;
        font-size: 13px;
        color: #495057;
        transition: all 0.2s ease;
      }

      .drive-image-modal .folder-back-btn:hover,
      .drive-image-modal .folder-back-btn:focus {
        background: #e7f1ff;
        border-color: #0d6efd;
        color: #0d6efd;
        outline: none;
      }

      .drive-image-modal .folder-content-title h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #212529;
      }

      .drive-image-modal .folder-content-meta {
        font-size: 13px;
        color: #6c757d;
      }

      /* アップロードスタイル */
      .drive-image-modal .upload-container {
        text-align: center;
        max-width: 500px;
        margin: 0 auto;
      }

      .drive-image-modal .upload-destination {
        text-align: left;
        margin-bottom: 20px;
      }

      .drive-image-modal .upload-destination-label {
        display: block;
        margin-bottom: 6px;
        font-size: 14px;
        font-weight: 600;
        color: #495057;
      }

      .drive-image-modal .upload-folder-select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 6px;
        border: 1px solid #ced4da;
        font-size: 14px;
        background: #fff;
        color: #212529;
      }

      .drive-image-modal .upload-folder-select:focus {
        border-color: #0d6efd;
        outline: 3px solid rgba(13,110,253,0.3);
        outline-offset: 1px;
      }

      .drive-image-modal .upload-folder-meta {
        margin-top: 6px;
        font-size: 13px;
        color: #6c757d;
        min-height: 18px;
      }

      .drive-image-modal .upload-permission-warning {
        margin-top: 10px;
        font-size: 13px;
        color: #dc3545;
        background: rgba(220,53,69,0.12);
        border: 1px solid rgba(220,53,69,0.3);
        padding: 8px 12px;
        border-radius: 6px;
      }

      .drive-image-modal .upload-btn {
        padding: 12px 24px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 6px; 
        cursor: pointer; 
        font-size: 16px; 
        margin-bottom: 20px;
        transition: all 0.2s; 
        font-weight: 500;
      }
      
      .drive-image-modal .upload-btn:hover {
        background: #0056b3;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,123,255,0.3);
      }
      
      .drive-image-modal .upload-btn:focus {
        outline: 3px solid rgba(0,123,255,0.5);
        outline-offset: 2px;
      }
      
      .drive-image-modal .upload-zone {
        border: 2px dashed #dee2e6; 
        border-radius: 8px; 
        padding: 40px 20px;
        color: #6c757d; 
        transition: all 0.3s; 
        margin: 20px 0;
        min-height: 120px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      .drive-image-modal .upload-zone.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .drive-image-modal .upload-zone-icon {
        font-size: 48px;
        margin-bottom: 12px;
      }

      .drive-image-modal .upload-zone-title {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
      }

      .drive-image-modal .upload-zone-subtitle {
        margin: 8px 0 0 0;
        font-size: 14px;
        opacity: 0.8;
      }

      .drive-image-modal .upload-zone.dragover {
        border-color: #007bff;
        background-color: #f0f8ff;
        color: #007bff;
        transform: scale(1.02);
      }
      
      .drive-image-modal .upload-zone:focus-within {
        border-color: #007bff;
        background-color: #f0f8ff;
      }
      
      .drive-image-modal .upload-info {
        font-size: 14px; 
        color: #6c757d; 
        text-align: left;
        background: #f8f9fa; 
        padding: 16px; 
        border-radius: 6px; 
        margin-top: 20px;
        border: 1px solid #e9ecef;
      }
      
      .drive-image-modal .upload-info ul {
        margin: 8px 0; 
        padding-left: 20px;
      }
      
      .drive-image-modal .upload-info li {
        margin-bottom: 4px;
      }
      
      /* 進捗表示 */
      .drive-image-modal .upload-progress {
        margin-top: 16px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px solid #e9ecef;
      }
      
      .drive-image-modal .progress-bar {
        width: 100%;
        height: 8px;
        background: #e9ecef;
        border-radius: 4px;
        overflow: hidden;
        margin-top: 8px;
      }
      
      .drive-image-modal .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #007bff, #0056b3);
        transition: width 0.3s ease;
        width: 0%;
      }
      
      /* 削除確認ダイアログ */
      .delete-confirmation-dialog {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .delete-confirmation-content {
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      }
      
      .delete-confirmation-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #dc3545;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .delete-confirmation-message {
        font-size: 14px;
        color: #6c757d;
        margin-bottom: 20px;
        line-height: 1.5;
      }
      
      .delete-confirmation-buttons {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      
      .delete-confirmation-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .delete-confirmation-btn.cancel {
        background: #f8f9fa;
        color: #6c757d;
        border: 1px solid #dee2e6;
      }
      
      .delete-confirmation-btn.cancel:hover {
        background: #e9ecef;
      }
      
      .delete-confirmation-btn.delete {
        background: #dc3545;
        color: white;
      }
      
      .delete-confirmation-btn.delete:hover {
        background: #c82333;
      }
      
      .delete-confirmation-btn:focus {
        outline: 2px solid #007bff;
        outline-offset: 2px;
      }
      
      /* レスポンシブ対応 */
      @media (max-width: 768px) {
        .drive-image-modal .modal-content {
          width: 95%;
          max-height: 90vh;
        }
        
        .drive-image-modal .modal-header {
          padding: 16px;
        }
        
        .drive-image-modal .tab-content {
          padding: 16px;
        }
        
        .drive-image-modal .gallery-grid {
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 8px;
        }
        
        .drive-image-modal .upload-zone {
          padding: 30px 16px;
          min-height: 100px;
        }
        
        .delete-confirmation-content {
          padding: 20px;
          margin: 20px;
        }
      }
      
      /* フォーカストラップ用のスタイル */
      .drive-image-modal [tabindex="-1"]:focus {
        outline: none;
      }
      
      /* アクセシビリティ用の非表示クラス */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0,0,0,0);
        white-space: nowrap;
        border: 0;
      }
    `;
  }
  
  /**
   * モーダルを表示
   */
  show() {
    if (this.isVisible) return;
    
    // 現在のアクティブ要素を記録
    this.previousActiveElement = document.activeElement;
    
    if (this.modal) {
      this.modal.style.display = 'flex';
      this.isVisible = true;
      this.setupAccessibility();
      return;
    }
    
    this.createModal();
  }
  
  /**
   * モーダルを非表示
   */
  hide() {
    if (!this.isVisible || !this.modal) return;
    
    this.modal.style.display = 'none';
    this.isVisible = false;
    
    // フォーカスを元の要素に戻す
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
    
    this.removeAccessibilityEvents();
  }
  
  /**
   * モーダルを破棄
   */
  destroy() {
    this.removeAccessibilityEvents();
    
    if (this.modal?.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
      this.modal = null;
    }
    
    this.isVisible = false;
  }
  
  /**
   * モーダル要素を作成
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'drive-image-modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-labelledby', `modal-title-${this.instanceId}`);
    this.modal.setAttribute('aria-describedby', `modal-desc-${this.instanceId}`);
    
    this.modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.6); display: flex; align-items: center;
      justify-content: center; z-index: 9999; backdrop-filter: blur(2px);
    `;
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    content.innerHTML = this.getModalHTML();
    
    // イベントリスナーを設定
    this.setupEventListeners(content);
    
    this.modal.appendChild(content);
    document.body.appendChild(this.modal);
    
    // モーダル外クリックで閉じる
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.hide();
    });
    
    this.isVisible = true;
    this.setupAccessibility();
    
    // 初期タブを表示
    this.switchTab('gallery');
  }
  
  /**
   * モーダルのHTML構造を取得
   * @returns {string} HTML文字列
   */
  getModalHTML() {
    return `
      <div class="modal-header">
        <div class="tab-buttons" role="tablist" aria-label="画像挿入方法選択">
          <button class="tab-btn active" data-tab="gallery" role="tab" 
                  aria-selected="true" aria-controls="gallery-panel-${this.instanceId}"
                  id="gallery-tab-${this.instanceId}">ギャラリー</button>
          <button class="tab-btn" data-tab="upload" role="tab" 
                  aria-selected="false" aria-controls="upload-panel-${this.instanceId}"
                  id="upload-tab-${this.instanceId}">アップロード</button>
        </div>
        <button class="close-btn" aria-label="画像挿入ダイアログを閉じる" title="閉じる (ESC)">×</button>
      </div>
      <div class="tab-content" role="tabpanel" 
           id="content-panel-${this.instanceId}"
           aria-labelledby="gallery-tab-${this.instanceId}">
        <div id="modal-desc-${this.instanceId}" class="sr-only">
          画像をギャラリーから選択するか、新しい画像をアップロードできます
        </div>
      </div>
    `;
  }
  
  /**
   * アクセシビリティを設定
   */
  setupAccessibility() {
    if (!this.modal) return;
    
    // フォーカス可能な要素を取得
    this.updateFocusableElements();
    
    // イベントリスナーを追加
    document.addEventListener('keydown', this.handleKeyDown, true);
    this.modal.addEventListener('focus', this.handleFocus, true);
    
    // 初期フォーカス設定
    setTimeout(() => {
      if (this.firstFocusableElement) {
        this.firstFocusableElement.focus();
      }
    }, 100);
  }
  
  /**
   * アクセシビリティイベントを削除
   */
  removeAccessibilityEvents() {
    document.removeEventListener('keydown', this.handleKeyDown, true);
    if (this.modal) {
      this.modal.removeEventListener('focus', this.handleFocus, true);
    }
  }
  
  /**
   * フォーカス可能な要素を更新
   */
  updateFocusableElements() {
    if (!this.modal) return;
    
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '.gallery-item'
    ];
    
    this.focusableElements = Array.from(
      this.modal.querySelectorAll(focusableSelectors.join(', '))
    ).filter(el => {
      // 非表示要素を除外
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    
    this.firstFocusableElement = this.focusableElements[0];
    this.lastFocusableElement = this.focusableElements[this.focusableElements.length - 1];
  }
  
  /**
   * キーボードイベントハンドラー
   * @param {KeyboardEvent} e - キーボードイベント
   */
  handleKeyDown(e) {
    if (!this.isVisible) return;
    
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;
        
      case 'Tab':
        this.handleTabKey(e);
        break;
        
      case 'ArrowLeft':
      case 'ArrowRight':
        if (e.target.closest('.tab-buttons')) {
          this.handleArrowKeys(e);
        }
        break;
        
      case 'Enter':
      case ' ':
        if (e.target.classList.contains('gallery-item')) {
          e.preventDefault();
          e.target.click();
        }
        break;
    }
  }
  
  /**
   * Tabキーによるフォーカストラップ
   * @param {KeyboardEvent} e - キーボードイベント
   */
  handleTabKey(e) {
    if (!this.firstFocusableElement || !this.lastFocusableElement) {
      this.updateFocusableElements();
      return;
    }
    
    if (e.shiftKey) {
      // Shift + Tab (逆方向)
      if (document.activeElement === this.firstFocusableElement) {
        e.preventDefault();
        this.lastFocusableElement.focus();
      }
    } else {
      // Tab (順方向)
      if (document.activeElement === this.lastFocusableElement) {
        e.preventDefault();
        this.firstFocusableElement.focus();
      }
    }
  }
  
  /**
   * 矢印キーによるタブナビゲーション
   * @param {KeyboardEvent} e - キーボードイベント
   */
  handleArrowKeys(e) {
    e.preventDefault();
    
    const tabs = Array.from(this.modal.querySelectorAll('.tab-btn'));
    const currentIndex = tabs.findIndex(tab => tab === document.activeElement);
    
    if (currentIndex === -1) return;
    
    let nextIndex;
    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else {
      nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
    }
    
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  }
  
  /**
   * フォーカスイベントハンドラー
   * @param {FocusEvent} e - フォーカスイベント
   */
  handleFocus(e) {
    // モーダル外にフォーカスが移動した場合、モーダル内に戻す
    if (!this.modal.contains(e.target)) {
      e.preventDefault();
      if (this.firstFocusableElement) {
        this.firstFocusableElement.focus();
      }
    }
  }
  
  /**
   * イベントリスナーを設定
   * @param {HTMLElement} content - コンテンツ要素
   */
  setupEventListeners(content) {
    // 閉じるボタン
    content.querySelector('.close-btn').addEventListener('click', () => this.hide());

    // タブボタン
    content.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });
  }

  async ensurePermissionsLoaded() {
    if (this.permissionsLoaded) {
      return this.permissions;
    }
    try {
      this.permissions = await this.handler.getPermissions(this.options);
    } catch (error) {
      console.error('Failed to load drive image permissions:', error);
      this.permissions = {};
    }
    this.permissionsLoaded = true;
    return this.permissions;
  }

  async refreshGalleryData(force = false) {
    if (!force && !this.shouldReloadGallery && this.galleryFolders.length) {
      return this.galleryFolders;
    }
    const gallery = await this.handler.loadGallery(this.options);
    this.galleryFolders = Array.isArray(gallery?.folders) ? gallery.folders : [];
    this.shouldReloadGallery = false;
    return this.galleryFolders;
  }

  getFolderByKey(key) {
    const normalizedKey = this.handler.getFolderKey(key || this.handler.ROOT_FOLDER_KEY);
    return this.galleryFolders.find((folder) => this.handler.getFolderKey(folder.key) === normalizedKey) || null;
  }

  getFolderPermission(folderKey) {
    const normalizedKey = this.handler.getFolderKey(folderKey || this.handler.ROOT_FOLDER_KEY);
    const permission = this.permissions?.[normalizedKey];
    if (this.handler.hasAdminPrivileges(this.options)) {
      return { upload: true, delete: true };
    }
    if (permission) {
      return permission;
    }
    const role = this.handler.resolveRole(this.options);
    if (role === 'Moderator' || role === 'Administrator') {
      return { upload: true, delete: true };
    }
    return { upload: false, delete: false };
  }

  isUploadAllowed(folderKey) {
    return Boolean(this.getFolderPermission(folderKey).upload);
  }

  isDeleteAllowed(folderKey) {
    return Boolean(this.getFolderPermission(folderKey).delete);
  }

  getUploadableFolders() {
    return this.galleryFolders.filter((folder) => this.isUploadAllowed(folder.key));
  }

  updateUploadDestinationDisplay() {
    if (!this.modal) {
      return;
    }
    const meta = this.modal.querySelector(`#upload-folder-meta-${this.instanceId}`);
    const dropZone = this.uploadElements?.dropZone || null;
    const title = dropZone?.querySelector('.upload-zone-title') || null;
    const subtitle = dropZone?.querySelector('.upload-zone-subtitle') || null;

    const folder = this.getFolderByKey(this.currentUploadFolderKey);
    const folderName = folder ? (folder.displayName || folder.name || '未分類') : '未選択';
    const permission = folder ? this.getFolderPermission(folder.key) : { upload: false, delete: false };

    if (meta) {
      meta.textContent = folder
        ? `選択中: ${folderName}（アップロード${permission.upload ? '可' : '不可'}・削除${permission.delete ? '可' : '不可'}）`
        : 'アップロード先フォルダを選択してください。';
    }

    if (dropZone) {
      if (folder && permission.upload) {
        dropZone.setAttribute('aria-label', `${folderName}に画像をドラッグ&ドロップまたはクリックしてアップロード`);
        dropZone.tabIndex = 0;
      } else if (folder) {
        dropZone.setAttribute('aria-label', `${folderName}にはアップロードできません。別のフォルダを選択してください`);
        dropZone.tabIndex = -1;
      } else {
        dropZone.setAttribute('aria-label', 'アップロード先フォルダを選択してください');
        dropZone.tabIndex = -1;
      }
      dropZone.classList.toggle('disabled', !(folder && permission.upload));
    }

    if (title) {
      title.textContent = folder && permission.upload
        ? `${folderName} にアップロード`
        : 'アップロード先を選択してください';
    }

    if (subtitle) {
      subtitle.textContent = folder && permission.upload
        ? 'または上のボタンでファイルを選択'
        : 'フォルダを選択するとアップロードできます';
    }
  }

  toggleUploadControls(enabled) {
    if (!this.uploadElements) {
      return;
    }
    const { fileInput, selectBtn, dropZone } = this.uploadElements;
    if (fileInput) {
      fileInput.disabled = !enabled;
    }
    if (selectBtn) {
      selectBtn.disabled = !enabled;
    }
    if (dropZone) {
      dropZone.setAttribute('aria-disabled', (!enabled).toString());
      dropZone.classList.toggle('disabled', !enabled);
      dropZone.tabIndex = enabled ? 0 : -1;
    }
  }

  async populateUploadFolders(container) {
    if (!this.uploadElements) {
      return;
    }

    await this.ensurePermissionsLoaded();
    await this.refreshGalleryData();

    const folderSelect = this.uploadElements.folderSelect;
    const warning = this.uploadElements.permissionWarning;

    if (!folderSelect) {
      return;
    }

    folderSelect.innerHTML = '';

    const uploadableFolders = this.getUploadableFolders();

    if (!uploadableFolders.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'アップロード可能なフォルダがありません';
      folderSelect.appendChild(option);
      folderSelect.disabled = true;
      if (warning) {
        warning.hidden = false;
      }
      this.currentUploadFolderKey = null;
      this.toggleUploadControls(false);
      this.updateUploadDestinationDisplay();
      return;
    }

    folderSelect.disabled = false;
    uploadableFolders.forEach((folder) => {
      const option = document.createElement('option');
      option.value = folder.key;
      option.textContent = folder.displayName || folder.name || '未分類';
      folderSelect.appendChild(option);
    });

    const preferredKey = this.handler.getFolderKey(this.options.defaultFolderName || this.handler.ROOT_FOLDER_KEY);
    const preferredFolder = uploadableFolders.find((folder) => this.handler.getFolderKey(folder.key) === preferredKey);

    if (preferredFolder) {
      this.currentUploadFolderKey = preferredFolder.key;
    }

    if (!this.currentUploadFolderKey || !uploadableFolders.some((folder) => folder.key === this.currentUploadFolderKey)) {
      this.currentUploadFolderKey = uploadableFolders[0].key;
    }

    folderSelect.value = this.currentUploadFolderKey;
    if (warning) {
      warning.hidden = true;
    }
    this.toggleUploadControls(true);
    this.updateUploadDestinationDisplay();
  }

  /**
   * タブを切り替え
   * @param {string} tabId - タブID ('gallery' | 'upload')
   */
  switchTab(tabId) {
    this.currentTab = tabId;
    
    const content = this.modal.querySelector('.tab-content');
    const tabs = this.modal.querySelectorAll('.tab-btn');
    
    // タブの状態を更新（アクセシビリティ属性も含む）
    tabs.forEach(tab => {
      const isActive = tab.dataset.tab === tabId;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive.toString());
    });
    
    // タブパネルの aria-labelledby を更新
    const activeTabId = `${tabId}-tab-${this.instanceId}`;
    content.setAttribute('aria-labelledby', activeTabId);

    if (tabId === 'gallery') {
      Promise.resolve(this.showGalleryTab(content)).catch((error) => {
        console.error('Failed to render gallery tab:', error);
      });
    } else {
      this.showUploadTab(content);
    }
  }

   /**
   * ギャラリータブを表示（毎回リフレッシュ）
   * @param {HTMLElement} container - コンテナ要素
   */
  async showGalleryTab(container) {
    container.innerHTML = `
      <div class="gallery-loading" role="status" aria-live="polite">
        <div>📄 ギャラリーを読み込み中...</div>
        <div style="font-size: 14px; margin-top: 8px; opacity: 0.7;">しばらくお待ちください</div>
      </div>
    `;

    try {
      await this.ensurePermissionsLoaded();
      await this.refreshGalleryData();

      if (!this.galleryFolders.length) {
        container.innerHTML = `
          <div class="gallery-empty">
            <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
            <div>表示できるフォルダがありません</div>
            <div style="font-size: 14px; margin-top: 8px; opacity: 0.7;">
              「アップロード」タブから画像を追加するか、管理者にフォルダの作成を依頼してください
            </div>
          </div>
        `;
        this.updateFocusableElements();
        return;
      }

      if (this.currentFolderKey) {
        const currentFolder = this.getFolderByKey(this.currentFolderKey);
        if (currentFolder) {
          this.renderFolderContent(container, currentFolder);
        } else {
          this.currentFolderKey = null;
          this.renderFolderGrid(container);
        }
      } else {
        this.renderFolderGrid(container);
      }

      this.updateFocusableElements();
    } catch (error) {
      container.innerHTML = `
        <div class="gallery-error" role="alert">
          <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
          <div>ギャラリーの読み込みに失敗しました</div>
          <div style="font-size: 14px; margin-top: 8px;">${error.message}</div>
          <button class="upload-btn" style="margin-top: 16px;" onclick="location.reload()">
            再読み込み
          </button>
        </div>
      `;
      this.updateFocusableElements();
    }
  }

  renderFolderGrid(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'folder-grid-wrapper';

    const heading = document.createElement('div');
    heading.className = 'folder-grid-header';
    heading.innerHTML = `
      <h3>フォルダを選択</h3>
      <p>カテゴリを選択して画像を閲覧します。</p>
    `;
    wrapper.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'drive-folder-grid';
    grid.setAttribute('role', 'list');

    this.galleryFolders.forEach((folder) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'drive-folder-card';
      card.setAttribute('role', 'listitem');
      card.dataset.folderKey = folder.key;

      const permission = this.getFolderPermission(folder.key);
      const uploadTag = permission.upload ? 'アップロード可' : 'アップロード不可';
      const deleteTag = permission.delete ? '削除可' : '削除不可';

      card.innerHTML = `
        <div class="folder-card-icon" aria-hidden="true">📁</div>
        <div class="folder-card-body">
          <div class="folder-card-title">${folder.displayName || folder.name || '未分類'}</div>
          <div class="folder-card-meta">${folder.imageCount}件の画像</div>
          <div class="folder-card-permissions">
            <span class="permission-tag ${permission.upload ? 'allowed' : 'denied'}">${uploadTag}</span>
            <span class="permission-tag ${permission.delete ? 'allowed' : 'denied'}">${deleteTag}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.currentFolderKey = folder.key;
        this.showGalleryTab(container);
      });

      grid.appendChild(card);
    });

    wrapper.appendChild(grid);

    container.innerHTML = '';
    container.appendChild(wrapper);
  }

  renderFolderContent(container, folder) {
    const wrapper = document.createElement('div');
    wrapper.className = 'folder-content-wrapper';

    const header = document.createElement('div');
    header.className = 'folder-content-header';
    const permission = this.getFolderPermission(folder.key);
    header.innerHTML = `
      <button type="button" class="folder-back-btn">← フォルダ一覧</button>
      <div class="folder-content-title">
        <h3>${folder.displayName || folder.name || '未分類'}</h3>
        <div class="folder-content-meta">${folder.imageCount}件の画像 · アップロード${permission.upload ? '可' : '不可'} · 削除${permission.delete ? '可' : '不可'}</div>
      </div>
    `;

    const backBtn = header.querySelector('.folder-back-btn');
    backBtn.addEventListener('click', () => {
      this.currentFolderKey = null;
      this.showGalleryTab(container);
    });

    wrapper.appendChild(header);

    if (!folder.images.length) {
      const emptyState = document.createElement('div');
      emptyState.className = 'gallery-empty';
      emptyState.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">🗂️</div>
        <div>このフォルダにはまだ画像がありません</div>
        <div style="font-size: 14px; margin-top: 8px; opacity: 0.7;">
          「アップロード」タブから画像を追加してください
        </div>
      `;
      wrapper.appendChild(emptyState);
      container.innerHTML = '';
      container.appendChild(wrapper);
      return;
    }

    const gallery = document.createElement('div');
    gallery.className = 'gallery-grid';
    gallery.setAttribute('role', 'grid');
    gallery.setAttribute('aria-label', `${folder.images.length}個の画像 (${folder.displayName || folder.name || '未分類'})`);

    folder.images.forEach((image, index) => {
      const item = this.createGalleryItem(image, index);
      gallery.appendChild(item);
    });

    wrapper.appendChild(gallery);

    container.innerHTML = '';
    container.appendChild(wrapper);
  }
  
  /**
   * ギャラリーアイテムを作成（アクセシビリティ対応・削除機能付き）
   * @param {Object} image - 画像情報
   * @param {number} index - インデックス
   * @returns {HTMLElement} ギャラリーアイテム要素
   */
  createGalleryItem(image, index) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `画像: ${image.name || `無題${index + 1}`}を挿入`);
    item.title = image.name || `無題の画像 ${index + 1}`;

    const canDelete = this.isDeleteAllowed(image.folderKey);
    let deleteBtn = null;
    if (canDelete) {
      deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '×';
      deleteBtn.setAttribute('aria-label', `画像「${image.name || '無題'}」を削除`);
      deleteBtn.title = '画像を削除';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showDeleteConfirmation(image);
      });
    }

    // 画像要素
    const img = document.createElement('img');
    img.src = image.thumbnail || image.url;
    img.alt = image.name || '';
    img.setAttribute('aria-hidden', 'true'); // スクリーンリーダーでは親ボタンの説明のみ読む
    
    // 画像読み込みエラーハンドリング
    img.onerror = () => {
      item.innerHTML = `
        <div style="color: #6c757d; font-size: 12px; text-align: center; padding: 8px;">
          <div style="font-size: 24px; margin-bottom: 4px;">🖼️</div>
          <div>読み込みエラー</div>
        </div>
      `;
      item.setAttribute('aria-label', `画像読み込みエラー: ${image.name || '無題の画像'}`);
      // 削除ボタンは残す
      if (deleteBtn) {
        item.appendChild(deleteBtn);
      }
    };

    // クリックで挿入
    item.addEventListener('click', (e) => {
      // 削除ボタンのクリックでない場合のみ挿入
      if (!e.target.classList.contains('delete-btn')) {
        this.insertImage(image);
      }
    });
    
    // キーボードアクセシビリティ
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.insertImage(image);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && canDelete) {
        e.preventDefault();
        this.showDeleteConfirmation(image);
      }
    });

    item.appendChild(img);
    if (deleteBtn) {
      item.appendChild(deleteBtn);
    }
    return item;
  }
  
  /**
   * 削除確認ダイアログを表示
   * @param {Object} image - 削除する画像情報
   */
  showDeleteConfirmation(image) {
    if (!this.isDeleteAllowed(image.folderKey)) {
      return;
    }

    const dialog = document.createElement('div');
    dialog.className = 'delete-confirmation-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'delete-title');
    
    dialog.innerHTML = `
      <div class="delete-confirmation-content">
        <div class="delete-confirmation-title" id="delete-title">
          ⚠️ 画像を削除
        </div>
        <div class="delete-confirmation-message">
          「${image.name || '無題の画像'}」を削除しますか？<br>
          この操作は取り消せません。
        </div>
        <div class="delete-confirmation-buttons">
          <button class="delete-confirmation-btn cancel">キャンセル</button>
          <button class="delete-confirmation-btn delete">削除する</button>
        </div>
      </div>
    `;
    
    const cancelBtn = dialog.querySelector('.cancel');
    const deleteBtn = dialog.querySelector('.delete');
    
    // イベントリスナー
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    
    deleteBtn.addEventListener('click', async () => {
      document.body.removeChild(dialog);
      await this.deleteImage(image);
    });
    
    // ESCキーで閉じる
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.body.removeChild(dialog);
      }
    });
    
    // 外側クリックで閉じる
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        document.body.removeChild(dialog);
      }
    });
    
    document.body.appendChild(dialog);
    
    // 削除ボタンにフォーカス
    setTimeout(() => deleteBtn.focus(), 100);
  }
  
  /**
   * 画像を削除
   * @param {Object} image - 削除する画像情報
   */
  async deleteImage(image) {
    try {
      await this.handler.deleteImage(image.id, this.options);

      // ギャラリーを再読み込み
      this.shouldReloadGallery = true;
      const content = this.modal.querySelector('.tab-content');
      this.showGalleryTab(content);

    } catch (error) {
      console.error('Delete image failed:', error);
      // エラーメッセージは handler 内で表示済み
    }
  }
  
  /**
   * エディターに画像を挿入
   * @param {Object} image - 画像情報
   */
  insertImage(image) {
    // サムネイルURLで挿入
    this.editor.chain().focus().setImage({
      src: image.thumbnail || image.url,
      alt: image.name || '',
      'data-drive-id': image.id
    }).run();
    
    this.hide();
    this.handler.showMessage('画像を挿入しました', 'success');
    
    // スクリーンリーダーにも通知
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.cssText = 'position: absolute; left: -9999px; width: 1px; height: 1px;';
    announcement.textContent = `画像「${image.name || '無題の画像'}」をエディターに挿入しました`;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }
  
  /**
   * アップロードタブを表示
   * @param {HTMLElement} container - コンテナ要素
   */
  showUploadTab(container) {
    const maxSizeMB = Math.round(this.options.maxFileSize / (1024 * 1024));
    const allowedFormats = this.options.allowedMimeTypes
      .map(type => type.split('/')[1].toUpperCase())
      .join(', ');

    container.innerHTML = `
      <div class="upload-container">
        <div class="upload-destination">
          <label for="upload-folder-select-${this.instanceId}" class="upload-destination-label">アップロード先フォルダ</label>
          <select id="upload-folder-select-${this.instanceId}" class="upload-folder-select" aria-describedby="upload-folder-meta-${this.instanceId}"></select>
          <div id="upload-folder-meta-${this.instanceId}" class="upload-folder-meta" aria-live="polite"></div>
          <div id="upload-permission-warning-${this.instanceId}" class="upload-permission-warning" role="alert" hidden>
            アップロードできるフォルダがありません。権限設定を確認してください。
          </div>
        </div>

        <input type="file" id="image-upload-input-${this.instanceId}"
               accept="image/*" multiple style="display: none;"
               aria-describedby="upload-help-${this.instanceId}">

        <button class="upload-btn" id="upload-select-btn-${this.instanceId}" type="button">
          📁 ファイルを選択
        </button>

        <div class="upload-zone" id="upload-drop-zone-${this.instanceId}"
             role="button" tabindex="0"
             aria-describedby="upload-help-${this.instanceId}"
             aria-label="アップロード先フォルダを選択してください">
          <div class="upload-zone-icon" aria-hidden="true">📤</div>
          <p class="upload-zone-title">アップロード先を選択してください</p>
          <p class="upload-zone-subtitle">フォルダを選択するとアップロードできます</p>
        </div>

        <div class="upload-info">
          <p style="margin: 0 0 8px 0; font-weight: 600;">📋 アップロード制限</p>
          <ul id="upload-help-${this.instanceId}" style="margin: 8px 0;">
            <li><strong>対応形式:</strong> ${allowedFormats}</li>
            <li><strong>最大サイズ:</strong> ${maxSizeMB}MB</li>
            <li><strong>複数ファイル:</strong> 同時アップロード可能</li>
            <li><strong>キーボード:</strong> Tabキーでフォーカス、Enterで選択</li>
          </ul>
        </div>
        
        <div id="upload-progress-${this.instanceId}" class="upload-progress" style="display: none;" role="status" aria-live="polite">
          <div id="progress-text-${this.instanceId}">アップロード中...</div>
          <div class="progress-bar">
            <div id="progress-bar-fill-${this.instanceId}" class="progress-bar-fill"></div>
          </div>
        </div>
      </div>
    `;

    this.setupUploadEvents(container);
    this.updateFocusableElements();
    Promise.resolve(this.populateUploadFolders(container)).catch((error) => {
      console.error('Failed to populate upload folders:', error);
    });
  }
  
  /**
   * アップロード関連のイベントを設定
   * @param {HTMLElement} container - コンテナ要素
   */
  setupUploadEvents(container) {
    const fileInput = container.querySelector(`#image-upload-input-${this.instanceId}`);
    const selectBtn = container.querySelector(`#upload-select-btn-${this.instanceId}`);
    const dropZone = container.querySelector(`#upload-drop-zone-${this.instanceId}`);
    const folderSelect = container.querySelector(`#upload-folder-select-${this.instanceId}`);
    const permissionWarning = container.querySelector(`#upload-permission-warning-${this.instanceId}`);

    this.uploadElements = {
      fileInput,
      selectBtn,
      dropZone,
      folderSelect,
      permissionWarning
    };

    this.toggleUploadControls(false);

    if (selectBtn && fileInput) {
      selectBtn.addEventListener('click', () => fileInput.click());
    }

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => {
        if (!fileInput.disabled) {
          fileInput.click();
        }
      });
      dropZone.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !fileInput.disabled) {
          e.preventDefault();
          fileInput.click();
        }
      });

      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
          dropZone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
          dropZone.classList.remove('dragover');
        });
      });

      dropZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        this.handleFiles(files);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        this.handleFiles(Array.from(e.target.files));
        e.target.value = '';
      });
    }

    if (folderSelect) {
      folderSelect.addEventListener('change', () => {
        this.currentUploadFolderKey = folderSelect.value;
        const enabled = this.isUploadAllowed(this.currentUploadFolderKey);
        this.toggleUploadControls(enabled);
        this.updateUploadDestinationDisplay();
      });
    }
  }
  
  /**
   * ファイルアップロードを処理（進捗表示対応）
   * @param {File[]} files - アップロードするファイル配列
   */
  async handleFiles(files) {
    if (files.length === 0) return;

    const validFiles = files.filter(file => this.options.allowedMimeTypes.includes(file.type));
    if (!validFiles.length) {
      this.handler.showMessage('サポートされている画像ファイルを選択してください', 'warning');
      return;
    }

    if (validFiles.length !== files.length) {
      this.handler.showMessage('一部のファイルはサポートされていない形式です', 'warning');
    }

    const targetFolder = this.getFolderByKey(this.currentUploadFolderKey);
    if (!targetFolder || !this.isUploadAllowed(targetFolder.key)) {
      this.handler.showMessage('アップロード先のフォルダを選択する必要があります', 'warning');
      return;
    }

    const filesToUpload = validFiles;

    const progressContainer = document.querySelector(`#upload-progress-${this.instanceId}`);
    const progressText = document.querySelector(`#progress-text-${this.instanceId}`);
    const progressBar = document.querySelector(`#progress-bar-fill-${this.instanceId}`);

    if (progressContainer && progressText && progressBar) {
      progressContainer.style.display = 'block';
      progressText.textContent = `${filesToUpload.length}個のファイルをアップロード中...`;
      progressBar.style.width = '0%';
    }

    try {
      const results = await this.handler.uploadMultipleImages(
        filesToUpload,
        this.editor,
        this.options,
        (progress) => {
          if (progressText && progressBar) {
            const percentage = Math.round((progress.completed / progress.total) * 100);
            progressText.textContent = `${progress.completed}/${progress.total} 完了 (${percentage}%)`;
            progressBar.style.width = `${percentage}%`;

            // スクリーンリーダー用
            progressContainer.setAttribute('aria-valuenow', percentage);
            progressContainer.setAttribute('aria-valuetext', `${percentage}% 完了`);
          }
        },
        targetFolder.name || ''
      );

      // 成功した場合はギャラリータブに切り替え
      if (results.success.length > 0) {
        this.shouldReloadGallery = true;
        this.currentFolderKey = targetFolder.key;
        setTimeout(() => {
          if (this.currentTab !== 'gallery') {
            this.switchTab('gallery');
          } else {
            // 既にギャラリータブの場合は再読み込み
            const content = this.modal.querySelector('.tab-content');
            this.showGalleryTab(content);
          }
        }, 1000);
      }

    } catch (error) {
      console.error('Multiple file upload failed:', error);
    } finally {
      // 進捗表示を非表示
      if (progressContainer) {
        setTimeout(() => {
          progressContainer.style.display = 'none';
        }, 2000);
      }
    }
  }
  
  /**
   * クリーンアップ処理
   */
  cleanup() {
    this.removeAccessibilityEvents();
    this.destroy();
    
    // インスタンス変数をクリア
    this.editor = null;
    this.options = null;
    this.handler = null;
    this.previousActiveElement = null;
    this.focusableElements = [];
    this.firstFocusableElement = null;
    this.lastFocusableElement = null;
  }
}
