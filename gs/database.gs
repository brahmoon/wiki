const DB_CONFIG = {
  SHEET_ID: '1LspGEwMTA4MM6S8GNT1Jj9kevcMyAuzxirnhPqdpVdU',
  HERO_SHEET_NAME: 'DB_Hero',
  SKILL_SHEET_NAME: 'DB_Skill',
  HEADER_ROW_INDEX: 1,
  ALLOWED_ORIGINS: [
    'https://brahmoon.github.io',
    'http://localhost:3000',
    'http://localhost:4173'
  ],
};

const ACCOUNT_CONFIG = {
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
  MIN_DEVELOPER_AUTHORITY: 4,
};

const HERO_HEADERS = [
  'id',
  'name',
  'image',
  'url',
  'troopType',
  'grade',
  'fixedSkillIds',
  'talent1',
  'talent2',
  'talent3',
  'talent4',
  'talent5',
  'talent6'
];

const HERO_TALENT_KEYS = ['talent1', 'talent2', 'talent3', 'talent4', 'talent5', 'talent6'];

const SKILL_HEADERS = [
  'id',
  'name',
  'image',
  'description',
  'url',
  'category',
  'skillType',
  'grade'
];

function doGet(e) {
  return createJsonOutput({
    success: true,
    message: 'Database endpoint is running',
    timestamp: new Date().toISOString(),
  }, getRequestOrigin(e));
}

function doPost(e) {
  const origin = getRequestOrigin(e);
  try {
    const data = parseRequestData(e);
    const action = (data.action || '').toString();

    if (action === 'getAuthority') {
      const authority = resolveAuthority(data);
      return createJsonOutput(authority, origin);
    }

    if (action === 'getHeroSkillsetData') {
      const result = getHeroSkillsetData();
      return createJsonOutput(result, origin);
    }

    const verification = requireDeveloperAuthority(data);
    if (!verification.allowed) {
      return createJsonOutput(verification.response, origin);
    }

    const dataType = normalizeDataType(data.dataType || data.data);
    if (!dataType) {
      return createJsonOutput({
        success: false,
        message: 'Unsupported data type',
      }, origin);
    }

    let result;
    switch (action) {
      case 'listRecords':
        result = listRecords(dataType);
        break;
      case 'getRecord':
        result = getRecordById(dataType, data.id);
        break;
      case 'saveRecord':
        result = saveRecord(dataType, data.record);
        break;
      case 'deleteRecord':
        result = deleteRecord(dataType, data.id);
        break;
      default:
        result = {
          success: false,
          message: 'Unknown action',
          action,
        };
        break;
    }

    return createJsonOutput(result, origin);
  } catch (error) {
    return createJsonOutput({
      success: false,
      message: 'Internal server error: ' + (error && error.message || error),
    }, origin);
  }
}

function normalizeDataType(value) {
  const normalized = (value || '').toString().trim().toLowerCase();
  if (normalized === 'hero' || normalized === 'heroes') {
    return 'hero';
  }
  if (normalized === 'skill' || normalized === 'skills') {
    return 'skill';
  }
  return '';
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

  const allowedOrigins = (DB_CONFIG.ALLOWED_ORIGINS || []).map(function(origin) {
    return (origin || '').trim();
  }).filter(function(origin) {
    return origin;
  });

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

function parseRequestData(e) {
  const data = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function(key) {
      data[key] = Array.isArray(e.parameter[key]) ? e.parameter[key][0] : e.parameter[key];
    });
  }

  if (e && e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(e.postData.contents);
      Object.keys(parsed || {}).forEach(function(key) {
        data[key] = parsed[key];
      });
    } catch (error) {
      data.rawBody = e.postData.contents;
    }
  }

  return data;
}

function resolveAuthority(data) {
  const account = findAccount({
    playerId: data.playerId || data.loginId,
    email: data.email || data.googleEmail,
  });

  if (!account) {
    return {
      success: false,
      allowed: false,
      authority: null,
      message: '指定されたユーザは登録されていません。',
    };
  }

  const authorityValue = Number(account.authority);
  const allowed = Number.isFinite(authorityValue) && authorityValue >= ACCOUNT_CONFIG.MIN_DEVELOPER_AUTHORITY;

  return {
    success: allowed,
    allowed,
    authority: authorityValue,
    account,
    message: allowed ? '権限を確認しました。' : 'アクセス権限が不足しています。'
  };
}

function requireDeveloperAuthority(data) {
  const verification = resolveAuthority(data);
  if (!verification.allowed) {
    return {
      allowed: false,
      response: {
        success: false,
        allowed: false,
        message: verification.message || 'アクセスが拒否されました。',
      },
    };
  }
  return { allowed: true, account: verification.account };
}

function getSpreadsheet(sheetId) {
  return sheetId ? SpreadsheetApp.openById(sheetId) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetByType(dataType) {
  const spreadsheet = getSpreadsheet(DB_CONFIG.SHEET_ID);
  if (!spreadsheet) {
    throw new Error('データベース用スプレッドシートが見つかりません。');
  }
  const sheetName = dataType === 'hero' ? DB_CONFIG.HERO_SHEET_NAME : DB_CONFIG.SKILL_SHEET_NAME;
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('シートが見つかりません: ' + sheetName);
  }
  return sheet;
}

function getHeaders(dataType) {
  return dataType === 'hero' ? HERO_HEADERS : SKILL_HEADERS;
}

function ensureHeaders(sheet, headers) {
  const headerRowIndex = DB_CONFIG.HEADER_ROW_INDEX || 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < headerRowIndex) {
    sheet.getRange(headerRowIndex, 1, 1, headers.length).setValues([headers]);
    return;
  }
  const currentHeaders = sheet.getRange(headerRowIndex, 1, 1, headers.length).getValues()[0];
  const needsUpdate = headers.some(function(header, index) {
    return currentHeaders[index] !== header;
  });
  if (needsUpdate) {
    sheet.getRange(headerRowIndex, 1, 1, headers.length).setValues([headers]);
  }
}

function normalizeCellValue(value) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return '';
    }
  }
  if (Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return value.join(',');
    }
  }
  return value;
}

function parseCellValue(value) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        return trimmed;
      }
    }
    return trimmed;
  }
  return value;
}

function readRecords(dataType) {
  const sheet = getSheetByType(dataType);
  const headers = getHeaders(dataType);
  ensureHeaders(sheet, headers);

  const headerRowIndex = DB_CONFIG.HEADER_ROW_INDEX || 1;
  const firstDataRow = headerRowIndex + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < firstDataRow) {
    return [];
  }

  const rows = lastRow - headerRowIndex;
  const range = sheet.getRange(firstDataRow, 1, rows, headers.length);
  const values = range.getValues();

  return values.map(function(row) {
    const record = {};
    headers.forEach(function(header, index) {
      record[header] = parseCellValue(row[index]);
    });
    return record;
  });
}

function listRecords(dataType) {
  const records = readRecords(dataType);
  return {
    success: true,
    dataType,
    records: records.map(function(record) {
      return {
        id: record.id || '',
        name: record.name || '',
        image: record.image || '',
      };
    }),
  };
}

function normalizeStringValue(value) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  return typeof value === 'string' ? value : value.toString();
}

function normalizeFixedSkillIds(value) {
  if (!value) {
    return [];
  }

  const list = Array.isArray(value) ? value : [value];
  return list
    .map(function(entry) {
      if (typeof entry === 'string') {
        return entry;
      }
      if (entry && typeof entry === 'object') {
        if (typeof entry.id === 'string') {
          return entry.id;
        }
        if (typeof entry.name === 'string') {
          return entry.name;
        }
      }
      return '';
    })
    .filter(function(text) {
      return !!text;
    });
}

function normalizeTalentCell(value) {
  if (!value || typeof value !== 'object') {
    return '';
  }

  const name = typeof value.name === 'string' ? value.name : '';
  const type = typeof value.type === 'string' ? value.type : '';
  const description = typeof value.description === 'string' ? value.description : '';

  if (!name && !description) {
    return '';
  }

  return { name, type, description };
}

function normalizeFixedSkillEntryForApi(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  var name = typeof entry.name === 'string' ? entry.name : '';
  var type = typeof entry.type === 'string' ? entry.type : '';
  var description = typeof entry.description === 'string' ? entry.description : '';
  var image = typeof entry.image === 'string' ? entry.image : '';
  // id が無い場合は name をそのまま id に利用
  var id = typeof entry.id === 'string' ? entry.id : name;

  if (!id && !name && !description && !image) {
    return null;
  }

  return {
    id: id,
    name: name,
    type: type,
    description: description,
    image: image
  };
}

function normalizeFixedSkillsForApi(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(function(entry) {
      return normalizeFixedSkillEntryForApi(entry);
    })
    .filter(function(entry) {
      return !!entry;
    });
}

function normalizeHeroSkillsetRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  // シート上では fixedSkillIds カラムに JSON が入っている想定
  // 例: [ { name, type, description, image }, ... ]
  var rawFixed = record.fixedSkills || record.fixedSkillIds;

  // 新仕様: UI でそのまま使える形に正規化
  var fixedSkills = normalizeFixedSkillsForApi(
    Array.isArray(rawFixed) ? rawFixed : []
  );

  // 旧仕様互換: ID配列も同時に用意する（id または name）
  var fixedSkillIds = normalizeFixedSkillIds(rawFixed);

  var normalized = {
    id: normalizeStringValue(record.id),
    name: normalizeStringValue(record.name),
    image: normalizeStringValue(record.image),
    url: normalizeStringValue(record.url),
    troopType: normalizeStringValue(record.troopType),
    grade: normalizeStringValue(record.grade),

    // 旧仕様との互換（HeroSkillsetService で still 使用）
    fixedSkillIds: fixedSkillIds,

    // ★ 新仕様: HeroSkillsetCard が直接参照するフィールド
    fixedSkills: fixedSkills
  };

  HERO_TALENT_KEYS.forEach(function(key) {
    normalized[key] = normalizeTalentCell(record[key]);
  });

  return normalized;
}


function normalizeSkillRecordForHeroCard(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    id: normalizeStringValue(record.id),
    name: normalizeStringValue(record.name),
    image: normalizeStringValue(record.image),
    description: normalizeStringValue(record.description),
    url: normalizeStringValue(record.url),
    category: normalizeStringValue(record.category),
    skillType: normalizeStringValue(record.skillType),
    grade: normalizeStringValue(record.grade)
  };
}

function getHeroSkillsetData() {
  const heroes = readRecords('hero').map(normalizeHeroSkillsetRecord).filter(Boolean);
  const skills = readRecords('skill').map(normalizeSkillRecordForHeroCard).filter(Boolean);

  return {
    success: true,
    heroes,
    skills,
    updatedAt: new Date().toISOString()
  };
}

function getRecordById(dataType, id) {
  const normalizedId = (id || '').toString().trim();
  if (!normalizedId) {
    return { success: false, message: 'IDが指定されていません。' };
  }
  const records = readRecords(dataType);
  const record = records.find(function(entry) {
    return (entry.id || '').toString() === normalizedId;
  });
  if (!record) {
    return { success: false, message: '指定されたIDのデータが見つかりません。', id: normalizedId };
  }
  return { success: true, record, dataType };
}

function saveRecord(dataType, record) {
  if (!record || typeof record !== 'object') {
    return { success: false, message: '保存データが不正です。' };
  }
  const normalizedId = (record.id || '').toString().trim();
  if (!normalizedId) {
    return { success: false, message: 'IDは必須です。' };
  }

  const sheet = getSheetByType(dataType);
  const headers = getHeaders(dataType);
  ensureHeaders(sheet, headers);

  const headerRowIndex = DB_CONFIG.HEADER_ROW_INDEX || 1;
  const firstDataRow = headerRowIndex + 1;
  const lastRow = sheet.getLastRow();
  let targetRow = 0;
  let ids = [];

  if (lastRow >= firstDataRow) {
    const rows = lastRow - headerRowIndex;
    ids = sheet.getRange(firstDataRow, 1, rows, 1).getValues().map(function(row) {
      return (row[0] || '').toString();
    });
    const index = ids.findIndex(function(value) {
      return value === normalizedId;
    });
    if (index !== -1) {
      targetRow = firstDataRow + index;
    }
  }

  if (!targetRow) {
    if (lastRow < firstDataRow) {
      targetRow = firstDataRow;
    } else {
      var insertionIndex = ids.findIndex(function(value) {
        return compareIdValues(normalizedId, value) < 0;
      });

      if (insertionIndex === -1) {
        targetRow = lastRow + 1;
      } else {
        targetRow = firstDataRow + insertionIndex;
        sheet.insertRows(targetRow, 1);
      }
    }
  }

  const rowValues = headers.map(function(header) {
    return normalizeCellValue(record[header]);
  });
  sheet.getRange(targetRow, 1, 1, headers.length).setValues([rowValues]);

  return {
    success: true,
    id: normalizedId,
    dataType,
    message: 'データを保存しました。'
  };
}

function compareIdValues(a, b) {
  var aNumber = Number(a);
  var bNumber = Number(b);
  var aIsFinite = isFinite(aNumber);
  var bIsFinite = isFinite(bNumber);

  if (aIsFinite && bIsFinite) {
    return aNumber - bNumber;
  }

  var aString = (a || '').toString();
  var bString = (b || '').toString();
  return aString.localeCompare(bString, 'ja');
}

function deleteRecord(dataType, id) {
  const normalizedId = (id || '').toString().trim();
  if (!normalizedId) {
    return { success: false, message: 'IDが指定されていません。' };
  }

  const sheet = getSheetByType(dataType);
  const headers = getHeaders(dataType);
  ensureHeaders(sheet, headers);

  const headerRowIndex = DB_CONFIG.HEADER_ROW_INDEX || 1;
  const firstDataRow = headerRowIndex + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < firstDataRow) {
    return { success: false, message: '削除対象のデータが存在しません。' };
  }

  const rows = lastRow - headerRowIndex;
  const ids = sheet.getRange(firstDataRow, 1, rows, 1).getValues().map(function(row) {
    return (row[0] || '').toString();
  });
  const index = ids.findIndex(function(value) {
    return value === normalizedId;
  });

  if (index === -1) {
    return { success: false, message: '指定されたIDのデータが見つかりません。', id: normalizedId };
  }

  sheet.deleteRow(firstDataRow + index);
  return { success: true, id: normalizedId, dataType, message: 'データを削除しました。' };
}

function findAccount(identifiers) {
  const spreadsheet = getSpreadsheet(ACCOUNT_CONFIG.SHEET_ID);
  const sheet = spreadsheet ? spreadsheet.getSheetByName(ACCOUNT_CONFIG.SHEET_NAME) : null;
  if (!sheet) {
    return null;
  }

  const headerRowIndex = ACCOUNT_CONFIG.HEADER_ROW_INDEX || 1;
  const firstDataRow = headerRowIndex + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < firstDataRow) {
    return null;
  }

  const totalRows = lastRow - headerRowIndex;
  const range = sheet.getRange(firstDataRow, 1, totalRows, sheet.getLastColumn());
  const values = range.getValues();

  const normalizedPlayerId = normalizeId(identifiers.playerId);
  const normalizedEmail = normalizeId(identifiers.email);
  const columns = ACCOUNT_CONFIG.COLUMNS || {};
  const playerIndex = (columns.playerId || 1) - 1;
  const usernameIndex = (columns.username || 2) - 1;
  const emailIndex = (columns.email || 3) - 1;
  const kingdomIndex = typeof columns.kingdom === 'number' ? columns.kingdom - 1 : -1;
  const languageIndex = typeof columns.language === 'number' ? columns.language - 1 : -1;
  const authorityIndex = (columns.authority || 6) - 1;

  const matched = values.find(function(row) {
    const rowPlayerId = normalizeId(row[playerIndex]);
    const rowEmail = normalizeId(row[emailIndex]);
    return (normalizedPlayerId && rowPlayerId === normalizedPlayerId) || (normalizedEmail && rowEmail === normalizedEmail);
  });

  if (!matched) {
    return null;
  }

  return {
    playerId: matched[playerIndex],
    username: matched[usernameIndex],
    email: matched[emailIndex],
    kingdom: kingdomIndex >= 0 ? matched[kingdomIndex] : '',
    language: languageIndex >= 0 ? matched[languageIndex] : '',
    authority: matched[authorityIndex],
  };
}

function normalizeId(value) {
  return (value || '').toString().trim().toLowerCase();
}
