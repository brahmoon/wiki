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
    authority: 6,
    updatedAt: 7,
  },
  ALLOWED_ORIGINS: [
    'https://brahmoon.github.io',
    'http://localhost:3000',
    'http://localhost:4173',
  ],
};

function doGet(e) {
  return createJsonOutput(
    {
      success: true,
      message: 'User directory endpoint is running',
      timestamp: new Date().toISOString(),
    },
    getRequestOrigin(e),
  );
}

function doPost(e) {
  const origin = getRequestOrigin(e);
  try {
    const request = parseRequest(e);
    const action = (request.action || 'listMembers').toString();
    const sheet = getAccountsSheet();

    if (!sheet) {
      return buildResponse(
        {
          success: false,
          message: `シート「${CONFIG.SHEET_NAME}」が見つかりません。`,
        },
        origin,
      );
    }

    switch (action) {
      case 'listMembers':
        return buildResponse(handleListMembers(sheet, request), origin);
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

function doOptions(e) {
  return createPreflightResponse(getRequestOrigin(e));
}

function handleListMembers(sheet, request) {
  const firstDataRow = CONFIG.HEADER_ROW_INDEX + 1;
  const lastRow = sheet.getLastRow();

  if (lastRow < firstDataRow) {
    return {
      success: true,
      message: 'メンバーが見つかりませんでした。',
      members: [],
      total: 0,
      limit: request.limit,
      offset: request.offset,
    };
  }

  const totalRows = lastRow - CONFIG.HEADER_ROW_INDEX;
  const range = sheet.getRange(firstDataRow, 1, totalRows, sheet.getLastColumn());
  const values = range.getValues();

  const normalizedSearch = (request.search || '').toString().trim().toLowerCase();
  const matches = [];

  const columns = CONFIG.COLUMNS;

  values.forEach((row) => {
    const record = {
      loginId: getColumnValue(row, columns.loginId),
      username: getColumnValue(row, columns.username),
      email: getColumnValue(row, columns.email),
      kingdom: sanitizeKingdom(getColumnValue(row, columns.kingdom)),
      language: sanitizeLanguage(getColumnValue(row, columns.language)),
      authority: sanitizeAuthority(getColumnValue(row, columns.authority)),
      updatedAt: formatDateValue(getColumnValue(row, columns.updatedAt)),
    };

    if (!normalizedSearch) {
      matches.push(record);
      return;
    }

    const haystacks = [record.loginId, record.username, record.email]
      .map(function (value) {
        return (value || '').toString().trim().toLowerCase();
      })
      .filter(function (value) {
        return value;
      });

    if (haystacks.some(function (value) {
      return value.indexOf(normalizedSearch) !== -1;
    })) {
      matches.push(record);
    }
  });

  const start = request.offset || 0;
  const limit = request.limit || matches.length;
  const paged = matches.slice(start, start + limit);

  return {
    success: true,
    message: 'メンバー一覧を取得しました。',
    members: paged,
    total: matches.length,
    limit: limit,
    offset: start,
  };
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
    authority: record.authority,
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
  const columns = CONFIG.COLUMNS;

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
    authority: record.authority,
  };
}

function parseRequest(e) {
  const data = parseRequestData(e);
  return {
    action: data.action,
    search: data.search || data.query || '',
    limit: parsePositiveInteger(data.limit),
    offset: parsePositiveInteger(data.offset),
    loginId: data.loginId || data.email || '',
    email: data.email || '',
    username: data.username || data.name || '',
    kingdom: data.kingdom,
    language: data.language,
  };
}

function parsePositiveInteger(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }
  return Math.floor(number);
}

function parseRequestData(e) {
  const data = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function (key) {
      const value = e.parameter[key];
      data[key] = Array.isArray(value) ? value[0] : value;
    });
  }

  if (e && e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(e.postData.contents);
      Object.keys(parsed || {}).forEach(function (key) {
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

function getColumnValue(row, columnIndex) {
  if (!columnIndex) {
    return '';
  }
  const value = row[columnIndex - 1];
  if (value === null || value === undefined) {
    return '';
  }
  return value;
}

function sanitizeKingdom(value) {
  return String(value || '')
    .replace(/[^0-9]/g, '')
    .trim();
}

function sanitizeLanguage(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'en') {
    return 'en';
  }
  return 'ja';
}

function sanitizeAuthority(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
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
  const columns = CONFIG.COLUMNS;

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
        authority: columns.authority ? sanitizeAuthority(row[columns.authority - 1]) : null,
      };
    }
  }

  return null;
}

function formatDateValue(value) {
  if (!value) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    const dateFromNumber = new Date(value);
    if (!isNaN(dateFromNumber.getTime())) {
      return dateFromNumber.toISOString();
    }
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
    return trimmed;
  }

  return '';
}

function buildResponse(result, origin) {
  const payload = {
    success: Boolean(result.success),
    message: result.message || '',
    timestamp: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(result, 'members')) {
    payload.members = Array.isArray(result.members) ? result.members : [];
    payload.total =
      typeof result.total === 'number'
        ? result.total
        : Array.isArray(result.members)
        ? result.members.length
        : 0;
    payload.limit = typeof result.limit === 'number' ? result.limit : 0;
    payload.offset = typeof result.offset === 'number' ? result.offset : 0;
  }

  if (Object.prototype.hasOwnProperty.call(result, 'loginId')) {
    payload.loginId = result.loginId || null;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'username')) {
    payload.username = result.username || null;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'email')) {
    payload.email = result.email || null;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'kingdom')) {
    payload.kingdom = result.kingdom || null;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'language')) {
    payload.language = result.language || null;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'authority')) {
    payload.authority = result.authority;
  }

  return createJsonOutput(payload, origin);
}

function getRequestOrigin(e) {
  if (!e || !e.headers) {
    return '';
  }
  return e.headers.origin || e.headers.Origin || '';
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
  const allowedOrigins = (CONFIG.ALLOWED_ORIGINS || [])
    .map(function (origin) {
      return (origin || '').trim();
    })
    .filter(function (origin) {
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
