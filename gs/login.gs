const CONFIG = {
  SHEET_ID: '1mVVuS5bS50-YoVQyDIOM09Oi2YIpRIyIAfXDeBcw6N8',
  SHEET_NAME: 'Accounts',
  HEADER_ROW_INDEX: 1,
  COLUMNS: {
    playerId: 1,
    username: 2,
    email: 3,
    kingdom: 4,
    language: 5,
    authority: 6,
  },
  PLAYER_ID_COLUMN: 1,
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

    if (!requestData.playerId && !requestData.email) {
      return buildResponse({
        success: false,
        message: 'PlayerIDが指定されていません。',
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
      playerId: requestData.playerId,
      email: requestData.email,
    });

    if (!record) {
      return buildResponse({
        success: false,
        message: '指定されたPlayerIDは登録されていません。',
      }, origin);
    }

    return buildResponse({
      success: true,
      message: '認証に成功しました。',
      playerId: record.playerId,
      username: record.username,
      email: record.email,
      kingdom: record.kingdom,
      language: record.language,
      authority: record.authority,
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
    playerId: data.playerId || data.loginId || data.googleEmail || data.email || '',
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

  const normalizedPlayerId = normalizeId(identifiers.playerId);
  const normalizedEmail = normalizeId(identifiers.email);
  const columns = CONFIG.COLUMNS || {};
  const playerIndex = (columns.playerId || CONFIG.PLAYER_ID_COLUMN) - 1;
  const usernameIndex = (columns.username || CONFIG.USERNAME_COLUMN) - 1;
  const emailIndex = (columns.email || CONFIG.EMAIL_COLUMN) - 1;
  const kingdomIndex = typeof columns.kingdom === 'number' ? columns.kingdom - 1 : -1;
  const languageIndex = typeof columns.language === 'number' ? columns.language - 1 : -1;
  const authorityIndex = typeof columns.authority === 'number' ? columns.authority - 1 : -1;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowPlayerId = normalizeId(row[playerIndex]);
    const rowEmail = emailIndex >= 0 ? normalizeId(row[emailIndex]) : '';

    if (normalizedPlayerId && rowPlayerId && rowPlayerId === normalizedPlayerId) {
      return {
        playerId: row[playerIndex],
        username: row[usernameIndex] || '',
        email: emailIndex >= 0 ? row[emailIndex] || '' : identifiers.email || '',
        kingdom: kingdomIndex >= 0 ? row[kingdomIndex] || '' : '',
        language: languageIndex >= 0 ? row[languageIndex] || '' : '',
        authority: authorityIndex >= 0 ? row[authorityIndex] || '' : '',
      };
    }

    if (normalizedEmail && rowEmail && rowEmail === normalizedEmail) {
      return {
        playerId: row[playerIndex] || identifiers.playerId || '',
        username: row[usernameIndex] || '',
        email: row[emailIndex] || identifiers.email || '',
        kingdom: kingdomIndex >= 0 ? row[kingdomIndex] || '' : '',
        language: languageIndex >= 0 ? row[languageIndex] || '' : '',
        authority: authorityIndex >= 0 ? row[authorityIndex] || '' : '',
      };
    }
  }

  return null;
}

function buildResponse(result, origin) {
  const output = {
    success: Boolean(result.success),
    message: result.message || '',
    playerId: result.playerId || null,
    username: result.username || null,
    email: result.email || null,
    kingdom: typeof result.kingdom !== 'undefined' ? result.kingdom : null,
    language: typeof result.language !== 'undefined' ? result.language : null,
    authority: typeof result.authority !== 'undefined' ? result.authority : null,
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