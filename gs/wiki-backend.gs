/**
 * Notion風Wikiバックエンド
 * text/plain POST（プリフライト回避）でのアクセスに対応
 *
 * このスクリプトは DriveImage 用 Apps Script とは別に独立した Web アプリとして
 * デプロイし、フロントエンド（tiptap-image2.html 等）から Web App URL を指定して
 * 呼び出してください。GitHub 上で直接実行することはありません。
 */
const CONFIG = {
  SHEET_ID: '1ZN1LQdk2TDNmtMOdx6mXBNe3jQjFfM6CXWYc2Z4vXDk',
  SHEET_NAME: 'Wiki_Pages',
  ALLOWED_ORIGINS: ['https://brahmoon.github.io'],
  TIMEZONE: 'Asia/Tokyo',
  MAX_DATE_SHEETS: 30,
};

const WIKI_COLUMNS = {
  ID: 1,
  TITLE: 2,
  DESCRIPTION: 3,
  CONTENT: 4,
  TAGS: 5,
  IS_PINNED: 6,
  PAGE_TYPE: 7,
  UPDATED_AT: 8,
  UPDATED_BY: 9,
  ORDER: 10,
  HEADERS: [
    'ID',
    'Title',
    'Description',
    'Content',
    'Tags',
    'IsPinned',
    'PageType',
    'UpdatedAt',
    'UpdatedBy',
    'Order',
  ],
};

const ACCOUNT_CONFIG = {
  SHEET_ID: '1mVVuS5bS50-YoVQyDIOM09Oi2YIpRIyIAfXDeBcw6N8',
  SHEET_NAME: 'Accounts',
  HEADER_ROW_INDEX: 1,
  PLAYER_ID_COLUMN: 1,
  AUTHORITY_COLUMN: 6,
  MIN_EDITOR_AUTHORITY: 2,
};

function doGet(e) {
  const origin = getRequestOrigin(e);
  const data = parseRequestData(e);
  if (!data.action) {
    return createJsonOutput({
      success: true,
      message: 'Wiki backend is running',
      timestamp: new Date().toISOString(),
    }, origin);
  }

  try {
    const result = routeAction(data);
    return createJsonOutput(result, origin);
  } catch (error) {
    return createJsonOutput({
      success: false,
      message: 'Internal server error: ' + error,
    }, origin);
  }
}

function doPost(e) {
  try {
    const data = parseRequestData(e);
    const result = routeAction(data);
    return createJsonOutput(result, getRequestOrigin(e));
  } catch (error) {
    return createJsonOutput({
      success: false,
      message: 'Internal server error: ' + error
    }, getRequestOrigin(e));
  }
}

function createJsonOutput(data, requestOrigin) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  const allowedOrigins = (CONFIG.ALLOWED_ORIGINS || []).map(function(origin) {
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

function getRequestOrigin(e) {
  if (!e || !e.headers) {
    return '';
  }
  return e.headers.origin || e.headers.Origin || '';
}

function parseRequestData(e) {
  const data = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function(key) {
      data[key] = e.parameter[key];
    });
  }

  if (e && e.postData && e.postData.contents) {
    try {
      const parsed = JSON.parse(e.postData.contents);
      Object.keys(parsed || {}).forEach(function(key) {
        data[key] = parsed[key];
      });
    } catch (error) {
      Logger.log('[WikiBackend] Failed to parse request body: %s', error);
      data.rawBody = e.postData.contents;
    }
  }

  return data;
}

function routeAction(data) {
  const action = (data.action || '').toString();

  switch (action) {
    case 'savePage':
      return executeWithEditorAuthority(data.playerId, () => savePage({
        id: data.id,
        title: data.title,
        description: data.description,
        content: data.content,
        tags: data.tags,
        isPinned: data.isPinned,
        pageType: data.pageType,
        updatedBy: data.updatedBy,
        order: data.order,
      }));
    case 'getPages':
      return getPages();
    case 'getPage':
      return getPage(data.id);
    case 'getPageHistory':
      return getPageHistory(data.id);
    case 'renamePageTree':
      return renamePageTree({
        originalId: data.originalId,
        newId: data.newId,
      });
    case 'reorderPages':
      return reorderPages({
        movedId: data.movedId,
        targetId: data.targetId,
        position: data.position,
      });
    default:
      return {
        success: false,
        message: 'Unknown action: ' + action,
      };
  }
}

function executeWithEditorAuthority(playerId, handler) {
  const verification = requireEditorAuthority(playerId);
  if (!verification.allowed) {
    return verification.response;
  }
  return handler(verification);
}

function requireEditorAuthority(playerId) {
  const normalizedPlayerId = normalizePlayerId(playerId);
  if (!normalizedPlayerId) {
    return {
      allowed: false,
      response: { success: false, message: 'Player IDが指定されていません。' },
    };
  }

  const sheet = getAccountsSheet();
  if (!sheet) {
    return {
      allowed: false,
      response: { success: false, message: 'Accountsシートが見つかりません。' },
    };
  }

  const record = findAccountAuthority(sheet, normalizedPlayerId);
  if (!record) {
    return {
      allowed: false,
      response: { success: false, message: '指定されたアカウントが見つかりません。' },
    };
  }

  const minimumAuthority = Number(ACCOUNT_CONFIG.MIN_EDITOR_AUTHORITY) || 2;
  const authorityValue = parseAuthorityValue(record.authority);
  if (authorityValue === null || authorityValue < minimumAuthority) {
    return {
      allowed: false,
      response: { success: false, message: '編集権限がありません。' },
    };
  }

  return {
    allowed: true,
    authority: authorityValue,
    playerId: record.playerId,
  };
}

function parseAuthorityValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function findAccountAuthority(sheet, normalizedPlayerId) {
  const headerRowIndex = Number(ACCOUNT_CONFIG.HEADER_ROW_INDEX) || 1;
  const lastRow = sheet.getLastRow();
  if (lastRow <= headerRowIndex) {
    return null;
  }

  const firstDataRow = headerRowIndex + 1;
  const playerColumn = Number(ACCOUNT_CONFIG.PLAYER_ID_COLUMN) || 1;
  const authorityColumn = Number(ACCOUNT_CONFIG.AUTHORITY_COLUMN) || 6;
  const width = Math.max(playerColumn, authorityColumn, 1);
  const totalRows = lastRow - headerRowIndex;
  const range = sheet.getRange(firstDataRow, 1, totalRows, width);
  const values = range.getValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowPlayerId = normalizePlayerId(row[playerColumn - 1]);
    if (rowPlayerId && rowPlayerId === normalizedPlayerId) {
      return {
        playerId: row[playerColumn - 1] || '',
        authority: row[authorityColumn - 1],
      };
    }
  }

  return null;
}

function normalizePlayerId(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getAccountsSpreadsheet() {
  if (ACCOUNT_CONFIG.SHEET_ID) {
    return SpreadsheetApp.openById(ACCOUNT_CONFIG.SHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getAccountsSheet() {
  var spreadsheet = getAccountsSpreadsheet();
  return spreadsheet ? spreadsheet.getSheetByName(ACCOUNT_CONFIG.SHEET_NAME) : null;
}

function getParentIdFromPageId(id) {
  if (!id) {
    return '';
  }
  const parts = id.toString().split('/');
  if (parts.length <= 1) {
    return '';
  }
  parts.pop();
  return parts.join('/');
}

function parseOrderValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ensureSheetStructure(sheet) {
  const headers = WIKI_COLUMNS.HEADERS;
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeader = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const headerMatches = headers.every((header, index) => currentHeader[index] === header);

  if (!headerMatches || lastColumn !== headers.length) {
    const headerIndexMap = new Map();
    currentHeader.forEach((value, index) => {
      const key = (value || '').toString().trim();
      if (key && !headerIndexMap.has(key)) {
        headerIndexMap.set(key, index);
      }
    });

    const dataRows = lastRow > 1
      ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
      : [];
    const normalizedRows = dataRows.map(row => headers.map(header => {
      const sourceIndex = headerIndexMap.get(header);
      return sourceIndex !== undefined ? row[sourceIndex] : '';
    }));

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (normalizedRows.length) {
      sheet.getRange(2, 1, normalizedRows.length, headers.length).setValues(normalizedRows);
    }
    if (lastColumn > headers.length) {
      sheet.getRange(1, headers.length + 1, lastRow, lastColumn - headers.length).clearContent();
    }
  }
  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
  }
}

function formatTodaySheetName() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE || 'Asia/Tokyo', 'yyyy-MM-dd');
}

function parseDateFromSheetName(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(name.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

function getDateSheetInfos(spreadsheet) {
  return spreadsheet.getSheets()
    .map(sheet => {
      const parsedDate = parseDateFromSheetName(sheet.getName());
      return parsedDate ? { sheet, date: parsedDate } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getLatestDateSheet(spreadsheet) {
  const infos = getDateSheetInfos(spreadsheet);
  return infos.length ? infos[infos.length - 1].sheet : null;
}

function copySheetWithFallback(sourceSheet, spreadsheet, targetName) {
  if (!sourceSheet || !spreadsheet || !targetName) {
    return null;
  }

  try {
    const copied = sourceSheet.copyTo(spreadsheet);
    copied.setName(targetName);
    return copied;
  } catch (error) {
    Logger.log('[WikiBackend] Failed to copy sheet with copyTo, fallback to manual copy: %s', error);
  }

  let targetSheet = spreadsheet.getSheetByName(targetName);
  if (!targetSheet) {
    targetSheet = spreadsheet.insertSheet(targetName);
  } else {
    targetSheet.clearContents();
    targetSheet.clearFormats();
  }

  const lastRow = Math.max(sourceSheet.getLastRow(), 1);
  const lastColumn = Math.max(sourceSheet.getLastColumn(), 1);
  const values = sourceSheet.getRange(1, 1, lastRow, lastColumn).getValues();
  targetSheet.getRange(1, 1, values.length, lastColumn).setValues(values);

  return targetSheet;
}

function getOrCreateBaseSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }
  ensureSheetStructure(sheet);
  return sheet;
}

function ensureTodaySheet(spreadsheet) {
  const todayName = formatTodaySheetName();
  const existing = spreadsheet.getSheetByName(todayName);
  if (existing) {
    ensureSheetStructure(existing);
    return existing;
  }

  const latestDateSheet = getLatestDateSheet(spreadsheet);
  const sourceSheet = latestDateSheet || getOrCreateBaseSheet(spreadsheet);
  const newSheet = copySheetWithFallback(sourceSheet, spreadsheet, todayName) || getOrCreateBaseSheet(spreadsheet);
  ensureSheetStructure(newSheet);
  return newSheet;
}

function getLatestDataSheet() {
  const ss = getSpreadsheet();
  const latestDateSheet = getLatestDateSheet(ss);
  if (latestDateSheet) {
    ensureSheetStructure(latestDateSheet);
    return latestDateSheet;
  }
  return getOrCreateBaseSheet(ss);
}

function rotateDateSheetsIfNeeded(spreadsheet) {
  const infos = getDateSheetInfos(spreadsheet);
  const limit = Number(CONFIG.MAX_DATE_SHEETS) || 30;
  if (infos.length <= limit) {
    return;
  }

  const excess = infos.length - limit;
  for (let i = 0; i < excess; i++) {
    try {
      infos[i].sheet && infos[i].sheet.getParent().deleteSheet(infos[i].sheet);
    } catch (error) {
      Logger.log('[WikiBackend] Failed to delete old date sheet: %s', error);
    }
  }
}

function getPages() {
  try {
    const sheet = getLatestDataSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, pages: [] };
    }

    const width = Math.max(sheet.getLastColumn(), WIKI_COLUMNS.HEADERS.length);
    const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const latestById = new Map();
    data.forEach(row => {
      const id = row[WIKI_COLUMNS.ID - 1];
      if (!id) {
        return;
      }
      const idString = id.toString();
      const current = latestById.get(idString);
      const updatedAt = row[WIKI_COLUMNS.UPDATED_AT - 1] || '';
      if (!current || updatedAt > current.updatedAt) {
        latestById.set(idString, {
          row,
          updatedAt,
        });
      }
    });

    const pages = Array.from(latestById.values()).map(({ row }) => ({
      id: row[WIKI_COLUMNS.ID - 1],
      title: row[WIKI_COLUMNS.TITLE - 1] || '無題',
      description: row[WIKI_COLUMNS.DESCRIPTION - 1] || '',
      content: row[WIKI_COLUMNS.CONTENT - 1] || '',
      tags: row[WIKI_COLUMNS.TAGS - 1] || '',
      isPinned: row[WIKI_COLUMNS.IS_PINNED - 1] || '',
      pageType: row[WIKI_COLUMNS.PAGE_TYPE - 1] || '',
      updatedAt: row[WIKI_COLUMNS.UPDATED_AT - 1] || '',
      updatedBy: row[WIKI_COLUMNS.UPDATED_BY - 1] || '',
      order: parseOrderValue(row[WIKI_COLUMNS.ORDER - 1])
    }));

    return { success: true, pages };
  } catch (error) {
    return { success: false, message: 'Failed to get pages: ' + error };
  }
}

function getPage(id) {
  try {
    if (!id) {
      return { success: false, message: 'Page ID is required' };
    }

    const sheet = getLatestDataSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No pages found' };
    }

    const width = Math.max(sheet.getLastColumn(), WIKI_COLUMNS.HEADERS.length);
    const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const matches = data.filter(r => r[WIKI_COLUMNS.ID - 1] && r[WIKI_COLUMNS.ID - 1].toString() === id.toString());
    if (!matches.length) {
      return { success: false, message: 'Page not found' };
    }

    const row = matches.reduce((latest, current) => {
      const currentUpdated = current[WIKI_COLUMNS.UPDATED_AT - 1] || '';
      if (!latest) {
        return current;
      }
      return currentUpdated > (latest[WIKI_COLUMNS.UPDATED_AT - 1] || '') ? current : latest;
    }, null);

    return {
      success: true,
      page: {
        id: row[WIKI_COLUMNS.ID - 1],
        title: row[WIKI_COLUMNS.TITLE - 1] || '無題',
        description: row[WIKI_COLUMNS.DESCRIPTION - 1] || '',
        content: row[WIKI_COLUMNS.CONTENT - 1] || '',
        tags: row[WIKI_COLUMNS.TAGS - 1] || '',
        isPinned: row[WIKI_COLUMNS.IS_PINNED - 1] || '',
        pageType: row[WIKI_COLUMNS.PAGE_TYPE - 1] || '',
        updatedAt: row[WIKI_COLUMNS.UPDATED_AT - 1] || '',
        updatedBy: row[WIKI_COLUMNS.UPDATED_BY - 1] || '',
        order: parseOrderValue(row[WIKI_COLUMNS.ORDER - 1])
      }
    };
  } catch (error) {
    return { success: false, message: 'Failed to get page: ' + error };
  }
}

function savePage(page) {
  try {
    if (!page || !page.id) {
      return { success: false, message: 'Page ID is required' };
    }

    const ss = getSpreadsheet();
    const sheet = ensureTodaySheet(ss);
    const lastRow = sheet.getLastRow();
    const updatedAt = new Date().toISOString();

    const width = Math.max(sheet.getLastColumn(), WIKI_COLUMNS.HEADERS.length);
    const data = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];

    let lastMatchedRow = -1;
    let existingOrder = null;
    let existingMeta = null;
    data.forEach((row, index) => {
      if (row[WIKI_COLUMNS.ID - 1] && row[WIKI_COLUMNS.ID - 1].toString() === page.id.toString()) {
        lastMatchedRow = index + 2;
        if (existingOrder === null) {
          existingOrder = parseOrderValue(row[WIKI_COLUMNS.ORDER - 1]);
        }
        if (!existingMeta) {
          existingMeta = {
            description: row[WIKI_COLUMNS.DESCRIPTION - 1],
            tags: row[WIKI_COLUMNS.TAGS - 1],
            isPinned: row[WIKI_COLUMNS.IS_PINNED - 1],
            pageType: row[WIKI_COLUMNS.PAGE_TYPE - 1],
          };
        }
      }
    });

    let orderValue = parseOrderValue(page.order);
    if (lastMatchedRow > 0 && orderValue === null) {
      orderValue = existingOrder;
    }

    if (orderValue === null) {
      const parentId = getParentIdFromPageId(page.id);
      let maxOrder = 0;
      data.forEach(row => {
        const rowId = row[WIKI_COLUMNS.ID - 1];
        if (!rowId) {
          return;
        }
        const rowParent = getParentIdFromPageId(rowId.toString());
        if (rowParent === parentId) {
          const parsed = parseOrderValue(row[WIKI_COLUMNS.ORDER - 1]);
          if (parsed !== null && parsed > maxOrder) {
            maxOrder = parsed;
          }
        }
      });
      orderValue = maxOrder + 1;
    }

    if (!Number.isFinite(orderValue)) {
      orderValue = data.length + 1;
    }

    orderValue = Math.max(1, Math.round(orderValue));

    const description = Object.prototype.hasOwnProperty.call(page, 'description')
      ? page.description
      : (existingMeta ? existingMeta.description : '');
    const tags = Object.prototype.hasOwnProperty.call(page, 'tags')
      ? page.tags
      : (existingMeta ? existingMeta.tags : '');
    const isPinned = Object.prototype.hasOwnProperty.call(page, 'isPinned')
      ? page.isPinned
      : (existingMeta ? existingMeta.isPinned : '');
    const pageType = Object.prototype.hasOwnProperty.call(page, 'pageType')
      ? page.pageType
      : (existingMeta ? existingMeta.pageType : '');

    const rowData = [
      page.id,
      page.title || '無題',
      description || '',
      page.content || '',
      tags || '',
      isPinned || '',
      pageType || '',
      updatedAt,
      page.updatedBy || '',
      orderValue
    ];

    if (lastMatchedRow > 0) {
      sheet.insertRows(lastMatchedRow + 1, 1);
      sheet.getRange(lastMatchedRow + 1, 1, 1, WIKI_COLUMNS.HEADERS.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    rotateDateSheetsIfNeeded(ss);

    return { success: true, message: 'Page saved', updatedAt };
  } catch (error) {
    return { success: false, message: 'Failed to save page: ' + error };
  }
}

function getPageHistory(id) {
  try {
    if (!id) {
      return { success: false, message: 'Page ID is required' };
    }

    const sheet = getLatestDataSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, versions: [] };
    }

    const width = Math.max(sheet.getLastColumn(), WIKI_COLUMNS.HEADERS.length);
    const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const matches = data.filter(row => row[WIKI_COLUMNS.ID - 1] && row[WIKI_COLUMNS.ID - 1].toString() === id.toString());

    if (!matches.length) {
      return { success: true, versions: [] };
    }

    matches.sort((a, b) => {
      const aDate = a[WIKI_COLUMNS.UPDATED_AT - 1] || '';
      const bDate = b[WIKI_COLUMNS.UPDATED_AT - 1] || '';
      return bDate > aDate ? 1 : bDate < aDate ? -1 : 0;
    });

    const versions = matches.map((row, index) => ({
      versionIndex: index + 1,
      updatedAt: row[WIKI_COLUMNS.UPDATED_AT - 1] || '',
      htmlContent: row[WIKI_COLUMNS.CONTENT - 1] || '',
      rowData: row.slice(0, width),
    }));

    return { success: true, versions };
  } catch (error) {
    return { success: false, message: 'Failed to get page history: ' + error };
  }
}

function renamePageTree(params) {
  try {
    const originalId = params && params.originalId ? params.originalId.toString() : '';
    const newId = params && params.newId ? params.newId.toString() : '';

    if (!originalId || !newId) {
      return { success: false, message: 'Both originalId and newId are required' };
    }

    if (originalId === newId) {
      return { success: true, message: 'No changes required' };
    }

    const sheet = ensureTodaySheet(getSpreadsheet());
    ensureSheetStructure(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'Page not found' };
    }

    const width = Math.max(sheet.getLastColumn(), WIKI_COLUMNS.HEADERS.length);
    const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const updates = [];
    const prefix = originalId + '/';

    data.forEach((row, index) => {
      const id = row[WIKI_COLUMNS.ID - 1];
      if (!id) {
        return;
      }
      const idString = id.toString();
      if (idString === originalId || idString.indexOf(prefix) === 0) {
        const suffix = idString === originalId ? '' : idString.substring(originalId.length);
        const targetId = `${newId}${suffix}`;
        updates.push({ rowIndex: index, targetId });
      }
    });

    if (!updates.length) {
      return { success: false, message: 'Page not found' };
    }

    const updatedRows = new Set(updates.map(item => item.rowIndex));
    const existingIds = new Set();
    data.forEach((row, index) => {
      const id = row[WIKI_COLUMNS.ID - 1];
      if (!id) {
        return;
      }
      if (!updatedRows.has(index)) {
        existingIds.add(id.toString());
      }
    });

    const newIdsSet = new Set();
    for (let i = 0; i < updates.length; i++) {
      const targetId = updates[i].targetId;
      if (!targetId) {
        return { success: false, message: 'Invalid target Page ID' };
      }
      const targetIdStr = targetId.toString();
      if (existingIds.has(targetIdStr)) {
        return { success: false, message: 'Target Page ID already exists: ' + targetIdStr };
      }
      if (newIdsSet.has(targetIdStr)) {
        return { success: false, message: 'Duplicate target Page ID detected: ' + targetIdStr };
      }
      newIdsSet.add(targetIdStr);
    }

    updates.forEach(update => {
      sheet.getRange(update.rowIndex + 2, 1).setValue(update.targetId);
    });

    return { success: true, message: 'Page tree renamed' };
  } catch (error) {
    return { success: false, message: 'Failed to rename page tree: ' + error };
  }
}

function reorderPages(params) {
  try {
    const movedId = params && params.movedId ? params.movedId.toString() : '';
    const rawPosition = params && params.position ? params.position.toString() : 'end';
    const position = rawPosition ? rawPosition.toLowerCase() : 'end';
    const targetId = params && params.targetId ? params.targetId.toString() : '';

    if (!movedId) {
      return { success: false, message: 'movedId is required' };
    }

    const sheet = ensureTodaySheet(getSpreadsheet());
    ensureSheetStructure(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No pages found' };
    }

    const width = Math.max(sheet.getLastColumn(), WIKI_COLUMNS.HEADERS.length);
    const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();

    const entries = data.map((row, index) => {
      const id = row[WIKI_COLUMNS.ID - 1] ? row[WIKI_COLUMNS.ID - 1].toString() : '';
      return {
        id,
        parent: getParentIdFromPageId(id),
        order: parseOrderValue(row[WIKI_COLUMNS.ORDER - 1]),
        index,
      };
    });

    const movedEntry = entries.find(entry => entry.id === movedId);
    if (!movedEntry) {
      return { success: false, message: 'Moved page not found' };
    }

    let targetEntry = null;
    if (position === 'before' || position === 'after') {
      if (!targetId) {
        return { success: false, message: 'targetId is required for before/after positions' };
      }
      targetEntry = entries.find(entry => entry.id === targetId);
      if (!targetEntry) {
        return { success: false, message: 'Target page not found' };
      }
      if (targetEntry.parent !== movedEntry.parent) {
        return { success: false, message: 'Target and moved page must share the same parent' };
      }
    }

    const parentKey = position === 'end' ? movedEntry.parent : (targetEntry ? targetEntry.parent : movedEntry.parent);
    const siblings = entries
      .filter(entry => entry.parent === parentKey && entry.id)
      .sort((a, b) => {
        const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.index - b.index;
      });

    const remaining = siblings.filter(entry => entry.id !== movedEntry.id);
    let reordered;
    if (position === 'before') {
      const targetIndex = remaining.findIndex(entry => entry.id === targetEntry.id);
      if (targetIndex < 0) {
        return { success: false, message: 'Target sibling not found' };
      }
      reordered = [
        ...remaining.slice(0, targetIndex),
        movedEntry,
        ...remaining.slice(targetIndex),
      ];
    } else if (position === 'after') {
      const targetIndex = remaining.findIndex(entry => entry.id === targetEntry.id);
      if (targetIndex < 0) {
        return { success: false, message: 'Target sibling not found' };
      }
      reordered = [
        ...remaining.slice(0, targetIndex + 1),
        movedEntry,
        ...remaining.slice(targetIndex + 1),
      ];
    } else {
      reordered = [...remaining, movedEntry];
    }

    const updates = [];
    reordered.forEach((entry, index) => {
      const desiredOrder = index + 1;
      if (!Number.isFinite(entry.order) || entry.order !== desiredOrder) {
        updates.push({ rowIndex: entry.index + 2, order: desiredOrder });
      }
    });

    if (!updates.length) {
      return { success: true, message: 'No changes required' };
    }

    updates.forEach(update => {
      sheet.getRange(update.rowIndex, WIKI_COLUMNS.ORDER).setValue(update.order);
    });

    return { success: true, message: 'Order updated' };
  } catch (error) {
    return { success: false, message: 'Failed to reorder pages: ' + error };
  }
}
