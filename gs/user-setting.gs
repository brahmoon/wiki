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
    updatedAt: 7,
  },
  ALLOWED_ORIGINS: [
    'https://brahmoon.github.io',
    'http://localhost:3000',
    'http://localhost:4173',
  ],
};

const ADMIN_AUTHORITY_THRESHOLD = (function resolveAdminThreshold() {
  if (typeof ADMIN_AUTHORITY_VALUE !== 'undefined') {
    const numeric = Number(ADMIN_AUTHORITY_VALUE);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return 99;
})();

const EDITOR_AUTHORITY_VALUE = 2;

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
      case 'registerUser':
        return buildResponse(handleRegisterUser(sheet, request), origin);
      case 'requestEditorAccess':
        return buildResponse(handleRequestEditorAccess(sheet, request), origin);
      case 'cancelEditorRequest':
        return buildResponse(handleCancelEditorRequest(sheet, request), origin);
      case 'autoApproveEditorRequest':
        return buildResponse(handleAutoApproveEditorRequest(sheet, request), origin);
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

function requireAdminAuthority(sheet, request) {
  const verification = runAdminVerification(sheet, request);
  if (verification && verification.success && request) {
    request.__adminVerification = verification;
  }
  return verification;
}

function resolveAdminVerification(sheet, request) {
  if (request && request.__adminVerification && request.__adminVerification.success) {
    return request.__adminVerification;
  }

  if (!request || !request.adminToken) {
    return null;
  }

  const verification = runAdminVerification(sheet, request);
  if (verification && verification.success && request) {
    request.__adminVerification = verification;
  }
  return verification;
}

function runAdminVerification(sheet, request) {
  if (typeof verifyAdminAccess === 'function') {
    return verifyAdminAccess(sheet, request);
  }
  return fallbackVerifyAdminAccess(sheet, request);
}

function fallbackVerifyAdminAccess(sheet, request) {
  const normalizedGoogleEmail = normalizeId(request && request.googleEmail);
  const normalizedEmail = normalizeId(request && request.email);
  const lookupEmail = normalizedGoogleEmail || normalizedEmail;

  if (!lookupEmail) {
    return {
      success: false,
      message: 'Googleアカウントのメールアドレスが確認できませんでした。',
      requiresReauthentication: true
    };
  }

  if (!sheet) {
    return {
      success: false,
      message: 'アカウント情報が確認できません。管理者にお問い合わせください。'
    };
  }

  const account = findAccount(sheet, { email: lookupEmail, playerId: request && request.playerId });

  if (!account) {
    return {
      success: false,
      message: '管理者アカウントが登録されていません。',
      requiresReauthentication: true
    };
  }

  const authorityValue = parseAuthorityValue(account.authority);
  if (authorityValue === null || authorityValue < ADMIN_AUTHORITY_THRESHOLD) {
    return {
      success: false,
      message: '管理者権限がありません。',
      authority: authorityValue
    };
  }

  return {
    success: true,
    message: '管理者権限が確認されました。',
    playerId: account.playerId || '',
    username: account.username || '',
    email: account.email || '',
    authority: authorityValue,
    adminAuthority: authorityValue,
    adminEmail: account.email || ''
  };
}

function verifyRequestAccessToEmail(request, account) {
  if (!request) {
    return {
      success: false,
      message: 'リクエスト情報が不足しています。',
      requiresReauthentication: true,
      emailMatchesLogin: false
    };
  }

  if (request.__adminVerification && request.__adminVerification.success) {
    return { success: true, emailMatchesLogin: true };
  }

  const normalizedAccountEmail = normalizeId(account && account.email);
  const normalizedRequestEmail = normalizeId(request.googleEmail || request.email);

  if (!normalizedRequestEmail) {
    return {
      success: false,
      message: 'Googleアカウントのメールアドレスが確認できませんでした。再度ログインしてください。',
      requiresReauthentication: true,
      emailMatchesLogin: false
    };
  }

  if (normalizedAccountEmail && normalizedAccountEmail === normalizedRequestEmail) {
    return { success: true, emailMatchesLogin: true };
  }

  return {
    success: false,
    message: '他のユーザーのデータを操作することはできません。',
    requiresReauthentication: true,
    emailMatchesLogin: false
  };
}

function appendAdminVerification(result, verification) {
  if (!result) {
    return result;
  }

  const context = verification && verification.success
    ? verification
    : null;

  if (!context) {
    return result;
  }

  if (context.adminToken) {
    result.adminToken = context.adminToken;
  }
  if (context.adminTokenIssuedAt) {
    result.adminTokenIssuedAt = context.adminTokenIssuedAt;
  }
  if (context.adminTokenExpiresAt) {
    result.adminTokenExpiresAt = context.adminTokenExpiresAt;
  }
  if (Object.prototype.hasOwnProperty.call(context, 'adminAuthority')) {
    result.adminAuthority = context.adminAuthority;
  }
  if (context.adminEmail) {
    result.adminEmail = context.adminEmail;
  }

  return result;
}

function handleListMembers(sheet, request) {
  const adminVerification = requireAdminAuthority(sheet, request);
  if (!adminVerification.success) {
    return adminVerification;
  }

  const firstDataRow = CONFIG.HEADER_ROW_INDEX + 1;
  const lastRow = sheet.getLastRow();

  if (lastRow < firstDataRow) {
    return appendAdminVerification({
      success: true,
      message: 'メンバーが見つかりませんでした。',
      members: [],
      total: 0,
      limit: request.limit,
      offset: request.offset,
    }, adminVerification);
  }

  const totalRows = lastRow - CONFIG.HEADER_ROW_INDEX;
  const range = sheet.getRange(firstDataRow, 1, totalRows, sheet.getLastColumn());
  const values = range.getValues();

  const normalizedSearch = (request.search || '').toString().trim().toLowerCase();
  const matches = [];

  const columns = CONFIG.COLUMNS;

  values.forEach((row) => {
    const record = {
      playerId: getColumnValue(row, columns.playerId),
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

    const haystacks = [record.playerId, record.username, record.email]
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

  return appendAdminVerification({
    success: true,
    message: 'メンバー一覧を取得しました。',
    members: paged,
    total: matches.length,
    limit: limit,
    offset: start,
  }, adminVerification);
}

function handleGetUserSettings(sheet, request) {
  const adminVerification = resolveAdminVerification(sheet, request);
  if (adminVerification && !adminVerification.success) {
    return adminVerification;
  }

  if (!request.playerId && !request.email) {
    return {
      success: false,
      message: 'PlayerIDまたはメールアドレスを指定してください。',
    };
  }

  const record = findAccount(sheet, request);
  if (!record) {
    return {
      success: false,
      message: '該当するユーザーが見つかりません。',
    };
  }

  const accessCheck = verifyRequestAccessToEmail(request, record);
  if (!accessCheck.success) {
    return accessCheck;
  }

  return appendAdminVerification({
    success: true,
    message: 'ユーザー設定を取得しました。',
    playerId: record.playerId,
    username: record.username,
    email: record.email,
    kingdom: record.kingdom,
    language: record.language,
    authority: record.authority,
  }, request.__adminVerification || adminVerification);
}

function handleUpdateUserSettings(sheet, request) {
  const adminVerification = resolveAdminVerification(sheet, request);
  if (adminVerification && !adminVerification.success) {
    return adminVerification;
  }

  if (!request.playerId && !request.email) {
    return {
      success: false,
      message: 'PlayerIDまたはメールアドレスを指定してください。',
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

  const accessCheck = verifyRequestAccessToEmail(request, record);
  if (!accessCheck.success) {
    return accessCheck;
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

  return appendAdminVerification({
    success: true,
    message: 'ユーザー設定を更新しました。',
    playerId: updatedValues[columns.playerId - 1] || record.playerId,
    username: updatedValues[columns.username - 1] || normalizedUsername,
    email: columns.email ? updatedValues[columns.email - 1] || record.email : record.email,
    kingdom: columns.kingdom ? updatedValues[columns.kingdom - 1] || '' : '',
    language: columns.language ? updatedValues[columns.language - 1] || '' : '',
    authority: record.authority,
  }, request.__adminVerification || adminVerification);
}

function handleRegisterUser(sheet, request) {
  const adminVerification = resolveAdminVerification(sheet, request);
  if (adminVerification && !adminVerification.success) {
    return adminVerification;
  }

  const email = (request.email || '').toString().trim();
  if (!email) {
    return {
      success: false,
      message: '登録するメールアドレスを入力してください。',
    };
  }

  const normalizedGoogleEmail = normalizeId(request.googleEmail);
  const normalizedEmail = normalizeId(email);

  if (!(adminVerification && adminVerification.success)) {
    if (!normalizedGoogleEmail) {
      return {
        success: false,
        message: 'Googleアカウントのメールアドレスが確認できませんでした。再度ログインしてください。',
        requiresReauthentication: true,
      };
    }

    if (normalizedEmail && normalizedGoogleEmail && normalizedEmail !== normalizedGoogleEmail) {
      return {
        success: false,
        message: 'Googleアカウントと異なるメールアドレスは登録できません。',
        requiresReauthentication: true,
      };
    }
  }

  const normalizedUsername = (request.username || '').toString().trim();
  if (!normalizedUsername) {
    return {
      success: false,
      message: 'ユーザーネームを入力してください。',
    };
  }

  const playerId = (request.playerId || '').toString().trim();

  const existingAccount = findAccount(sheet, {
    playerId: playerId,
    email: email,
  });

  if (existingAccount) {
    return {
      success: false,
      message: 'このメールアドレスはすでに登録されています。',
      playerId: existingAccount.playerId,
      username: existingAccount.username,
      email: existingAccount.email,
      authority: existingAccount.authority,
    };
  }

  const columns = CONFIG.COLUMNS || {};
  const kingdomValue = sanitizeKingdom(request.kingdom);
  const languageValue = sanitizeLanguage(request.language || 'ja');
  const lastColumn = sheet.getLastColumn();
  const newRowValues = new Array(Math.max(lastColumn, 1)).fill('');

  if (columns.playerId) {
    newRowValues[columns.playerId - 1] = playerId;
  }
  if (columns.username) {
    newRowValues[columns.username - 1] = normalizedUsername;
  }
  if (columns.email) {
    newRowValues[columns.email - 1] = email;
  }
  if (columns.kingdom) {
    newRowValues[columns.kingdom - 1] = kingdomValue;
  }
  if (columns.language) {
    newRowValues[columns.language - 1] = languageValue;
  }
  if (columns.authority) {
    newRowValues[columns.authority - 1] = 1;
  }
  if (columns.updatedAt) {
    newRowValues[columns.updatedAt - 1] = new Date();
  }

  sheet.appendRow(newRowValues);

  return appendAdminVerification({
    success: true,
    message: 'ユーザーを登録しました。',
    playerId: columns.playerId ? newRowValues[columns.playerId - 1] : playerId,
    username: normalizedUsername,
    email: email,
    kingdom: kingdomValue,
    language: languageValue,
    authority: 1,
  }, request.__adminVerification || adminVerification);
}

function handleRequestEditorAccess(sheet, request) {
  const adminVerification = resolveAdminVerification(sheet, request);
  if (adminVerification && !adminVerification.success) {
    return adminVerification;
  }

  const desiredPlayerId = sanitizePlayerId(request.requestedPlayerId || request.playerId);
  if (!desiredPlayerId) {
    return {
      success: false,
      message: '申請するPlayer IDを入力してください。'
    };
  }

  const kingdomValue = sanitizeKingdom(request.kingdom);
  if (!kingdomValue) {
    return {
      success: false,
      message: 'Kingdom番号を入力してください。'
    };
  }

  const lookupIdentifiers = {
    playerId: request.currentPlayerId || request.playerId || '',
    email: request.email || request.googleEmail || ''
  };

  const record = findAccount(sheet, lookupIdentifiers);
  if (!record) {
    return {
      success: false,
      message: 'ユーザー情報が見つかりません。'
    };
  }

  const accessCheck = verifyRequestAccessToEmail(request, record);
  if (!accessCheck.success) {
    return accessCheck;
  }

  const authorityValue = parseAuthorityValue(record.authority);
  if (authorityValue !== null && authorityValue >= EDITOR_AUTHORITY_VALUE && !isPendingPlayerIdValue(record.playerId)) {
    return {
      success: false,
      message: 'すでに編集権限をお持ちのアカウントです。'
    };
  }

  const columns = CONFIG.COLUMNS || {};
  const updatedValues = record.values.slice();
  const pendingPlayerId = buildPendingPlayerId(desiredPlayerId);

  if (columns.playerId) {
    updatedValues[columns.playerId - 1] = pendingPlayerId;
  }
  if (columns.kingdom) {
    updatedValues[columns.kingdom - 1] = kingdomValue;
  }
  if (columns.updatedAt) {
    updatedValues[columns.updatedAt - 1] = new Date();
  }

  const rowRange = sheet.getRange(record.rowNumber, 1, 1, sheet.getLastColumn());
  rowRange.setValues([updatedValues]);

  return appendAdminVerification({
    success: true,
    message: '編集権限の申請を受け付けました。',
    playerId: columns.playerId ? updatedValues[columns.playerId - 1] : pendingPlayerId,
    kingdom: columns.kingdom ? updatedValues[columns.kingdom - 1] : kingdomValue,
    authority: authorityValue !== null ? authorityValue : 1
  }, request.__adminVerification || adminVerification);
}

function handleCancelEditorRequest(sheet, request) {
  const lookupIdentifiers = {
    playerId: request.currentPlayerId || request.playerId || '',
    email: request.email || request.googleEmail || '',
  };

  const record = findAccount(sheet, lookupIdentifiers);
  if (!record) {
    return {
      success: false,
      message: 'ユーザー情報が見つかりません。',
    };
  }

  const accessCheck = verifyRequestAccessToEmail(request, record);
  if (!accessCheck.success) {
    return accessCheck;
  }

  const columns = CONFIG.COLUMNS || {};
  const updatedValues = record.values.slice();
  const currentPlayerIdValue = columns.playerId ? updatedValues[columns.playerId - 1] : '';

  if (!isPendingPlayerIdValue(currentPlayerIdValue)) {
    return {
      success: false,
      message: '現在申請中の情報はありません。',
    };
  }

  if (columns.playerId) {
    updatedValues[columns.playerId - 1] = '';
  }
  if (columns.kingdom) {
    updatedValues[columns.kingdom - 1] = '';
  }
  if (columns.updatedAt) {
    updatedValues[columns.updatedAt - 1] = new Date();
  }

  const rowRange = sheet.getRange(record.rowNumber, 1, 1, sheet.getLastColumn());
  rowRange.setValues([updatedValues]);

  const authorityValue = parseAuthorityValue(record.authority);

  return {
    success: true,
    message: '申請をキャンセルしました。',
    playerId: columns.playerId ? updatedValues[columns.playerId - 1] || '' : '',
    kingdom: columns.kingdom ? updatedValues[columns.kingdom - 1] || '' : '',
    authority: authorityValue !== null ? authorityValue : 1,
  };
}

function handleAutoApproveEditorRequest(sheet, request) {
  const normalizedCurrentPlayerId = String(request.currentPlayerId || request.playerId || '');
  const lookupIdentifiers = {
    playerId: normalizedCurrentPlayerId,
    email: request.email || request.googleEmail || '',
  };
  let pendingPlayerIdMatches = false;
  let emailLookupPlayerId = '';
  let pendingPlayerId = '';
  let emailMatchesLogin = false;

  const record = findAccount(sheet, lookupIdentifiers);
  if (!record) {
    return {
      success: false,
      message: 'ユーザー情報が見つかりません。',
      pendingPlayerIdMatches,
      emailLookupPlayerId,
      pendingPlayerId,
      emailMatchesLogin,
    };
  }

  const sanitizedCodePlayerId = String(sanitizePlayerId(request.playerId || '') || '');
  const sanitizedCharId = String(sanitizePlayerId(request.charId || '') || '');
  const parsedCode = parseAuthorizationCodeValue(request.code);
  const parsedCodePlayerId = String(sanitizePlayerId(parsedCode.playerId || '') || '');
  const columns = CONFIG.COLUMNS || {};
  const updatedValues = record.values.slice();
  const currentPlayerIdValue = columns.playerId ? updatedValues[columns.playerId - 1] : '';
  emailLookupPlayerId = String(sanitizePlayerId(record.playerId || currentPlayerIdValue) || '');
  pendingPlayerId = String(sanitizePlayerId(stripPendingPlayerId(currentPlayerIdValue)) || '');
  pendingPlayerIdMatches = Boolean(pendingPlayerId) && pendingPlayerId === sanitizedCodePlayerId;

  const accessCheck = verifyRequestAccessToEmail(request, record);
  emailMatchesLogin = Boolean(accessCheck && accessCheck.emailMatchesLogin);
  if (!accessCheck.success) {
    return Object.assign({}, accessCheck, {
      pendingPlayerIdMatches,
      emailLookupPlayerId,
      pendingPlayerId,
      emailMatchesLogin,
    });
  }

  if (!sanitizedCodePlayerId || !sanitizedCharId || !parsedCodePlayerId) {
    return {
      success: false,
      message: '承認情報に不整合があります。',
      pendingPlayerIdMatches,
      emailLookupPlayerId,
      pendingPlayerId,
      emailMatchesLogin,
    };
  }

  if (parsedCodePlayerId && parsedCodePlayerId !== sanitizedCodePlayerId) {
    return {
      success: false,
      message: '承認情報に不整合があります。',
      pendingPlayerIdMatches,
      emailLookupPlayerId,
      pendingPlayerId,
      emailMatchesLogin,
    };
  }

  if (sanitizedCharId !== sanitizedCodePlayerId) {
    return {
      success: false,
      message: '承認情報に不整合があります。',
      pendingPlayerIdMatches,
      emailLookupPlayerId,
      pendingPlayerId,
      emailMatchesLogin,
    };
  }

  if (!isPendingPlayerIdValue(currentPlayerIdValue)) {
    return {
      success: false,
      message: '申請中の情報が見つかりません。',
      pendingPlayerIdMatches,
      emailLookupPlayerId,
      pendingPlayerId,
      emailMatchesLogin,
    };
  }

  if (!pendingPlayerId || pendingPlayerId !== sanitizedCodePlayerId) {
    return {
      success: false,
      message: '承認情報に不整合があります。',
      pendingPlayerIdMatches,
      emailLookupPlayerId,
      pendingPlayerId,
      emailMatchesLogin,
    };
  }

  if (columns.playerId) {
    updatedValues[columns.playerId - 1] = sanitizedCodePlayerId;
  }
  if (columns.authority) {
    updatedValues[columns.authority - 1] = EDITOR_AUTHORITY_VALUE;
  }
  if (columns.updatedAt) {
    updatedValues[columns.updatedAt - 1] = new Date();
  }

  const rowRange = sheet.getRange(record.rowNumber, 1, 1, sheet.getLastColumn());
  rowRange.setValues([updatedValues]);

  return {
    success: true,
    autoApproved: true,
    message: '申請を承認しました。',
    playerId: columns.playerId ? updatedValues[columns.playerId - 1] || sanitizedCodePlayerId : sanitizedCodePlayerId,
    kingdom: columns.kingdom ? updatedValues[columns.kingdom - 1] || '' : '',
    authority: EDITOR_AUTHORITY_VALUE,
    pendingPlayerIdMatches,
    emailLookupPlayerId,
    pendingPlayerId,
    emailMatchesLogin,
  };
}

function parseRequest(e) {
  const data = parseRequestData(e);
  return {
    action: data.action,
    search: data.search || data.query || '',
    limit: parsePositiveInteger(data.limit),
    offset: parsePositiveInteger(data.offset),
    playerId: data.playerId || data.loginId || data.email || '',
    currentPlayerId: data.currentPlayerId || '',
    requestedPlayerId: data.requestedPlayerId || data.pendingPlayerId || '',
    email: data.email || '',
    googleEmail: data.googleEmail || data.googleAccountEmail || data.email || '',
    adminToken: data.adminToken || data.adminSessionToken || data.token || '',
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

function sanitizePlayerId(value) {
  if (value === null || value === undefined) {
    return '';
  }
  let normalizedValue = String(value);
  if (typeof normalizedValue.normalize === 'function') {
    normalizedValue = normalizedValue.normalize('NFKC');
  }
  return normalizedValue
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9]/g, '');
}

function stripPendingPlayerId(value) {
  if (value === null || value === undefined) {
    return '';
  }
  let normalizedValue = String(value);
  if (typeof normalizedValue.normalize === 'function') {
    normalizedValue = normalizedValue.normalize('NFKC');
  }
  normalizedValue = normalizedValue.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  normalizedValue = normalizedValue.replace(/^[!！]+/, '');
  return normalizedValue;
}

function sanitizeAuthority(value) {
  return parseAuthorityValue(value);
}

function isPendingPlayerIdValue(value) {
  return typeof value === 'string' && value.toString().trim().indexOf('!') === 0;
}

function buildPendingPlayerId(value) {
  const sanitized = sanitizePlayerId(value);
  return sanitized ? '!' + sanitized : '!';
}

function parseAuthorizationCodeValue(code) {
  if (!code) {
    return {
      playerId: '',
    };
  }

  const stringValue = code.toString().trim();
  if (!stringValue) {
    return {
      playerId: '',
    };
  }

  try {
    const decodedBytes = Utilities.base64Decode(stringValue);
    const decodedText = Utilities.newBlob(decodedBytes).getDataAsString('UTF-8');
    return {
      playerId: sanitizePlayerId(decodedText),
    };
  } catch (error) {
    return {
      playerId: '',
    };
  }
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
  const columns = CONFIG.COLUMNS;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowPlayerId = normalizeId(columns.playerId ? row[columns.playerId - 1] : '');
    const rowEmail = columns.email ? normalizeId(row[columns.email - 1]) : '';

    const playerMatch = normalizedPlayerId && rowPlayerId && rowPlayerId === normalizedPlayerId;
    const emailMatch = normalizedEmail && rowEmail && rowEmail === normalizedEmail;

    if (playerMatch || emailMatch) {
      return {
        rowNumber: firstDataRow + i,
        values: row,
        playerId: columns.playerId ? row[columns.playerId - 1] : identifiers.playerId || '',
        username: columns.username ? row[columns.username - 1] || '' : '',
        email:
          columns.email && row[columns.email - 1]
            ? row[columns.email - 1]
            : safeIdentifiers.email || '',
        kingdom: columns.kingdom ? row[columns.kingdom - 1] || '' : '',
        language: columns.language ? sanitizeLanguage(row[columns.language - 1]) : 'ja',
        authority: columns.authority ? sanitizeAuthority(row[columns.authority - 1]) : null,
      };
    }
  }

  return null;
}

function parseAuthorityValue(value) {
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

function timestampsAreEquivalent(firstValue, secondValue) {
  const firstDate = coerceDateValue(firstValue);
  const secondDate = coerceDateValue(secondValue);

  if (firstDate && secondDate) {
    const difference = Math.abs(firstDate.getTime() - secondDate.getTime());
    return difference <= 1000;
  }

  const normalizedFirst = formatDateValue(firstValue);
  const normalizedSecond = formatDateValue(secondValue);
  return Boolean(normalizedFirst && normalizedSecond && normalizedFirst === normalizedSecond);
}

function coerceDateValue(value) {
  if (!value && value !== 0) {
    return null;
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const dateFromNumber = new Date(value);
    return isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsedDate = new Date(trimmed);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
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

  if (Object.prototype.hasOwnProperty.call(result, 'playerId')) {
    payload.playerId = result.playerId || null;
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
  if (Object.prototype.hasOwnProperty.call(result, 'adminToken')) {
    payload.adminToken = result.adminToken || '';
  }
  if (Object.prototype.hasOwnProperty.call(result, 'adminTokenIssuedAt')) {
    payload.adminTokenIssuedAt = result.adminTokenIssuedAt || '';
  }
  if (Object.prototype.hasOwnProperty.call(result, 'adminTokenExpiresAt')) {
    payload.adminTokenExpiresAt = result.adminTokenExpiresAt || '';
  }
  if (Object.prototype.hasOwnProperty.call(result, 'adminAuthority')) {
    payload.adminAuthority = result.adminAuthority;
  }
  if (Object.prototype.hasOwnProperty.call(result, 'adminEmail')) {
    payload.adminEmail = result.adminEmail || '';
  }
  if (Object.prototype.hasOwnProperty.call(result, 'requiresReauthentication')) {
    payload.requiresReauthentication = Boolean(result.requiresReauthentication);
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

  const normalizedRequestOrigin = (requestOrigin || '').trim();
  var resolvedOrigin = '';

  if (normalizedRequestOrigin && allowedOrigins.indexOf(normalizedRequestOrigin) !== -1) {
    output
      .setHeader('Access-Control-Allow-Origin', normalizedRequestOrigin)
      .setHeader('Vary', 'Origin');
  }

  return output;
}
