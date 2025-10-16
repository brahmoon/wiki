const AUTH_CONFIG = {
  SHEET_ID: '1mVVuS5bS50-YoVQyDIOM09Oi2YIpRIyIAfXDeBcw6N8',
  SHEET_NAME: 'Accounts',
  HEADER_ROW_INDEX: 1,
  LOGIN_ID_COLUMN: 1,
  USERNAME_COLUMN: 2,
  EMAIL_COLUMN: 3,
  AUTHORITY_COLUMN: 6,
  UPDATED_AT_COLUMN: 7,
  ALLOWED_UPDATE_AUTHORITY_VALUES: [-1, 1, 2, 3],
  ALLOWED_ORIGINS: [
    'https://brahmoon.github.io',
    'http://localhost:3000',
    'http://localhost:4173'
  ],
  DEFAULT_REQUIRED_LOGIN_ID: 'admin'
};

const PLUGIN_CONFIG = {
  SHEET_NAME: 'Plugins',
  TOOLBAR_RANGE: 'A1',
  TOOLBAR_KEYS: [
    'bold',
    'italic',
    'link',
    'pageLink',
    'heading1',
    'heading2',
    'heading3',
    'bulletList',
    'orderedList',
    'blockquote',
    'codeBlock',
    'table',
    'driveImage'
  ]
};

function doGet(e) {
  return createJsonOutput(
    {
      success: true,
      message: 'Authorization endpoint is running',
      timestamp: new Date().toISOString()
    },
    getRequestOrigin(e)
  );
}

function doPost(e) {
  const origin = getRequestOrigin(e);
  try {
    const request = parseRequest(e);
    const action = (request.action || 'verifyAdminAccess').toString();

    const sheet = getAccountsSheet();
    if (!sheet) {
      return buildResponse(
        {
          success: false,
          message: `シート「${AUTH_CONFIG.SHEET_NAME}」が見つかりません。`
        },
        origin
      );
    }

    let result;

    if (action === 'verifyAdminAccess') {
      result = verifyAdminAccess(sheet, request);
    } else if (action === 'updateAuthority') {
      result = updateAuthority(sheet, request);
    } else if (action === 'getToolbarPlugins') {
      result = getToolbarPlugins();
    } else if (action === 'updateToolbarPlugins') {
      result = updateToolbarPlugins(sheet, request);
    } else {
      result = {
        success: false,
        message: `Unknown action: ${action}`
      };
    }

    return buildResponse(result, origin);
  } catch (error) {
    const message = error && error.message ? error.message : error;
    return buildResponse(
      {
        success: false,
        message: `処理中にエラーが発生しました: ${message}`
      },
      origin
    );
  }
}

function doOptions(e) {
  return createPreflightResponse(getRequestOrigin(e));
}

function verifyAdminAccess(sheet, request) {
  const normalizedLoginId = normalizeId(request.loginId);
  const normalizedEmail = normalizeId(request.email);
  const normalizedGoogleEmail = normalizeId(request.googleEmail);

  if (!normalizedLoginId && !normalizedEmail && !normalizedGoogleEmail) {
    return {
      success: false,
      message: '管理者アカウント情報が不足しています。'
    };
  }

  const account = findAccount(sheet, {
    loginId: request.loginId,
    email: request.email,
    googleEmail: request.googleEmail
  });

  if (!account) {
    return {
      success: false,
      message: '管理者アカウントが登録されていません。'
    };
  }

  const normalizedAccountLoginId = normalizeId(account.loginId);
  const adminLoginId = normalizeId(AUTH_CONFIG.DEFAULT_REQUIRED_LOGIN_ID);

  if (!adminLoginId || normalizedAccountLoginId !== adminLoginId) {
    return {
      success: false,
      message: '管理者権限がありません。'
    };
  }

  const normalizedAccountEmail = normalizeId(account.email);
  const normalizedRequestEmail = normalizedGoogleEmail || normalizedEmail;
  if (normalizedRequestEmail && normalizedAccountEmail && normalizedRequestEmail !== normalizedAccountEmail) {
    return {
      success: false,
      message: '管理者アカウントのメールアドレスが一致しません。'
    };
  }

  return {
    success: true,
    message: '管理者権限が確認されました。',
    loginId: account.loginId,
    username: account.username,
    email: account.email,
    googleAccountEmail: request.googleEmail || account.email || ''
  };
}

function updateAuthority(sheet, request) {
  const verification = verifyAdminAccess(sheet, request);
  if (!verification.success) {
    return verification;
  }

  const normalizedTargetLoginId = normalizeId(request.targetLoginId);
  if (!normalizedTargetLoginId) {
    return {
      success: false,
      message: '対象ユーザーが指定されていません。'
    };
  }

  const adminLoginId = normalizeId(AUTH_CONFIG.DEFAULT_REQUIRED_LOGIN_ID);
  if (adminLoginId && normalizedTargetLoginId === adminLoginId) {
    return {
      success: false,
      message: '管理者アカウントの権限は変更できません。'
    };
  }

  const authorityValue = parseAuthorityValue(request.authority);
  if (authorityValue === null) {
    return {
      success: false,
      message: '権限レベルが指定されていません。'
    };
  }

  const allowedValues = AUTH_CONFIG.ALLOWED_UPDATE_AUTHORITY_VALUES || [];
  if (allowedValues.length && allowedValues.indexOf(authorityValue) === -1) {
    return {
      success: false,
      message: '指定された権限レベルは設定できません。'
    };
  }

  const updateResult = applyAuthorityUpdate(sheet, normalizedTargetLoginId, authorityValue);
  if (!updateResult.success) {
    return updateResult;
  }

  return {
    success: true,
    message: updateResult.message,
    updatedAuthority: authorityValue,
    updatedAt: updateResult.updatedAt,
    targetLoginId: updateResult.targetLoginId
  };
}

function parseAuthorityValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const number = Number(trimmed);
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

function getToolbarPlugins() {
  const states = loadToolbarStates();
  return {
    success: true,
    message: 'Toolbar plugin states retrieved.',
    toolbarConfig: buildToolbarConfigResponse(states)
  };
}

function updateToolbarPlugins(sheet, request) {
  const verification = verifyAdminAccess(sheet, request);
  if (!verification.success) {
    return verification;
  }

  const states = extractToolbarStates(request);
  if (!states) {
    return {
      success: false,
      message: '有効にするツールの情報が正しく送信されていません。'
    };
  }

  const savedStates = saveToolbarStates(states);

  return {
    success: true,
    message: 'TipTapツールバーの設定を保存しました。',
    toolbarConfig: buildToolbarConfigResponse(savedStates)
  };
}

function applyAuthorityUpdate(sheet, normalizedTargetLoginId, authorityValue) {
  const authorityColumn = AUTH_CONFIG.AUTHORITY_COLUMN;
  if (!authorityColumn) {
    return {
      success: false,
      message: '権限列が設定されていません。'
    };
  }

  const firstDataRow = AUTH_CONFIG.HEADER_ROW_INDEX + 1;
  const lastRow = sheet.getLastRow();

  if (lastRow < firstDataRow) {
    return {
      success: false,
      message: '対象ユーザーが見つかりません。'
    };
  }

  const totalRows = lastRow - AUTH_CONFIG.HEADER_ROW_INDEX;
  const range = sheet.getRange(firstDataRow, 1, totalRows, sheet.getLastColumn());
  const values = range.getValues();

  const loginIndex = AUTH_CONFIG.LOGIN_ID_COLUMN - 1;
  const updatedAtColumn = AUTH_CONFIG.UPDATED_AT_COLUMN;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowLoginId = loginIndex >= 0 ? normalizeId(row[loginIndex]) : '';

    if (rowLoginId === normalizedTargetLoginId) {
      const rowNumber = firstDataRow + i;
      sheet.getRange(rowNumber, authorityColumn).setValue(authorityValue);

      let updatedAtIso = '';
      if (updatedAtColumn) {
        const now = new Date();
        sheet.getRange(rowNumber, updatedAtColumn).setValue(now);
        updatedAtIso = now.toISOString();
      }

      return {
        success: true,
        message: '権限レベルを更新しました。',
        targetLoginId: row[loginIndex] || '',
        updatedAuthority: authorityValue,
        updatedAt: updatedAtIso
      };
    }
  }

  return {
    success: false,
    message: '対象ユーザーが見つかりません。'
  };
}

function buildRequiredLoginIds(request) {
  const candidates = [];

  const allowedLoginIds = Array.isArray(request.allowedLoginIds)
    ? request.allowedLoginIds
    : [];
  const hasAllowedLoginIds = allowedLoginIds.length > 0;

  allowedLoginIds.forEach((value) => {
    const normalized = normalizeId(value);
    if (normalized) {
      candidates.push(normalized);
    }
  });

  const normalizedRequiredLoginId = normalizeId(request.requiredLoginId);
  const hasExplicitRequiredLoginId = Boolean(normalizedRequiredLoginId);
  if (normalizedRequiredLoginId) {
    candidates.push(normalizedRequiredLoginId);
  }

  const normalizedLoginId = normalizeId(request.loginId);
  if (normalizedLoginId) {
    candidates.push(normalizedLoginId);
  }

  if (!hasAllowedLoginIds && !hasExplicitRequiredLoginId) {
    const defaultLoginId = normalizeId(AUTH_CONFIG.DEFAULT_REQUIRED_LOGIN_ID);
    if (defaultLoginId) {
      candidates.push(defaultLoginId);
    }
  }

  const unique = {};
  const uniqueList = [];
  candidates.forEach((value) => {
    if (value && !unique[value]) {
      unique[value] = true;
      uniqueList.push(value);
    }
  });

  return uniqueList;
}

function parseRequest(e) {
  const data = parseRequestData(e);
  return {
    action: data.action,
    loginId: data.loginId || data.expectedLoginId || '',
    email: data.email || '',
    googleEmail: data.googleEmail || data.googleAccountEmail || data.email || '',
    requiredLoginId: data.requiredLoginId || data.expectedLoginId || '',
    allowedLoginIds: Array.isArray(data.allowedLoginIds) ? data.allowedLoginIds : [],
    targetLoginId: data.targetLoginId || data.memberLoginId || '',
    authority: data.authority !== undefined ? data.authority : data.role,
    toolbarStates: data.toolbarStates,
    toolbarKeys: data.toolbarKeys,
    toolbarConfig: data.toolbarConfig
  };
}

function parseRequestData(e) {
  const data = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach((key) => {
      const value = e.parameter[key];
      data[key] = Array.isArray(value) ? value[0] : value;
    });
  }

  if (e && e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(e.postData.contents);
      Object.keys(parsed || {}).forEach((key) => {
        data[key] = parsed[key];
      });
    } catch (error) {
      data.rawBody = e.postData.contents;
      throw new Error('リクエストの解析に失敗しました。');
    }
  }

  return data;
}

function getSpreadsheet() {
  if (AUTH_CONFIG.SHEET_ID) {
    return SpreadsheetApp.openById(AUTH_CONFIG.SHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getAccountsSheet() {
  const spreadsheet = getSpreadsheet();
  return spreadsheet ? spreadsheet.getSheetByName(AUTH_CONFIG.SHEET_NAME) : null;
}

function getPluginsSheet(createIfMissing) {
  const spreadsheet = getSpreadsheet();
  if (!spreadsheet) {
    return null;
  }

  let sheet = spreadsheet.getSheetByName(PLUGIN_CONFIG.SHEET_NAME);
  if (!sheet && createIfMissing) {
    sheet = spreadsheet.insertSheet(PLUGIN_CONFIG.SHEET_NAME);
  }

  return sheet;
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function findAccount(sheet, identifiers) {
  const lastRow = sheet.getLastRow();
  const firstDataRow = AUTH_CONFIG.HEADER_ROW_INDEX + 1;
  if (lastRow < firstDataRow) {
    return null;
  }

  const totalRows = lastRow - AUTH_CONFIG.HEADER_ROW_INDEX;
  const range = sheet.getRange(firstDataRow, 1, totalRows, sheet.getLastColumn());
  const values = range.getValues();

  const normalizedGoogleEmail = normalizeId(identifiers.googleEmail);
  const normalizedLoginId = normalizeId(identifiers.loginId);
  const normalizedEmail = normalizeId(identifiers.email);

  const loginIndex = AUTH_CONFIG.LOGIN_ID_COLUMN - 1;
  const usernameIndex = AUTH_CONFIG.USERNAME_COLUMN - 1;
  const emailIndex = AUTH_CONFIG.EMAIL_COLUMN - 1;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowLoginId = loginIndex >= 0 ? normalizeId(row[loginIndex]) : '';
    const rowEmail = emailIndex >= 0 ? normalizeId(row[emailIndex]) : '';

    if (normalizedGoogleEmail && rowEmail === normalizedGoogleEmail) {
      return {
        loginId: row[loginIndex] || '',
        username: usernameIndex >= 0 ? row[usernameIndex] || '' : '',
        email: row[emailIndex] || ''
      };
    }

    if (normalizedLoginId && rowLoginId === normalizedLoginId) {
      return {
        loginId: row[loginIndex] || '',
        username: usernameIndex >= 0 ? row[usernameIndex] || '' : '',
        email: row[emailIndex] || ''
      };
    }

    if (normalizedEmail && rowEmail === normalizedEmail) {
      return {
        loginId: row[loginIndex] || '',
        username: usernameIndex >= 0 ? row[usernameIndex] || '' : '',
        email: row[emailIndex] || ''
      };
    }
  }

  return null;
}

function buildResponse(result, origin) {
  const output = {
    success: Boolean(result && result.success),
    message: result && result.message ? result.message : ''
  };

  const optionalFields = [
    'loginId',
    'username',
    'email',
    'googleAccountEmail',
    'targetLoginId',
    'updatedAuthority',
    'updatedAt',
    'toolbarConfig'
  ];

  optionalFields.forEach(function(field) {
    if (result && Object.prototype.hasOwnProperty.call(result, field)) {
      output[field] = result[field];
    }
  });

  return createJsonOutput(output, origin);
}

function createJsonOutput(data, requestOrigin) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  applyCorsHeaders(output, requestOrigin);

  return output;
}

function createPreflightResponse(requestOrigin) {
  const output = ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);

  applyCorsHeaders(output, requestOrigin);

  output
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    .setHeader('Access-Control-Max-Age', '3600');

  return output;
}

function applyCorsHeaders(output, requestOrigin) {
  const allowedOrigins = (AUTH_CONFIG.ALLOWED_ORIGINS || [])
    .map(function(origin) {
      return (origin || '').trim();
    })
    .filter(function(origin) {
      return origin;
    });

  if (!allowedOrigins.length) {
    return output;
  }

  if (allowedOrigins.indexOf('*') !== -1) {
    output.setHeader('Access-Control-Allow-Origin', '*');
    return output;
  }

  if (requestOrigin && allowedOrigins.indexOf(requestOrigin) !== -1) {
    output
      .setHeader('Access-Control-Allow-Origin', requestOrigin)
      .setHeader('Vary', 'Origin');
    return output;
  }

  if (!requestOrigin && allowedOrigins.length === 1) {
    output.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  return output;
}

function getRequestOrigin(e) {
  if (!e || !e.headers) {
    return '';
  }

  return e.headers.origin || e.headers.Origin || '';
}

function loadToolbarStates() {
  const sheet = getPluginsSheet(false);
  const defaultStates = createDefaultToolbarStates();
  if (!sheet) {
    return defaultStates;
  }

  try {
    const range = sheet.getRange(PLUGIN_CONFIG.TOOLBAR_RANGE);
    const raw = range ? String(range.getValue() || '') : '';
    if (!raw) {
      return defaultStates;
    }

    const tokens = raw.split(',');
    const normalized = [];
    for (let i = 0; i < PLUGIN_CONFIG.TOOLBAR_KEYS.length; i++) {
      normalized.push(tokens[i] && tokens[i].trim() === '0' ? 0 : 1);
    }
    return normalized;
  } catch (error) {
    return defaultStates;
  }
}

function saveToolbarStates(states) {
  const sheet = getPluginsSheet(true);
  if (!sheet) {
    throw new Error('プラグイン設定シートを開けませんでした。');
  }

  const normalized = [];
  for (let i = 0; i < PLUGIN_CONFIG.TOOLBAR_KEYS.length; i++) {
    const value = states[i] === 0 ? 0 : 1;
    normalized.push(value);
  }

  const range = sheet.getRange(PLUGIN_CONFIG.TOOLBAR_RANGE);
  range.setValue(normalized.join(','));

  return normalized;
}

function extractToolbarStates(request) {
  if (!request) {
    return null;
  }

  const keys = Array.isArray(request.toolbarKeys) && request.toolbarKeys.length
    ? request.toolbarKeys
    : PLUGIN_CONFIG.TOOLBAR_KEYS;

  const rawStates = request.toolbarStates;
  let states = null;

  if (Array.isArray(rawStates)) {
    states = rawStates.map(function(value) {
      return parseToolbarStateValue(value);
    });
  } else if (typeof rawStates === 'string') {
    states = rawStates.split(',').map(function(value) {
      return parseToolbarStateValue(value);
    });
  } else if (request.toolbarConfig && typeof request.toolbarConfig === 'object') {
    const config = request.toolbarConfig;
    states = keys.map(function(key) {
      return parseToolbarStateValue(config[key]);
    });
  }

  if (!states) {
    return null;
  }

  const normalized = [];
  const defaultStates = createDefaultToolbarStates();

  for (let i = 0; i < PLUGIN_CONFIG.TOOLBAR_KEYS.length; i++) {
    const keyIndex = keys.indexOf(PLUGIN_CONFIG.TOOLBAR_KEYS[i]);
    const fallback = defaultStates[i];
    if (keyIndex === -1) {
      normalized.push(fallback);
    } else {
      const value = states[keyIndex];
      normalized.push(value === 0 ? 0 : 1);
    }
  }

  return normalized;
}

function parseToolbarStateValue(value) {
  if (value === 0 || value === '0' || value === false) {
    return 0;
  }
  if (value === 1 || value === '1' || value === true) {
    return 1;
  }
  return undefined;
}

function createDefaultToolbarStates() {
  return PLUGIN_CONFIG.TOOLBAR_KEYS.map(function() {
    return 1;
  });
}

function buildToolbarConfigResponse(states) {
  const config = {};
  const safeStates = Array.isArray(states) && states.length
    ? states
    : createDefaultToolbarStates();

  for (let i = 0; i < PLUGIN_CONFIG.TOOLBAR_KEYS.length; i++) {
    const key = PLUGIN_CONFIG.TOOLBAR_KEYS[i];
    const value = safeStates[i] === 0 ? false : true;
    config[key] = value;
  }

  return {
    keys: PLUGIN_CONFIG.TOOLBAR_KEYS.slice(),
    states: config
  };
}
