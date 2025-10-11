const SETTINGS_CONFIG = {
  SHEET_ID: '1mVVuS5bS50-YoVQyDIOM09Oi2YIpRIyIAfXDeBcw6N8',
  SHEET_NAME: 'Accounts',
  HEADER_ROW_INDEX: 1,
  COLUMNS: {
    loginId: 1,
    username: 2,
    email: 3,
    kingdom: 4,
    language: 5,
    updatedAt: 6,
  },
  ALLOWED_ORIGINS: [
    'https://brahmoon.github.io',
    'http://localhost:3000',
    'http://localhost:4173',
  ],
};

function doGet(e) {
  return buildResponse(
    {
      success: true,
      message: 'User settings endpoint is running',
      timestamp: new Date().toISOString(),
    },
    getRequestOrigin(e),
  );
}

function doPost(e) {
  const origin = getRequestOrigin(e);
  try {
    const request = parseRequest(e);
    const action = (request.action || '').toString() || 'getUserSettings';

    const sheet = getAccountsSheet();
    if (!sheet) {
      return buildResponse(
        {
          success: false,
          message: `シート「${SETTINGS_CONFIG.SHEET_NAME}」が見つかりません。`,
        },
        origin,
      );
    }

    switch (action) {
      case 'getUserSettings':
        return buildResponse(handleGetUserSettings(sheet, request), origin);
      case 'updateUserSettings':
        return buildResponse(handleUpdateUserSettings(sheet, request), origin);
      default:
        return buildResponse(
          {
            success: false,
            message: `Unknown action: ${action}`,
          },
          origin,
        );
    }
  } catch (error) {
    return buildResponse(
      {
        success: false,
        message: `処理中にエラーが発生しました: ${error && error.message ? error.message : error}`,
      },
      origin,
    );
  }
}

function handleGetUserSettings(sheet, request) {
  if (!request.loginId && !request.email) {
    return {
      success: false,
      message: 'ログインIDまたはメールアドレスを指定してください。',
    };
  }

  const record = findAccount(sheet, request);
  if (!record) {
    return {
      success: false,
      message: '該当するユーザーが見つかりません。',
    };
  }

  return {
    success: true,
    message: 'ユーザー設定を取得しました。',
    loginId: record.loginId,
    username: record.username,
    email: record.email,
    kingdom: record.kingdom,
    language: record.language,
  };
}

function handleUpdateUserSettings(sheet, request) {
  if (!request.loginId && !request.email) {
    return {
      success: false,
      message: 'ログインIDまたはメールアドレスを指定してください。',
    };
  }

  const normalizedUsername = (request.username || '').toString().trim();
  if (!normalizedUsername) {
    return {
      success: false,
      message: 'ユーザーネームを入力してください。',
    };
  }

  const record = findAccount(sheet, request);
  if (!record) {
    return {
      success: false,
      message: '該当するユーザーが見つかりません。',
    };
  }

  const kingdomValue = sanitizeKingdom(request.kingdom);
  const languageValue = sanitizeLanguage(request.language);

  const updatedValues = record.values.slice();
  const columns = SETTINGS_CONFIG.COLUMNS;

  if (columns.username) {
    updatedValues[columns.username - 1] = normalizedUsername;
  }
  if (columns.email) {
    updatedValues[columns.email - 1] = request.email ? request.email.toString().trim() : record.email;
  }
  if (columns.kingdom) {
    updatedValues[columns.kingdom - 1] = kingdomValue;
  }
  if (columns.language) {
    updatedValues[columns.language - 1] = languageValue;
  }
  if (columns.updatedAt) {
    updatedValues[columns.updatedAt - 1] = new Date();
  }

  const rowRange = sheet.getRange(record.rowNumber, 1, 1, sheet.getLastColumn());
  rowRange.setValues([updatedValues]);

  return {
    success: true,
    message: 'ユーザー設定を更新しました。',
    loginId: updatedValues[columns.loginId - 1] || record.loginId,
    username: updatedValues[columns.username - 1] || normalizedUsername,
    email: columns.email ? updatedValues[columns.email - 1] || record.email : record.email,
    kingdom: columns.kingdom ? updatedValues[columns.kingdom - 1] || '' : '',
    language: columns.language ? updatedValues[columns.language - 1] || '' : '',
  };
}

function parseRequest(e) {
  const data = parseRequestData(e);
  return {
    action: data.action,
    loginId: data.loginId || data.email || '',
    email: data.email || '',
    username: data.username || data.name || '',
    kingdom: data.kingdom,
    language: data.language,
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
  if (SETTINGS_CONFIG.SHEET_ID) {
    return SpreadsheetApp.openById(SETTINGS_CONFIG.SHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getAccountsSheet() {
  const spreadsheet = getSpreadsheet();
  return spreadsheet ? spreadsheet.getSheetByName(SETTINGS_CONFIG.SHEET_NAME) : null;
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function sanitizeKingdom(value) {
  const numeric = String(value || '')
    .replace(/[^0-9]/g, '')
    .trim();
  return numeric;
}

function sanitizeLanguage(value) {
  return String(value || '')
    .trim()
    .toLowerCase() === 'en'
    ? 'en'
    : 'ja';
}

function findAccount(sheet, identifiers) {
  const lastRow = sheet.getLastRow();
  const firstDataRow = SETTINGS_CONFIG.HEADER_ROW_INDEX + 1;
  if (lastRow < firstDataRow) {
    return null;
  }

  const totalRows = lastRow - SETTINGS_CONFIG.HEADER_ROW_INDEX;
  const range = sheet.getRange(firstDataRow, 1, totalRows, sheet.getLastColumn());
  const values = range.getValues();

  const normalizedLoginId = normalizeId(identifiers.loginId);
  const normalizedEmail = normalizeId(identifiers.email);
  const columns = SETTINGS_CONFIG.COLUMNS;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowLoginId = normalizeId(columns.loginId ? row[columns.loginId - 1] : '');
    const rowEmail = columns.email ? normalizeId(row[columns.email - 1]) : '';

    const loginMatch = normalizedLoginId && rowLoginId && rowLoginId === normalizedLoginId;
    const emailMatch = normalizedEmail && rowEmail && rowEmail === normalizedEmail;

    if (loginMatch || emailMatch) {
      return {
        rowNumber: firstDataRow + i,
        values: row,
        loginId: columns.loginId ? row[columns.loginId - 1] : identifiers.loginId || identifiers.email || '',
        username: columns.username ? row[columns.username - 1] || '' : '',
        email:
          columns.email && row[columns.email - 1]
            ? row[columns.email - 1]
            : identifiers.email || '',
        kingdom: columns.kingdom ? row[columns.kingdom - 1] || '' : '',
        language: columns.language ? sanitizeLanguage(row[columns.language - 1]) : 'ja',
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
    kingdom: result.kingdom || null,
    language: result.language || null,
    timestamp: new Date().toISOString(),
  };

  return createJsonOutput(output, origin);
}

function createJsonOutput(data, requestOrigin) {
  const output = ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );

  const allowedOrigins = (SETTINGS_CONFIG.ALLOWED_ORIGINS || [])
    .map((origin) => (origin || '').trim())
    .filter((origin) => origin);

  if (allowedOrigins.length) {
    if (allowedOrigins.indexOf('*') !== -1) {
      output.setHeader('Access-Control-Allow-Origin', '*');
    } else if (requestOrigin && allowedOrigins.indexOf(requestOrigin) !== -1) {
      output.setHeader('Access-Control-Allow-Origin', requestOrigin).setHeader('Vary', 'Origin');
    }
  }

  output.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  return output;
}

function getRequestOrigin(e) {
  if (!e || !e.headers) {
    return '';
  }
  return e.headers.origin || e.headers.Origin || '';
}
