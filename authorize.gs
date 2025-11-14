const AUTH_CONFIG = {
  SHEET_ID: '1mVVuS5bS50-YoVQyDIOM09Oi2YIpRIyIAfXDeBcw6N8',
  SHEET_NAME: 'Accounts',
  HEADER_ROW_INDEX: 1,
  PLAYER_ID_COLUMN: 1,
  USERNAME_COLUMN: 2,
  EMAIL_COLUMN: 3,
  AUTHORITY_COLUMN: 6,
  UPDATED_AT_COLUMN: 7,
  ALLOWED_UPDATE_AUTHORITY_VALUES: [-1, 1, 2, 3],
  ALLOWED_ORIGINS: [
    'https://brahmoon.github.io',
    'http://localhost:3000',
    'http://localhost:4173'
  ]
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

const AUTHORITIES_CONFIG = {
  SHEET_NAME: 'Authorities',
  HEADER_ROW_INDEX: 1,
  COLUMNS: {
    type: 1,
    folderKey: 2,
    role: 3,
    canUpload: 4,
    canDelete: 5,
    updatedAt: 6
  }
};

const DRIVE_IMAGE_ADMIN_ROLE = typeof ADMINISTRATOR_ROLE !== 'undefined'
  ? ADMINISTRATOR_ROLE
  : 'Administrator';
// Determine the numeric baseline for administrator privileges. If the host
// project exposes ADMIN_AUTHORITY_VALUE we honour it, otherwise we derive the
// highest configured authority level so numeric accounts (e.g. authority=3)
// continue to map to the administrator role instead of falling back to
// Moderator.
const ADMIN_AUTHORITY_THRESHOLD = (function resolveAdminAuthorityBaseline() {
  if (typeof ADMIN_AUTHORITY_VALUE !== 'undefined') {
    const explicit = parseAuthorityValue(ADMIN_AUTHORITY_VALUE);
    if (explicit !== null) {
      return explicit;
    }
  }

  return 99;
})();
const DRIVE_IMAGE_ADMIN_AUTHORITY = ADMIN_AUTHORITY_THRESHOLD;
const DRIVE_IMAGE_ROLES = Array.from(new Set([
  DRIVE_IMAGE_ADMIN_ROLE,
  'Moderator',
  'Editor'
]));
const DRIVE_IMAGE_ROOT_KEY = '__root__';
const ADMIN_TOKEN_SECRET_PROPERTY_KEY = 'ADMIN_TOKEN_SECRET';
const ADMIN_TOKEN_TTL_SECONDS = 5 * 60;
const ADMIN_TOKEN_CLOCK_SKEW_MS = 15 * 1000;
let ADMIN_TOKEN_SECRET_CACHE = null;

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
    } else if (action === 'getDriveImagePermissions') {
      result = getDriveImagePermissions(request);
    } else if (action === 'getToolbarPlugins') {
      let optionalVerification = null;
      if (hasAdminIdentityPayload(request)) {
        const verificationAttempt = verifyAdminAccess(sheet, request);
        if (verificationAttempt && verificationAttempt.success) {
          optionalVerification = verificationAttempt;
        }
      }
      result = getToolbarPlugins(optionalVerification);
    } else {
      const verification = verifyAdminAccess(sheet, request);
      if (!verification.success) {
        return buildResponse(verification, origin);
      }

      if (action === 'updateAuthority') {
        result = updateAuthority(sheet, request, verification);
      } else if (action === 'updateToolbarPlugins') {
        result = updateToolbarPlugins(sheet, request, verification);
      } else if (action === 'getDriveImageAuthorities') {
        result = getDriveImageAuthorities(sheet, request, verification);
      } else if (action === 'updateDriveImageAuthorities') {
        result = updateDriveImageAuthorities(sheet, request, verification);
      } else {
        result = {
          success: false,
          message: `Unknown action: ${action}`
        };
      }

      result = extendWithAdminToken(result, verification);
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
  const safeRequest = request || {};
  const tokenInfo = validateAdminToken(safeRequest.adminToken);
  const tokenPayload = tokenInfo && tokenInfo.valid ? tokenInfo.payload : null;
  const fallbackGoogleEmail = tokenPayload
    ? tokenPayload.googleAccountEmail || tokenPayload.email || ''
    : '';
  const fallbackEmail = tokenPayload ? tokenPayload.email || '' : '';

  const normalizedGoogleEmail = normalizeId(
    safeRequest.googleEmail || fallbackGoogleEmail
  );
  const normalizedEmail = normalizeId(safeRequest.email || fallbackEmail);
  const lookupEmail = normalizedGoogleEmail || normalizedEmail;

  if (!lookupEmail) {
    return {
      success: false,
      message: '管理者アカウント情報が不足しています。'
    };
  }

  const account = findAccount(sheet, {
    email: safeRequest.email || fallbackEmail,
    googleEmail: safeRequest.googleEmail || fallbackGoogleEmail
  });

  if (!account) {
    return {
      success: false,
      message: '管理者アカウントが登録されていません。'
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

  const normalizedAccountEmail = normalizeId(account.email);
  if (
    normalizedGoogleEmail &&
    normalizedAccountEmail &&
    normalizedGoogleEmail !== normalizedAccountEmail
  ) {
    return {
      success: false,
      message: '管理者アカウントのメールアドレスが一致しません。'
    };
  }

  if (tokenPayload) {
    const normalizedTokenEmail = normalizeId(tokenPayload.email);
    if (
      normalizedTokenEmail &&
      normalizedAccountEmail &&
      normalizedTokenEmail !== normalizedAccountEmail
    ) {
      return {
        success: false,
        message: '管理者トークンのアカウント情報が一致しません。'
      };
    }
  }

  const googleAccountEmail =
    safeRequest.googleEmail || fallbackGoogleEmail || account.email || '';
  const token = issueAdminAccessToken(account, {
    googleAccountEmail,
    email: account.email || fallbackEmail || ''
  });

  return {
    success: true,
    message: '管理者権限が確認されました。',
    playerId: account.playerId,
    username: account.username,
    email: account.email,
    authority: authorityValue,
    googleAccountEmail,
    adminToken: token.token,
    adminTokenExpiresAt: token.expiresAt
  };
}

function hasAdminIdentityPayload(request) {
  if (!request) {
    return false;
  }

  return Boolean(
    request.adminToken ||
      normalizeId(request.googleEmail) ||
      normalizeId(request.email) ||
      normalizeId(request.playerId)
  );
}

function updateAuthority(sheet, request, adminVerification) {
  const verification =
    adminVerification && adminVerification.success
      ? adminVerification
      : verifyAdminAccess(sheet, request);
  if (!verification.success) {
    return verification;
  }

  const normalizedTargetPlayerId = normalizeId(request.targetPlayerId);
  if (!normalizedTargetPlayerId) {
    return {
      success: false,
      message: '対象ユーザーが指定されていません。'
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

  const updateResult = applyAuthorityUpdate(sheet, normalizedTargetPlayerId, authorityValue);
  if (!updateResult.success) {
    return updateResult;
  }

  return extendWithAdminToken(
    {
      success: true,
      message: updateResult.message,
      updatedAuthority: authorityValue,
      updatedAt: updateResult.updatedAt,
      targetPlayerId: updateResult.targetPlayerId
    },
    verification
  );
}

function extendWithAdminToken(result, adminVerification) {
  if (!adminVerification || !adminVerification.success) {
    return result;
  }

  const token = adminVerification.adminToken;
  if (!token) {
    return result;
  }

  if (!result || typeof result !== 'object') {
    return result;
  }

  const extended = Object.assign({}, result);
  extended.adminToken = token;
  extended.adminTokenExpiresAt = adminVerification.adminTokenExpiresAt;
  return extended;
}

function issueAdminAccessToken(account, identity) {
  const now = new Date();
  const issuedAtSeconds = Math.floor(now.getTime() / 1000);
  const expiresAtMs = now.getTime() + ADMIN_TOKEN_TTL_SECONDS * 1000;
  const payload = {
    email: account.email || (identity && identity.email) || '',
    googleAccountEmail:
      (identity && identity.googleAccountEmail) || account.email || '',
    playerId: account.playerId || '',
    authority: account.authority,
    iat: issuedAtSeconds,
    exp: Math.floor(expiresAtMs / 1000)
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Utilities.base64EncodeWebSafe(payloadJson);
  const signatureBytes = Utilities.computeHmacSha256Signature(
    payloadBase64,
    getAdminTokenSecret()
  );
  const signatureBase64 = Utilities.base64EncodeWebSafe(signatureBytes);

  return {
    token: `${payloadBase64}.${signatureBase64}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
    payload
  };
}

function validateAdminToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const payloadBase64 = parts[0];
  const signatureBase64 = parts[1];

  try {
    const expectedSignature = Utilities.computeHmacSha256Signature(
      payloadBase64,
      getAdminTokenSecret()
    );
    const providedSignature = Utilities.base64DecodeWebSafe(signatureBase64);

    if (!byteArrayEquals(expectedSignature, providedSignature)) {
      return { valid: false };
    }

    const payloadJson = Utilities.newBlob(
      Utilities.base64DecodeWebSafe(payloadBase64)
    ).getDataAsString();

    if (!payloadJson) {
      return { valid: false };
    }

    const payload = JSON.parse(payloadJson);
    const expiresAtSeconds = Number(payload.exp);
    if (!Number.isFinite(expiresAtSeconds)) {
      return { valid: false };
    }

    const nowMs = Date.now();
    const expiresAtMs = expiresAtSeconds * 1000;
    if (expiresAtMs + ADMIN_TOKEN_CLOCK_SKEW_MS < nowMs) {
      return { valid: false };
    }

    if (payload.iat) {
      const notBeforeMs = Number(payload.iat) * 1000 - ADMIN_TOKEN_CLOCK_SKEW_MS;
      if (Number.isFinite(notBeforeMs) && notBeforeMs > nowMs) {
        return { valid: false };
      }
    }

    return {
      valid: true,
      payload,
      expiresAt: new Date(expiresAtMs).toISOString()
    };
  } catch (error) {
    return { valid: false };
  }
}

function getAdminTokenSecret() {
  if (ADMIN_TOKEN_SECRET_CACHE) {
    return ADMIN_TOKEN_SECRET_CACHE;
  }

  let secret = '';
  if (typeof PropertiesService !== 'undefined' && PropertiesService) {
    const scriptProperties = PropertiesService.getScriptProperties();
    if (scriptProperties) {
      secret = scriptProperties.getProperty(ADMIN_TOKEN_SECRET_PROPERTY_KEY) || '';
      if (!secret) {
        secret = `${Utilities.getUuid()}${Utilities.getUuid()}`.replace(/-/g, '');
        scriptProperties.setProperty(ADMIN_TOKEN_SECRET_PROPERTY_KEY, secret);
      }
    }
  }

  if (!secret) {
    secret = `${Utilities.getUuid()}${Utilities.getUuid()}`.replace(/-/g, '');
  }

  ADMIN_TOKEN_SECRET_CACHE = secret;
  return ADMIN_TOKEN_SECRET_CACHE;
}

function byteArrayEquals(first, second) {
  if (!first || !second || first.length !== second.length) {
    return false;
  }

  for (let i = 0; i < first.length; i += 1) {
    if (first[i] !== second[i]) {
      return false;
    }
  }

  return true;
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

function getToolbarPlugins(adminVerification) {
  const states = loadToolbarStates();
  return extendWithAdminToken(
    {
      success: true,
      message: 'Toolbar plugin states retrieved.',
      toolbarConfig: buildToolbarConfigResponse(states)
    },
    adminVerification
  );
}

function updateToolbarPlugins(sheet, request, adminVerification) {
  const verification =
    adminVerification && adminVerification.success
      ? adminVerification
      : verifyAdminAccess(sheet, request);
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

  return extendWithAdminToken(
    {
      success: true,
      message: 'TipTapツールバーの設定を保存しました。',
      toolbarConfig: buildToolbarConfigResponse(savedStates)
    },
    verification
  );
}

function getAuthoritiesSheet(createIfMissing) {
  const spreadsheet = getSpreadsheet();
  if (!spreadsheet) {
    return null;
  }

  let sheet = spreadsheet.getSheetByName(AUTHORITIES_CONFIG.SHEET_NAME);
  if (!sheet && createIfMissing) {
    sheet = spreadsheet.insertSheet(AUTHORITIES_CONFIG.SHEET_NAME);
  }

  if (sheet) {
    ensureAuthoritiesHeader(sheet);
  }

  return sheet;
}

function ensureAuthoritiesHeader(sheet) {
  if (!sheet) {
    return;
  }

  const headerRow = AUTHORITIES_CONFIG.HEADER_ROW_INDEX || 1;
  const columns = AUTHORITIES_CONFIG.COLUMNS || {};
  const requiredColumns = Object.keys(columns).reduce((max, key) => {
    const index = Number(columns[key]);
    return Number.isFinite(index) && index > max ? index : max;
  }, 0);

  if (requiredColumns <= 0) {
    return;
  }

  const currentLastColumn = sheet.getLastColumn();
  if (currentLastColumn < requiredColumns) {
    const missing = requiredColumns - currentLastColumn;
    sheet.insertColumnsAfter(currentLastColumn || 1, missing);
  }

  const headers = new Array(requiredColumns).fill('');
  headers[(columns.type || 1) - 1] = 'Type';
  headers[(columns.folderKey || 2) - 1] = 'Folder Key';
  headers[(columns.role || 3) - 1] = 'Role';
  headers[(columns.canUpload || 4) - 1] = 'Can Upload';
  headers[(columns.canDelete || 5) - 1] = 'Can Delete';
  headers[(columns.updatedAt || 6) - 1] = 'Updated At';

  sheet.getRange(headerRow, 1, 1, requiredColumns).setValues([headers]);
}

function normalizeBooleanCell(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (value instanceof Date) {
    return true;
  }

  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y' || normalized === 'on';
}

function normalizeDriveImageFolderKey(value) {
  const text = value === null || value === undefined ? '' : value;
  const trimmed = text.toString().trim();
  if (!trimmed || trimmed === DRIVE_IMAGE_ROOT_KEY) {
    return DRIVE_IMAGE_ROOT_KEY;
  }
  return trimmed;
}

function resolveDriveImageRole(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    if (value >= DRIVE_IMAGE_ADMIN_AUTHORITY) {
      return DRIVE_IMAGE_ADMIN_ROLE;
    }
    if (value >= 3) {
      return 'Moderator';
    }
    if (value >= 2) {
      return 'Editor';
    }
    return null;
  }

  const stringValue = value.toString().trim();
  if (!stringValue) {
    return null;
  }

  const lower = stringValue.toLowerCase();
  if (lower === DRIVE_IMAGE_ADMIN_ROLE.toLowerCase() || lower === 'administrator' || lower === 'admin') {
    return DRIVE_IMAGE_ADMIN_ROLE;
  }
  if (lower === 'moderator') {
    return 'Moderator';
  }
  if (lower === 'editor') {
    return 'Editor';
  }

  const numeric = Number(stringValue);
  if (Number.isFinite(numeric)) {
    return resolveDriveImageRole(numeric);
  }

  return null;
}

function compareDriveImageRoles(roleA, roleB) {
  if (roleA === roleB) {
    return 0;
  }

  const indexA = DRIVE_IMAGE_ROLES.indexOf(roleA);
  const indexB = DRIVE_IMAGE_ROLES.indexOf(roleB);

  if (indexA === -1 && indexB === -1) {
    return roleA.localeCompare(roleB, 'ja');
  }
  if (indexA === -1) {
    return 1;
  }
  if (indexB === -1) {
    return -1;
  }
  return indexA - indexB;
}

function extractImageAuthoritiesPayload(authorities) {
  if (!authorities || typeof authorities !== 'object') {
    return {};
  }

  const candidates = [authorities.Image, authorities.image];
  for (let i = 0; i < candidates.length; i++) {
    const value = candidates[i];
    if (value && typeof value === 'object') {
      return value;
    }
  }

  return {};
}

function readDriveImageAuthorities() {
  const sheet = getAuthoritiesSheet(false);
  const result = { Image: {} };

  if (!sheet) {
    return result;
  }

  const headerRow = AUTHORITIES_CONFIG.HEADER_ROW_INDEX || 1;
  const lastRow = sheet.getLastRow();
  if (lastRow <= headerRow) {
    return result;
  }

  const columns = AUTHORITIES_CONFIG.COLUMNS || {};
  const requiredColumns = Object.keys(columns).reduce((max, key) => {
    const index = Number(columns[key]);
    return Number.isFinite(index) && index > max ? index : max;
  }, 0);
  const lastColumn = Math.max(sheet.getLastColumn(), requiredColumns);
  const rowCount = lastRow - headerRow;

  if (rowCount <= 0 || lastColumn <= 0) {
    return result;
  }

  const range = sheet.getRange(headerRow + 1, 1, rowCount, lastColumn);
  const values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const typeCell = row[(columns.type || 1) - 1];
    const type = typeCell ? typeCell.toString().trim().toLowerCase() : '';
    if (type !== 'image') {
      continue;
    }

    const folderKey = normalizeDriveImageFolderKey(row[(columns.folderKey || 2) - 1]);
    const role = resolveDriveImageRole(row[(columns.role || 3) - 1]);
    if (!role) {
      continue;
    }

    if (!result.Image[folderKey]) {
      result.Image[folderKey] = {};
    }

    result.Image[folderKey][role] = {
      upload: normalizeBooleanCell(row[(columns.canUpload || 4) - 1]),
      delete: normalizeBooleanCell(row[(columns.canDelete || 5) - 1])
    };
  }

  return result;
}

function writeDriveImageAuthorities(authorities) {
  const sheet = getAuthoritiesSheet(true);
  if (!sheet) {
    throw new Error('権限シートを取得できませんでした。');
  }

  const columns = AUTHORITIES_CONFIG.COLUMNS || {};
  const headerRow = AUTHORITIES_CONFIG.HEADER_ROW_INDEX || 1;
  const requiredColumns = Object.keys(columns).reduce((max, key) => {
    const index = Number(columns[key]);
    return Number.isFinite(index) && index > max ? index : max;
  }, 0);

  const lastColumn = Math.max(sheet.getLastColumn(), requiredColumns);
  const startRow = headerRow + 1;
  const existingRowCount = Math.max(0, sheet.getLastRow() - headerRow);

  const imageAuthorities = extractImageAuthoritiesPayload(authorities);
  const timestamp = new Date();
  const rows = [];

  Object.keys(imageAuthorities).forEach((key) => {
    const folderEntry = imageAuthorities[key];
    if (!folderEntry || typeof folderEntry !== 'object') {
      return;
    }

    const folderKey = normalizeDriveImageFolderKey(key);

    Object.keys(folderEntry).forEach((roleKey) => {
      const role = resolveDriveImageRole(roleKey);
      if (!role) {
        return;
      }

      const permissions = folderEntry[roleKey] || {};
      const row = new Array(lastColumn).fill('');
      row[(columns.type || 1) - 1] = 'Image';
      row[(columns.folderKey || 2) - 1] = folderKey;
      row[(columns.role || 3) - 1] = role;
      row[(columns.canUpload || 4) - 1] = Boolean(permissions.upload);
      row[(columns.canDelete || 5) - 1] = Boolean(permissions.delete);
      row[(columns.updatedAt || 6) - 1] = timestamp;
      rows.push(row);
    });
  });

  rows.sort((a, b) => {
    const folderA = (a[(columns.folderKey || 2) - 1] || '').toString();
    const folderB = (b[(columns.folderKey || 2) - 1] || '').toString();
    const folderComparison = folderA.localeCompare(folderB, 'ja');
    if (folderComparison !== 0) {
      return folderComparison;
    }
    const roleA = (a[(columns.role || 3) - 1] || '').toString();
    const roleB = (b[(columns.role || 3) - 1] || '').toString();
    return compareDriveImageRoles(roleA, roleB);
  });

  const existingValues = existingRowCount > 0
    ? sheet.getRange(startRow, 1, existingRowCount, lastColumn).getValues()
    : [];
  const preservedRows = [];

  for (let i = 0; i < existingValues.length; i++) {
    const row = existingValues[i];
    const typeCell = row[(columns.type || 1) - 1];
    const type = typeCell ? typeCell.toString().trim().toLowerCase() : '';
    if (type !== 'image') {
      preservedRows.push(row);
    }
  }

  const outputRows = preservedRows.concat(rows);

  if (existingRowCount > 0) {
    sheet.getRange(startRow, 1, existingRowCount, lastColumn).clearContent();
  }

  if (outputRows.length === 0) {
    return;
  }

  const availableRows = sheet.getMaxRows() - headerRow;
  if (outputRows.length > availableRows) {
    const additionalRows = outputRows.length - availableRows;
    sheet.insertRowsAfter(sheet.getMaxRows(), additionalRows);
  }

  sheet.getRange(startRow, 1, outputRows.length, lastColumn).setValues(outputRows);
}

function initializeDriveImageAuthoritiesSheet() {
  try {
    const adminRole = typeof ADMINISTRATOR_ROLE !== 'undefined' ? ADMINISTRATOR_ROLE : 'Administrator';
    const rootKey = typeof DRIVE_IMAGE_ROOT_KEY !== 'undefined' ? DRIVE_IMAGE_ROOT_KEY : '__root__';

    const roles = (typeof getDriveImageRolesForInitialization === 'function'
      ? getDriveImageRolesForInitialization()
      : [adminRole, 'Moderator', 'Editor']
    ).slice();

    if (roles.indexOf(adminRole) === -1) {
      roles.unshift(adminRole);
    }

    const folderKeysSource = typeof collectDriveImageFolderKeys === 'function'
      ? collectDriveImageFolderKeys()
      : [rootKey];
    const folderKeys = Array.isArray(folderKeysSource) ? folderKeysSource.slice() : [rootKey];

    if (!folderKeys.length) {
      folderKeys.push(rootKey);
    }

    if (folderKeys.indexOf(rootKey) === -1) {
      folderKeys.unshift(rootKey);
    }

    const authorities = { Image: {} };

    folderKeys.forEach((folderKey) => {
      if (!authorities.Image[folderKey]) {
        authorities.Image[folderKey] = {};
      }

      roles.forEach((role) => {
        const isAdmin = role === adminRole;
        authorities.Image[folderKey][role] = {
          upload: isAdmin,
          delete: isAdmin
        };
      });
    });

    writeDriveImageAuthorities(authorities);

    return {
      success: true,
      message: 'Drive画像権限シートを初期化しました。',
      folders: folderKeys.length,
      rows: folderKeys.length * roles.length
    };
  } catch (error) {
    const message = error && error.message ? error.message : error;
    return {
      success: false,
      message: `権限シートの初期化に失敗しました: ${message}`
    };
  }
}

function getDriveImageAuthorities(sheet, request, adminVerification) {
  const verification =
    adminVerification && adminVerification.success
      ? adminVerification
      : verifyAdminAccess(sheet, request);
  if (!verification.success) {
    return verification;
  }

  const authorities = readDriveImageAuthorities();

  return extendWithAdminToken(
    {
      success: true,
      message: 'Drive画像の権限を取得しました。',
      authorities
    },
    verification
  );
}

function updateDriveImageAuthorities(sheet, request, adminVerification) {
  const verification =
    adminVerification && adminVerification.success
      ? adminVerification
      : verifyAdminAccess(sheet, request);
  if (!verification.success) {
    return verification;
  }

  if (!request.authorities || typeof request.authorities !== 'object') {
    return {
      success: false,
      message: '権限データが指定されていません。'
    };
  }

  writeDriveImageAuthorities(request.authorities);
  const updated = readDriveImageAuthorities();

  return extendWithAdminToken(
    {
      success: true,
      message: 'Drive画像の権限を保存しました。',
      authorities: updated
    },
    verification
  );
}

function getDriveImagePermissions(request) {
  const normalizedGoogleEmail = normalizeId(request.googleEmail || request.email);
  if (!normalizedGoogleEmail) {
    return {
      success: false,
      message: 'Googleアカウント情報が指定されていません。',
      playerId: ''
    };
  }

  const sheet = getAccountsSheet();
  if (!sheet) {
    return {
      success: false,
      message: `シート「${AUTH_CONFIG.SHEET_NAME}」が見つかりません。`,
      playerId: ''
    };
  }

  const account = findAccount(sheet, {
    googleEmail: request.googleEmail,
    email: request.email
  });

  if (!account) {
    return {
      success: true,
      message: '権限を判定できませんでした。',
      permissions: {},
      authority: null,
      role: '',
      playerId: ''
    };
  }

  const authorityValue = parseAuthorityValue(account.authority);
  const role = resolveDriveImageRole(
    authorityValue !== null && authorityValue !== undefined
      ? authorityValue
      : account.authority
  );

  const authorities = readDriveImageAuthorities();
  const imageAuthorities = authorities.Image || {};
  const permissions = {};

  if (role) {
    Object.keys(imageAuthorities).forEach((folderKey) => {
      const folderEntry = imageAuthorities[folderKey];
      if (!folderEntry || typeof folderEntry !== 'object') {
        return;
      }

      const roleEntry = folderEntry[role];
      if (!roleEntry || typeof roleEntry !== 'object') {
        return;
      }

      permissions[folderKey] = {
        upload: Boolean(roleEntry.upload),
        delete: Boolean(roleEntry.delete)
      };
    });
  }

  if (!Object.prototype.hasOwnProperty.call(permissions, DRIVE_IMAGE_ROOT_KEY)) {
    permissions[DRIVE_IMAGE_ROOT_KEY] = { upload: false, delete: false };
  }

  return {
    success: true,
    message: 'Drive画像の権限を返却しました。',
    permissions,
    authority:
      account.authority !== null && account.authority !== undefined && account.authority !== ''
        ? account.authority
        : null,
    role: role || '',
    email: account.email || '',
    playerId: account.playerId || ''
  };
}

function applyAuthorityUpdate(sheet, normalizedTargetPlayerId, authorityValue) {
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

  const playerIndex = AUTH_CONFIG.PLAYER_ID_COLUMN - 1;
  const updatedAtColumn = AUTH_CONFIG.UPDATED_AT_COLUMN;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowPlayerId = playerIndex >= 0 ? normalizeId(row[playerIndex]) : '';

    if (rowPlayerId === normalizedTargetPlayerId) {
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
        targetPlayerId: row[playerIndex] || '',
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

function parseRequest(e) {
  const data = parseRequestData(e);
  return {
    action: data.action,
    playerId:
      data.playerId ||
      data.loginId ||
      data.expectedPlayerId ||
      data.expectedLoginId ||
      '',
    email: data.email || '',
    googleEmail: data.googleEmail || data.googleAccountEmail || data.email || '',
    requiredPlayerId:
      data.requiredPlayerId ||
      data.requiredLoginId ||
      data.expectedPlayerId ||
      data.expectedLoginId ||
      '',
    allowedPlayerIds: Array.isArray(data.allowedPlayerIds) ? data.allowedPlayerIds : [],
    allowedLoginIds: Array.isArray(data.allowedLoginIds) ? data.allowedLoginIds : [],
    targetPlayerId:
      data.targetPlayerId ||
      data.targetLoginId ||
      data.memberPlayerId ||
      data.memberLoginId ||
      '',
    authority: data.authority !== undefined ? data.authority : data.role,
    toolbarStates: data.toolbarStates,
    toolbarKeys: data.toolbarKeys,
    toolbarConfig: data.toolbarConfig,
    role: data.role || data.targetRole || '',
    authorities: data.authorities,
    resourceType: data.resourceType || data.type || '',
    authorityLevel: data.authorityLevel || data.authority
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
  const normalizedPlayerId = normalizeId(identifiers.playerId);
  const normalizedEmail = normalizeId(identifiers.email);

  const playerIndex = AUTH_CONFIG.PLAYER_ID_COLUMN - 1;
  const usernameIndex = AUTH_CONFIG.USERNAME_COLUMN - 1;
  const emailIndex = AUTH_CONFIG.EMAIL_COLUMN - 1;

  const authorityIndex = AUTH_CONFIG.AUTHORITY_COLUMN
    ? AUTH_CONFIG.AUTHORITY_COLUMN - 1
    : -1;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowPlayerId = playerIndex >= 0 ? normalizeId(row[playerIndex]) : '';
    const rowEmail = emailIndex >= 0 ? normalizeId(row[emailIndex]) : '';

    if (normalizedGoogleEmail && rowEmail === normalizedGoogleEmail) {
      return {
        playerId: row[playerIndex] || '',
        username: usernameIndex >= 0 ? row[usernameIndex] || '' : '',
        email: row[emailIndex] || '',
        authority: authorityIndex >= 0 ? row[authorityIndex] : null
      };
    }

    if (normalizedPlayerId && rowPlayerId === normalizedPlayerId) {
      return {
        playerId: row[playerIndex] || '',
        username: usernameIndex >= 0 ? row[usernameIndex] || '' : '',
        email: row[emailIndex] || '',
        authority: authorityIndex >= 0 ? row[authorityIndex] : null
      };
    }

    if (normalizedEmail && rowEmail === normalizedEmail) {
      return {
        playerId: row[playerIndex] || '',
        username: usernameIndex >= 0 ? row[usernameIndex] || '' : '',
        email: row[emailIndex] || '',
        authority: authorityIndex >= 0 ? row[authorityIndex] : null
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
    'playerId',
    'username',
    'email',
    'googleAccountEmail',
    'targetPlayerId',
    'updatedAuthority',
    'updatedAt',
    'toolbarConfig',
    'authorities',
    'permissions',
    'authority',
    'role'
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
