// CORS対応版 DriveImageHandler - プリフライトリクエストを回避
/**
 * Google Drive画像アップロード・ギャラリー取得を行うハンドラークラス（CORS対応）
 * @class DriveImageHandler
 */
export class DriveImageHandler {
  static ROOT_FOLDER_KEY = '__root__';
  static DEFAULT_PERMISSION_CACHE_TTL = 5 * 60 * 1000;

  /**
   * 画像ファイルをGoogle Driveにアップロード（CORS対応版）
   * @param {File} file - アップロードするファイル
   * @param {Object} editor - Tiptapエディターインスタンス
   * @param {Object} options - 設定オプション
   * @returns {Promise<Object>} アップロード結果
   */
  static async uploadImage(file, editor, options, folderName = null) {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      if (!this.validateFile(file, options)) {
        throw new Error(`ファイル検証に失敗: ${file.name}`);
      }

      this.showLoading(`"${file.name}" をアップロード中...`);

      // Base64に変換（プリフライトリクエストを回避するため）
      const base64Data = await this.fileToBase64(file);

      const normalizedFolder = this.normalizeFolderName(folderName, options);

      // リクエストデータを作成
      const requestData = {
        file: base64Data,
        filename: file.name,
        mimetype: file.type,
        size: file.size.toString(),
        uploadId: uploadId,
        method: 'base64',
        folderName: normalizedFolder || undefined
      };
      
      const startTime = Date.now();
      
      // Content-Type: text/plain でPOSTリクエストを送信（プリフライト回避）
      const response = await this.fetchWithoutPreflight(options.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain', // 重要: application/jsonではなくtext/plain
        },
        body: JSON.stringify(requestData), // JSONを文字列として送信
      }, options.uploadTimeout || 30000);
      
      const uploadTime = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
      //  サムネイルURLでTiptapエディターに画像を挿入
      //  editor.chain().focus().setImage({
      //    src: result.driveUrl, // サムネイルURL
      //    alt: result.fileName || file.name,
      //    'data-drive-id': result.driveId,
      //    'data-upload-method': result.method,
      //    'data-upload-time': uploadTime.toString()
      //  }).run();
        
        this.hideLoading();
        this.showMessage(
          `"${file.name}" をアップロードしました (${result.method}, ${uploadTime}ms)`, 
          'success'
        );
        
        return {
          ...result,
          uploadTime,
          fileName: file.name
        };
      } else {
        throw new Error(`アップロードに失敗: ${result.error || '原因不明'}`);
      }
      
    } catch (error) {
      console.error(`Upload error for "${file.name}":`, error);
      this.hideLoading();
      
      // 詳細なエラー情報をユーザーに表示
      const errorMessage = this.formatUploadError(error, file.name);
      this.showMessage(errorMessage, 'error');
      
      // エラーオブジェクトに詳細情報を追加
      const enrichedError = new Error(errorMessage);
      enrichedError.fileName = file.name;
      enrichedError.fileSize = file.size;
      enrichedError.originalError = error;
      enrichedError.uploadId = uploadId;
      
      throw enrichedError;
    }
  }
  
  /**
   * 画像を削除
   * @param {string} imageId - 削除する画像のDrive ID
   * @param {Object} options - 設定オプション
   * @returns {Promise<Object>} 削除結果
   */
  static async deleteImage(imageId, options) {
    try {
      if (!imageId) {
        throw new Error('画像IDが指定されていません');
      }
      
      this.showLoading('画像を削除中...');
      
      // プリフライトを発生させない text/plain POST を使用して削除リクエストを送信
      const response = await this.fetchWithoutPreflight(
        options.webAppUrl,
        {
          method: 'POST',
          body: JSON.stringify({
            method: 'delete',
            id: imageId,
            imageId
          })
        },
        options.uploadTimeout || 15000
      );
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
      }
      
      const result = await response.json();
      
      this.hideLoading();
      
      if (result.success) {
        this.showMessage('画像を削除しました', 'success');
        return result;
      } else {
        throw new Error(result.error || '削除に失敗しました');
      }
      
    } catch (error) {
      console.error('Delete error:', error);
      this.hideLoading();
      this.showMessage(`削除エラー: ${error.message}`, 'error');
      throw error;
    }
  }
  
  /**
   * プリフライトリクエストを回避するためのfetch実装
   * @param {string} url - リクエストURL
   * @param {Object} options - fetchオプション
   * @param {number} timeout - タイムアウト時間(ms)
   * @returns {Promise<Response>} レスポンス
   */
  static fetchWithoutPreflight(url, options, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`アップロードタイムアウト (${timeout}ms)`));
      }, timeout);
      
      // Content-Type: text/plain を使用してプリフライトリクエストを回避
      const fetchOptions = {
        ...options,
        headers: {
          'Content-Type': 'text/plain', // 重要: プリフライトリクエストを回避
          ...options.headers
        },
        signal: controller.signal,
        mode: 'cors', // CORSモードで送信
        credentials: 'omit' // 認証情報は送信しない
      };
      
      fetch(url, fetchOptions)
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          reject(new Error(`アップロードタイムアウト (${timeout}ms)`));
        } else {
          reject(error);
        }
      });
    });
  }
  
  /**
   * タイムアウト付きfetch（GET用）
   * @param {string} url - リクエストURL
   * @param {Object} options - fetchオプション
   * @param {number} timeout - タイムアウト時間(ms)
   * @returns {Promise<Response>} レスポンス
   */
  static fetchWithTimeout(url, options, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`リクエストタイムアウト (${timeout}ms)`));
      }, timeout);
      
      fetch(url, {
        ...options,
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      })
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          reject(new Error(`リクエストタイムアウト (${timeout}ms)`));
        } else {
          reject(error);
        }
        });
    });
  }
  
  /**
   * アップロードエラーを分かりやすい形式にフォーマット
   * @param {Error} error - 元のエラー
   * @param {string} fileName - ファイル名
   * @returns {string} フォーマット済みエラーメッセージ
   */
  static formatUploadError(error, fileName) {
    const baseMessage = `"${fileName}" のアップロードに失敗しました`;
    
    if (error.message.includes('timeout')) {
      return `${baseMessage}: 通信タイムアウト`;
    } else if (error.message.includes('HTTP 413')) {
      return `${baseMessage}: ファイルサイズが大きすぎます`;
    } else if (error.message.includes('HTTP 429')) {
      return `${baseMessage}: アクセス制限中です。しばらく待ってから再試行してください`;
    } else if (error.message.includes('HTTP')) {
      return `${baseMessage}: サーバーエラー (${error.message.split('\n')[0]})`;
    } else if (error.message.includes('ファイル検証')) {
      return error.message;
    } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      return `${baseMessage}: ネットワークエラー。インターネット接続を確認してください`;
    } else if (error.message.includes('CORS')) {
      return `${baseMessage}: アクセス制限エラー。しばらく待ってから再試行してください`;
    } else {
      return `${baseMessage}: ${error.message}`;
    }
  }
  
  /**
   * 複数ファイルの並列アップロード
   * @param {File[]} files - アップロードするファイル配列
   * @param {Object} editor - Tiptapエディターインスタンス
   * @param {Object} options - 設定オプション
   * @param {Function} progressCallback - 進捗コールバック
   * @returns {Promise<Object>} アップロード結果統計
   */
  static async uploadMultipleImages(files, editor, options, progressCallback = null, folderName = null) {
    if (!files || files.length === 0) return { success: [], errors: [] };

    const results = { success: [], errors: [] };
    const maxConcurrent = Math.min(options.maxConcurrentUploads || 2, 2); // CORS回避のため最大2並列

    // ファイルをチャンクに分割して並列処理
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const chunk = files.slice(i, i + maxConcurrent);
      const promises = chunk.map(async (file) => {
        try {
          const result = await this.uploadImage(file, editor, options, folderName);
          results.success.push(result);
          
          if (progressCallback) {
            progressCallback({
              completed: results.success.length + results.errors.length,
              total: files.length,
              file: file.name,
              status: 'success'
            });
          }
          
        } catch (error) {
          results.errors.push({
            file: file.name,
            error: error.message,
            originalError: error
          });
          
          if (progressCallback) {
            progressCallback({
              completed: results.success.length + results.errors.length,
              total: files.length,
              file: file.name,
              status: 'error',
              error: error.message
            });
          }
        }
      });
      
      await Promise.all(promises);
      
      // CORS制限回避のため、チャンク間に短い遅延を追加
      if (i + maxConcurrent < files.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // 結果サマリーを表示
    this.showUploadSummary(results, files.length);
    
    return results;
  }
  
  /**
   * アップロード結果サマリーを表示
   * @param {Object} results - アップロード結果
   * @param {number} totalFiles - 総ファイル数
   */
  static showUploadSummary(results, totalFiles) {
    const successCount = results.success.length;
    const errorCount = results.errors.length;
    
    if (errorCount === 0) {
      this.showMessage(`${successCount}個のファイルをアップロードしました`, 'success');
    } else if (successCount === 0) {
      this.showMessage(`${errorCount}個のファイルのアップロードに失敗しました`, 'error');
    } else {
      this.showMessage(
        `${successCount}個成功、${errorCount}個失敗 (計${totalFiles}個)`, 
        'warning'
      );
      
      // 失敗したファイルの詳細を別途表示
      if (results.errors.length <= 3) {
        results.errors.forEach(error => {
          this.showMessage(`${error.file}: ${error.error}`, 'error');
        });
      } else {
        this.showMessage(
          `失敗したファイル: ${results.errors.slice(0, 2).map(e => e.file).join(', ')} 他${results.errors.length - 2}件`,
          'error'
        );
      }
    }
  }
  
  /**
   * ファイルバリデーション（詳細エラー情報付き）
   * @param {File} file - 検証するファイル
   * @param {Object} options - 設定オプション
   * @returns {boolean} バリデーション結果
   */
  static validateFile(file, options) {
    if (!file || !file.type) {
      this.showMessage(`"${file?.name || '不明なファイル'}": ファイルタイプを取得できません`, 'error');
      return false;
    }
    
    if (!options.allowedMimeTypes.includes(file.type)) {
      const allowedFormats = options.allowedMimeTypes
        .map(type => type.split('/')[1].toUpperCase())
        .join(', ');
      this.showMessage(
        `"${file.name}": サポートされていない形式です (対応: ${allowedFormats})`, 
        'error'
      );
      return false;
    }
    
    if (file.size > options.maxFileSize) {
      const maxSizeMB = (options.maxFileSize / (1024 * 1024)).toFixed(1);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      this.showMessage(
        `"${file.name}": ファイルサイズが制限を超えています (${fileSizeMB}MB > ${maxSizeMB}MB)`, 
        'error'
      );
      return false;
    }
    
    // ファイル名の妥当性チェック
    if (file.name.length > 255) {
      this.showMessage(`"${file.name}": ファイル名が長すぎます (255文字以下)`, 'error');
      return false;
    }
    
    // 危険な文字をチェック
    const dangerousChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (dangerousChars.test(file.name)) {
      this.showMessage(`"${file.name}": ファイル名に使用できない文字が含まれています`, 'error');
      return false;
    }
    
    return true;
  }
  
  /**
   * ファイルをBase64文字列に変換（エラーハンドリング強化）
   * @param {File} file - 変換するファイル
   * @returns {Promise<string>} Base64文字列
   */
  static fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file || !(file instanceof File)) {
        reject(new Error('有効なファイルが指定されていません'));
        return;
      }
      
      const reader = new FileReader();
      const timeout = setTimeout(() => {
        reader.abort();
        reject(new Error(`ファイル読み込みタイムアウト: ${file.name}`));
      }, 30000); // 30秒タイムアウト
      
      reader.onload = () => {
        clearTimeout(timeout);
        resolve(reader.result);
      };
      
      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`ファイル読み込みエラー: ${file.name} - ${reader.error?.message || '原因不明'}`));
      };
      
      reader.onabort = () => {
        clearTimeout(timeout);
        reject(new Error(`ファイル読み込み中止: ${file.name}`));
      };
      
      try {
        reader.readAsDataURL(file);
      } catch (error) {
        clearTimeout(timeout);
        reject(new Error(`ファイル読み込み開始エラー: ${file.name} - ${error.message}`));
      }
    });
  }
  
  /**
   * Google Driveから画像ギャラリーを取得（毎回リフレッシュ）
   * @param {Object} options - 設定オプション
   * @returns {Promise<Array>} 画像リスト
   */
  static async loadGallery(options) {
    try {
      if (options.debug) {
        console.log('Loading gallery from Drive...');
      }
      
      // 毎回新しいデータを取得（キャッシュ回避）
      const response = await this.fetchWithTimeout(
        `${options.webAppUrl}?action=gallery&_t=${Date.now()}`,
        { 
          method: 'GET',
          mode: 'cors',
          credentials: 'omit'
        },
        options.galleryTimeout || 15000
      );
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
      }
      
      const result = await response.json();

      if (result.success) {
        const folders = this.extractGalleryFolders(result);

        if (options.debug) {
          const totalImages = folders.reduce((sum, folder) => sum + folder.images.length, 0);
          console.log(`Loaded ${folders.length} folders and ${totalImages} images from gallery`);
        }

        return {
          folders,
          updatedAt: result.updatedAt || null
        };
      } else {
        throw new Error(result.error || 'ギャラリーの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Gallery load error:', error);
      this.showMessage(`ギャラリー読み込みエラー: ${this.formatGalleryError(error)}`, 'error');
      return { folders: [] };
    }
  }
  
  /**
   * ギャラリーエラーをフォーマット
   * @param {Error} error - エラーオブジェクト
   * @returns {string} フォーマット済みエラーメッセージ
   */
  static formatGalleryError(error) {
    if (error.message.includes('timeout')) {
      return '通信タイムアウト';
    } else if (error.message.includes('HTTP 403')) {
      return 'アクセス権限がありません';
    } else if (error.message.includes('HTTP 429')) {
      return 'アクセス制限中です。しばらく待ってから再試行してください';
    } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      return 'ネットワークエラー';
    } else if (error.message.includes('CORS')) {
      return 'アクセス制限エラー';
    } else {
      return error.message;
    }
  }

  static sanitizeFolderLabel(label) {
    return (label || '').toString().trim();
  }

  static getFolderKey(label) {
    const sanitized = this.sanitizeFolderLabel(label);
    return sanitized || this.ROOT_FOLDER_KEY;
  }

  static normalizeFolderName(folderName, options) {
    const provided = (folderName || '').toString().trim();
    const fallback = options && typeof options.defaultFolderName === 'string'
      ? options.defaultFolderName.toString().trim()
      : '';
    const candidate = provided || fallback;
    if (!candidate || candidate === this.ROOT_FOLDER_KEY) {
      return '';
    }
    return candidate.replace(/[\\/]/g, '').trim();
  }

  static normalizeImageRecord(image, folderLabel, folderKey, actualName = '') {
    if (!image || typeof image !== 'object') {
      return null;
    }
    const normalized = { ...image };
    normalized.folderName = actualName || folderLabel;
    normalized.folderDisplayName = folderLabel;
    normalized.folderKey = folderKey;
    normalized.thumbnail = normalized.thumbnail || normalized.url || '';
    normalized.name = normalized.name || normalized.filename || normalized.fileName || '';
    return normalized;
  }

  static normalizeFolderMetadata(folder) {
    if (!folder || typeof folder !== 'object') {
      return null;
    }
    const rawName = typeof folder.name === 'string' ? folder.name : '';
    const label = this.sanitizeFolderLabel(folder.displayName || folder.label || rawName);
    const key = folder.key ? this.getFolderKey(folder.key) : this.getFolderKey(rawName || label);
    const images = Array.isArray(folder.images)
      ? folder.images
          .map((image) => this.normalizeImageRecord(image, label || rawName || '', key, rawName))
          .filter(Boolean)
      : [];
    return {
      id: folder.id || key,
      name: rawName,
      displayName: label || rawName || '未分類',
      key,
      path: folder.path || '',
      imageCount: typeof folder.imageCount === 'number' ? folder.imageCount : images.length,
      images
    };
  }

  static extractGalleryFolders(result) {
    const folders = [];
    if (Array.isArray(result?.folders)) {
      result.folders.forEach((folder) => {
        const normalized = this.normalizeFolderMetadata(folder);
        if (normalized) {
          folders.push(normalized);
        }
      });
    }

    if ((!folders.length || result?.includeRoot) && Array.isArray(result?.images)) {
      const key = this.ROOT_FOLDER_KEY;
      const rawName = '';
      const label = this.sanitizeFolderLabel(result.rootName) || '未分類';
      const images = result.images
        .map((image) => this.normalizeImageRecord(image, label, key, rawName))
        .filter(Boolean);

      folders.push({
        id: key,
        name: rawName,
        displayName: label,
        key,
        path: '',
        imageCount: images.length,
        images
      });
    }

    return folders;
  }

  static resolveRole(options) {
    if (!options) {
      return null;
    }
    if (options.userRole) {
      const role = options.userRole.toString().trim();
      if (role) {
        return role;
      }
    }
    const authority = options.userAuthority;
    const numeric = Number(authority);
    if (Number.isFinite(numeric)) {
      if (numeric >= 3) {
        return 'Moderator';
      }
      if (numeric >= 2) {
        return 'Editor';
      }
    }
    return null;
  }

  static getPermissionCacheKey(options) {
    const role = this.resolveRole(options);
    return role ? role.toLowerCase() : null;
  }

  static getCachedPermissions(options) {
    const cacheKey = this.getPermissionCacheKey(options);
    if (!cacheKey) {
      return {};
    }
    const cached = this.permissionCache.get(cacheKey);
    return cached ? cached.data : {};
  }

  static normalizePermissions(rawPermissions) {
    if (!rawPermissions || typeof rawPermissions !== 'object') {
      return {};
    }
    const normalized = {};
    Object.keys(rawPermissions).forEach((key) => {
      const label = this.sanitizeFolderLabel(key);
      const folderKey = this.getFolderKey(label || key);
      const value = rawPermissions[key] || {};
      normalized[folderKey] = {
        label: label || '',
        upload: Boolean(value.upload),
        delete: Boolean(value.delete)
      };
    });
    return normalized;
  }

  static async fetchPermissions(options, role) {
    if (!options?.permissionsEndpoint || !role) {
      return {};
    }

    try {
      const response = await fetch(options.permissionsEndpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({
          action: 'getDriveImagePermissions',
          role,
          authority: options.userAuthority ?? null
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const result = await response.json().catch(() => null);
      if (result && result.success) {
        return this.normalizePermissions(result.permissions);
      }
    } catch (error) {
      console.error('Failed to fetch drive image permissions:', error);
    }

    return {};
  }

  static async ensurePermissions(options) {
    const cacheKey = this.getPermissionCacheKey(options);
    if (!cacheKey) {
      return {};
    }

    const cached = this.permissionCache.get(cacheKey);
    const ttl = options?.permissionCacheTimeout || this.DEFAULT_PERMISSION_CACHE_TTL;
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    const role = this.resolveRole(options);
    if (!role) {
      this.permissionCache.set(cacheKey, { data: {}, timestamp: Date.now() });
      return {};
    }

    const permissions = await this.fetchPermissions(options, role);
    this.permissionCache.set(cacheKey, { data: permissions, timestamp: Date.now() });
    return permissions;
  }

  static async getPermissions(options) {
    return this.ensurePermissions(options);
  }

  /**
   * 簡易キャッシュ管理（削除機能追加）
   */
  static cache = new Map();
  static permissionCache = new Map();
  
  static getCache(key) {
    return this.cache.get(key);
  }
  
  static setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // キャッシュサイズ制限（最大50エントリ）
    if (this.cache.size > 50) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
  
  static clearCache() {
    this.cache.clear();
    this.permissionCache.clear();
  }
  
  /**
   * ローディング表示（プログレス対応）
   * @param {string} message - 表示メッセージ
   * @param {number} progress - 進捗率（0-100）
   */
  static showLoading(message, progress = null) {
    let loading = document.getElementById('drive-loading');
    if (!loading) {
      loading = document.createElement('div');
      loading.id = 'drive-loading';
      loading.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); display: flex; align-items: center;
        justify-content: center; z-index: 10000; color: white; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      
      loading.innerHTML = `
        <div style="text-align: center; padding: 24px; background: rgba(0,0,0,0.8); border-radius: 8px; min-width: 300px;">
          <div id="loading-message" style="font-size: 16px; margin-bottom: 16px;"></div>
          <div id="loading-progress" style="width: 100%; height: 4px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden; display: none;">
            <div id="loading-progress-bar" style="height: 100%; background: #007bff; transition: width 0.3s ease; width: 0%;"></div>
          </div>
        </div>
      `;
      
      document.body.appendChild(loading);
    }
    
    const messageEl = loading.querySelector('#loading-message');
    const progressEl = loading.querySelector('#loading-progress');
    const progressBarEl = loading.querySelector('#loading-progress-bar');
    
    if (messageEl) messageEl.textContent = message;
    
    if (progress !== null && progressEl && progressBarEl) {
      progressEl.style.display = 'block';
      progressBarEl.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    } else if (progressEl) {
      progressEl.style.display = 'none';
    }
    
    loading.style.display = 'flex';
  }
  
  /**
   * ローディング非表示
   */
  static hideLoading() {
    const loading = document.getElementById('drive-loading');
    if (loading) loading.style.display = 'none';
  }
  
  /**
   * トーストメッセージ表示（改善版）
   * @param {string} message - メッセージ内容
   * @param {string} type - メッセージタイプ ('success', 'error', 'warning', 'info')
   */
  static showMessage(message, type = 'info') {
    const toastContainer = this.getOrCreateToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'drive-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    const typeIcons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    const typeColors = {
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      info: '#007bff'
    };
    
    toast.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 16px; flex-shrink: 0;">${typeIcons[type] || typeIcons.info}</span>
        <span style="flex: 1; word-break: break-word;">${message}</span>
        <button class="toast-close" style="background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 0; margin-left: 8px; font-size: 18px; line-height: 1;" aria-label="閉じる">×</button>
      </div>
    `;
    
    toast.style.cssText = `
      background: ${typeColors[type] || typeColors.info};
      color: white; padding: 12px 16px; border-radius: 6px; margin-bottom: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 400px; word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px; line-height: 1.4; opacity: 0; transform: translateX(100%);
      transition: all 0.3s ease-out; pointer-events: auto;
    `;
    
    // 閉じるボタンのイベント
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.removeToast(toast));
    
    toastContainer.appendChild(toast);
    
    // フェードイン
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });
    
    // 自動削除（エラーメッセージは長めに表示）
    const autoHideDelay = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
    setTimeout(() => this.removeToast(toast), autoHideDelay);
  }
  
  /**
   * トーストコンテナを取得または作成
   * @returns {HTMLElement} トーストコンテナ
   */
  static getOrCreateToastContainer() {
    let container = document.getElementById('drive-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'drive-toast-container';
      container.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10001;
        display: flex; flex-direction: column; pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    return container;
  }
  
  /**
   * トーストを削除
   * @param {HTMLElement} toast - 削除するトースト要素
   */
  static removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }
}


