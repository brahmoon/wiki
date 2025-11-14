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
  ALLOWED_ORIGINS: ['https://brahmoon.github.io']
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
      return savePage({
        id: data.id,
        title: data.title,
        content: data.content,
        updatedBy: data.updatedBy,
        order: data.order,
      });
    case 'getPages':
      return getPages();
    case 'getPage':
      return getPage(data.id);
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
  const headers = ['ID', 'Title', 'Content', 'UpdatedAt', 'UpdatedBy', 'Order'];
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  let needsUpdate = false;
  for (let i = 0; i < headers.length; i++) {
    if (current[i] !== headers[i]) {
      needsUpdate = true;
      break;
    }
  }
  if (needsUpdate) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
  }
}

function getPages() {
  try {
    const sheet = getOrCreateSheet();
    ensureSheetStructure(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, pages: [] };
    }

    const width = Math.max(sheet.getLastColumn(), 6);
    const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const pages = data
      .filter(row => row[0])
      .map(row => ({
        id: row[0],
        title: row[1] || '無題',
        updatedAt: row[3] || '',
        updatedBy: row[4] || '',
        order: parseOrderValue(row[5])
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

    const sheet = getOrCreateSheet();
    ensureSheetStructure(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No pages found' };
    }

    const width = Math.max(sheet.getLastColumn(), 6);
    const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const row = data.find(r => r[0] && r[0].toString() === id.toString());
    if (!row) {
      return { success: false, message: 'Page not found' };
    }

    return {
      success: true,
      page: {
        id: row[0],
        title: row[1] || '無題',
        content: row[2] || '',
        updatedAt: row[3] || '',
        updatedBy: row[4] || '',
        order: parseOrderValue(row[5])
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

    const sheet = getOrCreateSheet();
    ensureSheetStructure(sheet);
    const lastRow = sheet.getLastRow();
    const updatedAt = new Date().toISOString();

    const width = Math.max(sheet.getLastColumn(), 6);
    const data = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];

    let targetRow = -1;
    let existingOrder = null;
    if (data.length) {
      targetRow = data.findIndex(row => row[0] && row[0].toString() === page.id.toString());
      if (targetRow >= 0) {
        existingOrder = parseOrderValue(data[targetRow][5]);
        targetRow += 2;
      }
    }

    let orderValue = parseOrderValue(page.order);
    if (targetRow > 0 && orderValue === null) {
      orderValue = existingOrder;
    }

    if (orderValue === null) {
      const parentId = getParentIdFromPageId(page.id);
      let maxOrder = 0;
      data.forEach(row => {
        const rowId = row[0];
        if (!rowId) {
          return;
        }
        const rowParent = getParentIdFromPageId(rowId.toString());
        if (rowParent === parentId) {
          const parsed = parseOrderValue(row[5]);
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

    const rowData = [
      page.id,
      page.title || '無題',
      page.content || '',
      updatedAt,
      page.updatedBy || '',
      orderValue
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, 6).setValues([rowData]);
      return { success: true, message: 'Page updated', updatedAt };
    }

    sheet.appendRow(rowData);
    return { success: true, message: 'Page created', updatedAt };
  } catch (error) {
    return { success: false, message: 'Failed to save page: ' + error };
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

    const sheet = getOrCreateSheet();
    ensureSheetStructure(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'Page not found' };
    }

    const width = Math.max(sheet.getLastColumn(), 6);
    const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const updates = [];
    const prefix = originalId + '/';

    data.forEach((row, index) => {
      const id = row[0];
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
      const id = row[0];
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

    const sheet = getOrCreateSheet();
    ensureSheetStructure(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No pages found' };
    }

    const width = Math.max(sheet.getLastColumn(), 6);
    const data = sheet.getRange(2, 1, lastRow - 1, width).getValues();

    const entries = data.map((row, index) => {
      const id = row[0] ? row[0].toString() : '';
      return {
        id,
        parent: getParentIdFromPageId(id),
        order: parseOrderValue(row[5]),
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
      sheet.getRange(update.rowIndex, 6).setValue(update.order);
    });

    return { success: true, message: 'Order updated' };
  } catch (error) {
    return { success: false, message: 'Failed to reorder pages: ' + error };
  }
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  ensureSheetStructure(sheet);
  return sheet;
}
