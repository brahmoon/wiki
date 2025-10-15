const CONFIG = {
  SHEET_ID: '1mVVuS5bS50-YoVQyDIOM09Oi2YIpRIyIAfXDeBcw6N8',
  SHEET_NAME: 'Accounts',
  HEADER_ROW_INDEX: 1,
  COLUMNS: {
    loginId: 1,
    username: 2,
    email: 3,
    kingdom: 4,
    language: 5,
  },
  LOGIN_ID_COLUMN: 1,
  USERNAME_COLUMN: 2,
  EMAIL_COLUMN: 3,
  ALLOWED_ORIGINS: [
    'https://brahmoon.github.io',
    'http://localhost:3000',
    'http://localhost:4173'
  ],
};

function doGet(e) {
  return createJsonOutput({
    success: true,
    message: 'Login endpoint is running',
    timestamp: new Date().toISOString(),
  }, getRequestOrigin(e));
}

function doPost(e) {
  const origin = getRequestOrigin(e);
  try {
    const requestData = parseRequest(e);
    const action = (requestData.action || 'verifyLogin').toString();

    if (action !== 'verifyLogin') {
      return buildResponse({
        success: false,
        message: `Unknown action: ${action}`,
      }, origin);
    }

    if (!requestData.loginId && !requestData.email) {
      return buildResponse({
        success: false,
        message: 'ログインIDが指定されていません。',
      }, origin);
    }

    const sheet = getAccountsSheet();
    if (!sheet) {
      return buildResponse({
        success: false,
        message: `シート「${CONFIG.SHEET_NAME}」が見つかりません。`,
      }, origin);
    }

    const record = findAccount(sheet, {
      loginId: requestData.loginId,
      email: requestData.email,
    });

    if (!record) {
      return buildResponse({
        success: false,
        message: '指定されたログインIDは登録されていません。',
      }, origin);
    }

    return buildResponse({
      success: true,
      message: '認証に成功しました。',
      loginId: record.loginId,
      username: record.username,
      email: record.email,
      kingdom: record.kingdom,
      language: record.language,
    }, origin);
  } catch (error) {
    return buildResponse({
      success: false,
      message: `処理中にエラーが発生しました: ${error.message || error}`,
    }, origin);
  }
}

function parseRequest(e) {
  const data = parseRequestData(e);
  return {
    action: data.action,
    loginId: data.loginId || data.googleEmail || data.email || '',
    email: data.email || data.googleEmail || '',
    name: data.name || data.googleName || '',
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
  if (CONFIG.SHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getAccountsSheet() {
  const spreadsheet = getSpreadsheet();
  return spreadsheet ? spreadsheet.getSheetByName(CONFIG.SHEET_NAME) : null;
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function findAccount(sheet, identifiers) {
  const lastRow = sheet.getLastRow();
  const firstDataRow = CONFIG.HEADER_ROW_INDEX + 1;
  if (lastRow < firstDataRow) {
    return null;
  }

  const totalRows = lastRow - CONFIG.HEADER_ROW_INDEX;
  const range = sheet.getRange(firstDataRow, 1, totalRows, sheet.getLastColumn());
  const values = range.getValues();

  const normalizedLoginId = normalizeId(identifiers.loginId);
  const normalizedEmail = normalizeId(identifiers.email);
  const columns = CONFIG.COLUMNS || {};
  const loginIndex = (columns.loginId || CONFIG.LOGIN_ID_COLUMN) - 1;
  const usernameIndex = (columns.username || CONFIG.USERNAME_COLUMN) - 1;
  const emailIndex = (columns.email || CONFIG.EMAIL_COLUMN) - 1;
  const kingdomIndex = typeof columns.kingdom === 'number' ? columns.kingdom - 1 : -1;
  const languageIndex = typeof columns.language === 'number' ? columns.language - 1 : -1;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowLoginId = normalizeId(row[loginIndex]);
    const rowEmail = emailIndex >= 0 ? normalizeId(row[emailIndex]) : '';

    if (normalizedLoginId && rowLoginId && rowLoginId === normalizedLoginId) {
      return {
        loginId: row[loginIndex],
        username: row[usernameIndex] || '',
        email: emailIndex >= 0 ? row[emailIndex] || '' : identifiers.email || '',
        kingdom: kingdomIndex >= 0 ? row[kingdomIndex] || '' : '',
        language: languageIndex >= 0 ? row[languageIndex] || '' : '',
      };
    }

    if (normalizedEmail && rowEmail && rowEmail === normalizedEmail) {
      return {
        loginId: row[loginIndex] || identifiers.loginId || identifiers.email,
        username: row[usernameIndex] || '',
        email: row[emailIndex] || identifiers.email || '',
        kingdom: kingdomIndex >= 0 ? row[kingdomIndex] || '' : '',
        language: languageIndex >= 0 ? row[languageIndex] || '' : '',
      };
    }
  }

  return null;
}

function buildResponse(result, origin) {
  const output = {
    success: Boolean(result.success),
    message: result.message || '',
    loginId: result.loginId || null,
    username: result.username || null,
    email: result.email || null,
    kingdom: typeof result.kingdom !== 'undefined' ? result.kingdom : null,
    language: typeof result.language !== 'undefined' ? result.language : null,
  };

  return createJsonOutput(output, origin);
}

function createJsonOutput(data, requestOrigin) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  const allowedOrigins = (CONFIG.ALLOWED_ORIGINS || [])
    .map((origin) => (origin || '').trim())
    .filter((origin) => origin);

  if (allowedOrigins.length) {
    if (allowedOrigins.indexOf('*') !== -1) {
      output.setHeader('Access-Control-Allow-Origin', '*');
    } else if (requestOrigin && allowedOrigins.indexOf(requestOrigin) !== -1) {
      output
        .setHeader('Access-Control-Allow-Origin', requestOrigin)
        .setHeader('Vary', 'Origin');
    }
  }

  return output;
}

function getRequestOrigin(e) {
  if (!e || !e.headers) {
    return '';
  }
  return e.headers.origin || e.headers.Origin || '';
}
