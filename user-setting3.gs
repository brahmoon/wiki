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
    updatedAt: 6,
    authority: 7,
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

function parseRequest(e) {
  const data = parseRequestData(e);
  return {
    action: data.action,
    search: data.search || data.query || '',
    limit: parsePositiveInteger(data.limit),
    offset: parsePositiveInteger(data.offset),
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
    members: Array.isArray(result.members) ? result.members : [],
    total:
      typeof result.total === 'number'
        ? result.total
        : Array.isArray(result.members)
        ? result.members.length
        : 0,
    limit: typeof result.limit === 'number' ? result.limit : 0,
    offset: typeof result.offset === 'number' ? result.offset : 0,
    timestamp: new Date().toISOString(),
  };

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
