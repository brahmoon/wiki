// =============================================================================
// DriveImageExtension 改善版の使用例
// =============================================================================

// 1. 基本的な統合例（バイナリアップロード・アクセシビリティ対応）
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { DriveImageExtension } from './extensions/driveImage/DriveImageExtension.js';

// エディターを初期化（改善版）
const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [
    StarterKit,
    Image.configure({
      inline: false,
      allowBase64: false, // バイナリアップロード優先のため無効化
      HTMLAttributes: {
        class: 'editor-image',
        loading: 'lazy', // パフォーマンス向上
      },
    }),
    // Google Drive画像機能を追加（改善版設定）
    DriveImageExtension.configure({
      // 必須: Google Apps Script WebApp URL
      webAppUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
      
      // ファイル制限（改善）
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'image/webp',
        'image/svg+xml' // SVG対応追加
      ],
      
      // アップロード設定（新機能）
      uploadTimeout: 45000, // 45秒（大きいファイル対応）
      maxConcurrentUploads: 2, // 安定性重視で2並列
      
      // ギャラリー設定（新機能）
      galleryTimeout: 20000, // 20秒
      galleryCacheTimeout: 600000, // 10分キャッシュ
      
      // UI機能設定
      enablePasteUpload: true, // ペースト自動アップロード
      enableDropUpload: true,  // ドラッグ&ドロップ自動アップロード
      
      // ツールバー設定
      addToToolbar: true,
      toolbarButtonHTML: '📁',
      toolbarButtonTitle: 'Driveから画像を挿入 (Ctrl+Shift+I)',
      toolbarSelector: '.ProseMirror-menubar',
      buttonClass: 'menubar-button',
      
      // デバッグモード
      debug: process.env.NODE_ENV === 'development'
    }),
  ],
  content: '<p>ここに画像を挿入できます...</p>',
  
  // エディターイベント
  onUpdate: ({ editor }) => {
    console.log('Content updated:', editor.getHTML());
  },
  
  onCreate: ({ editor }) => {
    console.log('Editor created with DriveImage support');
    
    // Extension の健全性チェック
    const driveExt = editor.extensionManager.extensions.find(
      ext => ext.name === 'driveImage'
    );
    
    if (driveExt) {
      const health = driveExt.healthCheck();
      if (!health.healthy) {
        console.warn('DriveImage extension issues:', health.issues);
      }
    }
  }
});

// =============================================================================
// 2. 外部CSSファイル化の例
// =============================================================================

// styles/drive-image-modal.css として分離
/*
:root {
  --drive-modal-primary: #007bff;
  --drive-modal-success: #28a745;
  --drive-modal-error: #dc3545;
  --drive-modal-warning: #ffc107;
  --drive-modal-background: rgba(0,0,0,0.6);
  --drive-modal-radius: 12px;
  --drive-modal-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.drive-image-modal {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.drive-image-modal .modal-content {
  background: white;
  border-radius: var(--drive-modal-radius);
  box-shadow: var(--drive-modal-shadow);
  ...
}

@media (prefers-color-scheme: dark) {
  :root {
    --drive-modal-primary: #0d6efd;
    --drive-modal-background: rgba(0,0,0,0.8);
  }
  
  .drive-image-modal .modal-content {
    background: #2d3748;
    color: white;
  }
}
*/

// CSS読み込み
const cssLink = document.createElement('link');
cssLink.rel = 'stylesheet';
cssLink.href = './styles/drive-image-modal.css';
document.head.appendChild(cssLink);

// =============================================================================
// 3. 複数エディター利用例（独立性確保）
// =============================================================================

// ブログ投稿エディター
const blogEditor = new Editor({
  element: document.querySelector('#blog-editor'),
  extensions: [
    StarterKit,
    DriveImageExtension.configure({
      webAppUrl: 'https://script.google.com/macros/s/BLOG_WEBAPP/exec',
      toolbarSelector: '.blog-toolbar',
      maxFileSize: 5 * 1024 * 1024, // 5MB制限
      debug: true
    })
  ]
});

// コメント投稿エディター（制限強化）
const commentEditor = new Editor({
  element: document.querySelector('#comment-editor'),
  extensions: [
    StarterKit,
    DriveImageExtension.configure({
      webAppUrl: 'https://script.google.com/macros/s/COMMENT_WEBAPP/exec',
      toolbarSelector: '.comment-toolbar',
      maxFileSize: 2 * 1024 * 1024, // 2MB制限
      allowedMimeTypes: ['image/jpeg', 'image/png'], // 形式制限
      enablePasteUpload: false, // ペースト無効
      toolbarButtonHTML: '🖼️',
      toolbarButtonTitle: '画像添付',
      debug: false
    })
  ]
});

// 各エディターは完全に独立して動作
console.log('Blog editor stats:', blogEditor.extensionManager.extensions.find(e => e.name === 'driveImage')?.getStats());
console.log('Comment editor stats:', commentEditor.extensionManager.extensions.find(e => e.name === 'driveImage')?.getStats());

// =============================================================================
// 4. プログラム的な制御例
// =============================================================================

// 画像アップロード進捗監視
class ImageUploadMonitor {
  constructor(editor) {
    this.editor = editor;
    this.activeUploads = new Set();
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    // カスタムファイル選択UI
    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = '画像をアップロード';
    uploadBtn.addEventListener('click', () => this.selectFiles());
    document.body.appendChild(uploadBtn);
    
    // 一括アップロード進捗表示
    this.progressContainer = document.createElement('div');
    this.progressContainer.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; 
      background: white; padding: 16px; border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1); display: none;
      min-width: 300px; z-index: 9998;
    `;
    document.body.appendChild(this.progressContainer);
  }
  
  async selectFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      
      this.showProgress(`${files.length}個のファイルをアップロード中...`);
      
      try {
        // DriveImageHandler を直接使用（詳細制御）
        const results = await this.uploadWithProgress(files);
        this.showResults(results);
      } catch (error) {
        console.error('Batch upload error:', error);
      } finally {
        this.hideProgress();
      }
    };
    
    input.click();
  }
  
  async uploadWithProgress(files) {
    const driveExt = this.editor.extensionManager.extensions.find(
      ext => ext.name === 'driveImage'
    );
    
    if (!driveExt) {
      throw new Error('DriveImageExtension not found');
    }
    
    // カスタム進捗コールバック
    const progressCallback = (progress) => {
      this.updateProgress(
        `${progress.completed}/${progress.total} 完了`,
        (progress.completed / progress.total) * 100
      );
    };
    
    // 並列アップロードを実行
    const { DriveImageHandler } = await import('./extensions/driveImage/DriveImageHandler.js');
    return await DriveImageHandler.uploadMultipleImages(
      files, 
      this.editor, 
      driveExt.options, 
      progressCallback
    );
  }
  
  showProgress(message) {
    this.progressContainer.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: 600;">${message}</div>
      <div style="width: 100%; height: 6px; background: #e9ecef; border-radius: 3px;">
        <div id="upload-progress-bar" style="height: 100%; background: #007bff; border-radius: 3px; width: 0%; transition: width 0.3s;"></div>
      </div>
    `;
    this.progressContainer.style.display = 'block';
  }
  
  updateProgress(message, percent) {
    const messageEl = this.progressContainer.querySelector('div');
    const progressBar = this.progressContainer.querySelector('#upload-progress-bar');
    
    if (messageEl) messageEl.textContent = message;
    if (progressBar) progressBar.style.width = `${percent}%`;
  }
  
  showResults(results) {
    const { success, errors } = results;
    const message = `完了: ${success.length}成功, ${errors.length}失敗`;
    
    this.progressContainer.innerHTML = `
      <div style="color: ${errors.length === 0 ? '#28a745' : '#dc3545'}; font-weight: 600;">
        ${message}
      </div>
      ${errors.length > 0 ? `
        <div style="font-size: 12px; margin-top: 8px; color: #6c757d;">
          失敗: ${errors.slice(0, 3).map(e => e.file).join(', ')}${errors.length > 3 ? ` 他${errors.length - 3}件` : ''}
        </div>
      ` : ''}
    `;
    
    setTimeout(() => this.hideProgress(), 3000);
  }
  
  hideProgress() {
    this.progressContainer.style.display = 'none';
  }
}

// モニター初期化
const uploadMonitor = new ImageUploadMonitor(editor);

// =============================================================================
// 5. エラーハンドリングとリトライ機能
// =============================================================================

class RobustImageUploader {
  constructor(editor) {
    this.editor = editor;
    this.retryAttempts = 3;
    this.retryDelay = 2000; // 2秒
  }
  
  async uploadWithRetry(file, options = {}) {
    const driveExt = this.editor.extensionManager.extensions.find(
      ext => ext.name === 'driveImage'
    );
    
    if (!driveExt) {
      throw new Error('DriveImageExtension not found');
    }
    
    const { DriveImageHandler } = await import('./extensions/driveImage/DriveImageHandler.js');
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`Upload attempt ${attempt}/${this.retryAttempts} for: ${file.name}`);
        
        const result = await DriveImageHandler.uploadImage(
          file, 
          this.editor, 
          driveExt.options
        );
        
        console.log(`Upload successful on attempt ${attempt}:`, result);
        return result;
        
      } catch (error) {
        console.error(`Upload attempt ${attempt} failed:`, error);
        
        if (attempt === this.retryAttempts) {
          // 最終試行でも失敗
          DriveImageHandler.showMessage(
            `"${file.name}": ${this.retryAttempts}回試行しましたが失敗しました`, 
            'error'
          );
          throw error;
        }
        
        // リトライ可能なエラーかチェック
        if (this.isRetryableError(error)) {
          DriveImageHandler.showMessage(
            `"${file.name}": ${attempt}回目失敗、${this.retryDelay/1000}秒後にリトライします`, 
            'warning'
          );
          await this.delay(this.retryDelay);
        } else {
          // リトライ不可能なエラー（バリデーションエラーなど）
          throw error;
        }
      }
    }
  }
  
  isRetryableError(error) {
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /500/i,
      /502/i,
      /503/i,
      /504/i,
      /429/i // Rate limit
    ];
    
    return retryablePatterns.some(pattern => 
      pattern.test(error.message)
    );
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// 6. ユニットテスト例（Jest）
// =============================================================================

/*
// __tests__/DriveImageExtension.test.js
import { Editor } from '@tiptap/core';
import { DriveImageExtension } from '../extensions/driveImage/DriveImageExtension';

describe('DriveImageExtension', () => {
  let editor;
  
  beforeEach(() => {
    // モックDOM環境
    document.body.innerHTML = '<div id="editor"></div><div class="toolbar"></div>';
    
    editor = new Editor({
      element: document.querySelector('#editor'),
      extensions: [
        DriveImageExtension.configure({
          webAppUrl: 'https://mock.example.com/api',
          addToToolbar: true,
          debug: true
        })
      ]
    });
  });
  
  afterEach(() => {
    editor.destroy();
    document.body.innerHTML = '';
  });
  
  test('should create extension with default options', () => {
    const driveExt = editor.extensionManager.extensions.find(
      ext => ext.name === 'driveImage'
    );
    
    expect(driveExt).toBeDefined();
    expect(driveExt.options.maxFileSize).toBe(5 * 1024 * 1024);
    expect(driveExt.options.allowedMimeTypes).toContain('image/jpeg');
  });
  
  test('should add toolbar button', () => {
    const button = document.querySelector('[data-drive-image-btn]');
    expect(button).toBeTruthy();
    expect(button.innerHTML).toBe('🖼️');
  });
  
  test('should validate file correctly', async () => {
    const { DriveImageHandler } = await import('../extensions/driveImage/DriveImageHandler');
    
    const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    const options = { allowedMimeTypes: ['image/jpeg'], maxFileSize: 1024 * 1024 };
    
    expect(DriveImageHandler.validateFile(validFile, options)).toBe(true);
    expect(DriveImageHandler.validateFile(invalidFile, options)).toBe(false);
  });
  
  test('should handle keyboard shortcuts', () => {
    const openModalSpy = jest.spyOn(editor.commands, 'openImageModal');
    
    // Ctrl+Shift+I を模擬
    const event = new KeyboardEvent('keydown', {
      key: 'i',
      ctrlKey: true,
      shiftKey: true
    });
    
    editor.view.dom.dispatchEvent(event);
    expect(openModalSpy).toHaveBeenCalled();
  });
});
*/

// =============================================================================
// 7. 実際のHTML統合例（完全版）
// =============================================================================

/*
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tiptap Editor with Drive Images</title>
  
  <!-- 外部CSSファイル -->
  <link rel="stylesheet" href="./styles/drive-image-modal.css">
  <link rel="stylesheet" href="./styles/editor.css">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f8f9fa;
    }
    
    .editor-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .toolbar {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #e9ecef;
      background: #f8f9fa;
      border-radius: 8px 8px 0 0;
    }
    
    .ProseMirror {
      padding: 20px;
      min-height: 400px;
      outline: none;
    }
    
    .editor-image {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 16px 0;
    }
    
    /* アクセシビリティ改善 */
    @media (prefers-reduced-motion: reduce) {
      * {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
      }
    }
    
    @media (prefers-color-scheme: dark) {
      body { background: #1a202c; color: white; }
      .editor-container { background: #2d3748; }
      .toolbar { background: #4a5568; border-color: #718096; }
      .ProseMirror { color: white; }
    }
  </style>
</head>
<body>
  <div class="editor-container">
    <div class="toolbar" id="toolbar">
      <!-- DriveImageExtension が自動的にボタンを追加 -->
    </div>
    <div id="editor"></div>
  </div>
  
  <!-- 進捗表示用 -->
  <div id="upload-status" style="position: fixed; bottom: 20px; left: 20px; display: none;"></div>
  
  <script type="module">
    // メイン初期化スクリプトをここに配置
    import { setupEditor } from './js/editor-setup.js';
    
    // エディター初期化
    const editor = setupEditor('#editor', {
      webAppUrl: 'YOUR_WEBAPP_URL_HERE',
      debug: true
    });
    
    // グローバルに公開（デバッグ用）
    window.editor = editor;
    
    // ページ離脱時の確認
    window.addEventListener('beforeunload', (e) => {
      if (editor.getHTML() !== '<p></p>') {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  </script>
</body>
</html>
*/

// =============================================================================
// 8. TypeScript対応例
// =============================================================================

/*
// types/drive-image.d.ts
import { Extension } from '@tiptap/core';

export interface DriveImageOptions {
  webAppUrl: string;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  uploadTimeout?: number;
  maxConcurrentUploads?: number;
  galleryTimeout?: number;
  galleryCacheTimeout?: number;
  recaptchaSiteKey?: string | null;
  addToToolbar?: boolean;
  toolbarButtonHTML?: string;
  toolbarButtonTitle?: string;
  toolbarSelector?: string;
  buttonClass?: string;
  enablePasteUpload?: boolean;
  enableDropUpload?: boolean;
  debug?: boolean;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  id?: string;
  name?: string;
  error?: string;
  uploadMethod?: 'binary' | 'base64';
  uploadTime?: number;
  fileName?: string;
}

export interface UploadProgress {
  completed: number;
  total: number;
  file: string;
  status: 'success' | 'error';
  error?: string;
}

export declare const DriveImageExtension: Extension<DriveImageOptions>;

export declare class DriveImageHandler {
  static uploadImage(
    file: File, 
    editor: any, 
    options: DriveImageOptions
  ): Promise<UploadResult>;
  
  static uploadMultipleImages(
    files: File[], 
    editor: any, 
    options: DriveImageOptions,
    progressCallback?: (progress: UploadProgress) => void
  ): Promise<{ success: UploadResult[]; errors: any[] }>;
  
  static loadGallery(options: DriveImageOptions): Promise<any[]>;
  static validateFile(file: File, options: DriveImageOptions): boolean;
  static showMessage(message: string, type?: 'success' | 'error' | 'warning' | 'info'): void;
}
*/

export { 
  editor, 
  blogEditor, 
  commentEditor, 
  ImageUploadMonitor, 
  RobustImageUploader,
  uploadMonitor 
};