const AUTH_CONFIG = {
  SHEET_ID: '1mVVuS5bS50-YoVQyDIOM09Oi2YIpRIyIAfXDeBcw6N8',
  SHEET_NAME: 'Accounts',
  HEADER_ROW_INDEX: 1,
  LOGIN_ID_COLUMN: 1,
  USERNAME_COLUMN: 2,
  EMAIL_COLUMN: 3,
  ALLOWED_ORIGINS: [
    'https://brahmoon.github.io',
    'http://localhost:3000',
    'http://localhost:4173'
  ],
  DEFAULT_REQUIRED_LOGIN_ID: 'admin'
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

    if (action !== 'verifyAdminAccess') {
      return buildResponse(
        {
          success: false,
          message: `Unknown action: ${action}`
        },
        origin
      );
    }

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

    const result = verifyAdminAccess(sheet, request);
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
  return createJsonOutput(
    {
      success: true,
      message: 'OK'
    },
    getRequestOrigin(e)
  );
}

function verifyAdminAccess(sheet, request) {
  const activeUserEmail = Session.getActiveUser().getEmail();
  if (!activeUserEmail) {
    return {
      success: false,
      message: 'Googleアカウントでログインしてください。'
    };
  }

  const normalizedActiveEmail = normalizeId(activeUserEmail);
  const account = findAccount(sheet, {
    loginId: request.loginId,
    email: request.email,
    googleEmail: normalizedActiveEmail
  });

  if (!account) {
    return {
      success: false,
      message: '管理者アカウントが登録されていません。'
    };
  }

  const requiredLoginIds = buildRequiredLoginIds(request);
  const normalizedAccountLoginId = normalizeId(account.loginId);
  const isAuthorized = requiredLoginIds.some((loginId) => loginId === normalizedAccountLoginId);

  if (!isAuthorized) {
    return {
      success: false,
      message: '管理者権限がありません。'
    };
  }

  return {
    success: true,
    message: '管理者権限が確認されました。',
    loginId: account.loginId,
    username: account.username,
    email: account.email,
    googleAccountEmail: activeUserEmail
  };
}

function buildRequiredLoginIds(request) {
  const candidates = [];

  if (Array.isArray(request.allowedLoginIds)) {
    request.allowedLoginIds.forEach((value) => {
      const normalized = normalizeId(value);
      if (normalized) {
        candidates.push(normalized);
      }
    });
  }

  const requiredLoginId = normalizeId(request.requiredLoginId || request.loginId);
  if (requiredLoginId) {
    candidates.push(requiredLoginId);
  }

  if (!candidates.length) {
    candidates.push(normalizeId(AUTH_CONFIG.DEFAULT_REQUIRED_LOGIN_ID));
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
    requiredLoginId: data.requiredLoginId || data.expectedLoginId || '',
    allowedLoginIds: Array.isArray(data.allowedLoginIds) ? data.allowedLoginIds : []
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
    message: result && result.message ? result.message : '',
    loginId: result && result.loginId ? result.loginId : null,
    username: result && result.username ? result.username : null,
    email: result && result.email ? result.email : null,
    googleAccountEmail: result && result.googleAccountEmail ? result.googleAccountEmail : null
  };

  return createJsonOutput(output, origin);
}

function createJsonOutput(data, requestOrigin) {
  const output = ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);

  const allowedOrigins = (AUTH_CONFIG.ALLOWED_ORIGINS || [])
    .map((origin) => (origin || '').trim())
    .filter((origin) => origin);

  if (allowedOrigins.length) {
    if (allowedOrigins.indexOf('*') !== -1) {
      output.setHeader('Access-Control-Allow-Origin', '*');
    } else if (requestOrigin && allowedOrigins.indexOf(requestOrigin) !== -1) {
      output.setHeader('Access-Control-Allow-Origin', requestOrigin).setHeader('Vary', 'Origin');
    }
  }

  output
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    .setHeader('Access-Control-Allow-Credentials', 'true');

  return output;
}

function getRequestOrigin(e) {
  if (e && e.headers) {
    const headerOrigin = e.headers.origin || e.headers.Origin;
    if (headerOrigin) {
      return String(headerOrigin);
    }
  }

  if (e && e.parameter && e.parameter.origin) {
    return String(e.parameter.origin);
  }

  if (e && e.parameter && e.parameter.callback) {
    return null;
  }

  if (e && e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(e.postData.contents);
      if (parsed && parsed.origin) {
        return String(parsed.origin);
      }
    } catch (error) {
      // ignore
    }
  }

  if (e && e.context && e.context.domain) {
    return String(e.context.domain);
  }

  return null;
}
