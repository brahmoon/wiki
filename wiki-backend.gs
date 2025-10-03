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
  const data = parseRequestData(e);
  if (!data.action) {
    return createJsonOutput({
      success: true,
      message: 'Wiki backend is running',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const result = routeAction(data);
    return createJsonOutput(result);
  } catch (error) {
    return createJsonOutput({
      success: false,
      message: 'Internal server error: ' + error,
    });
  }
}

function doPost(e) {
  try {
    const data = parseRequestData(e);
    const result = routeAction(data);
    return createJsonOutput(result);
  } catch (error) {
    return createJsonOutput({
      success: false,
      message: 'Internal server error: ' + error
    });
  }
}

function createJsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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
    default:
      return {
        success: false,
        message: 'Unknown action: ' + action,
      };
  }
}

function getPages() {
  try {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, pages: [] };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    const pages = data
      .filter(row => row[0])
      .map(row => ({
        id: row[0],
        title: row[1] || '無題',
        updatedAt: row[3] || ''
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
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'No pages found' };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
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
        updatedAt: row[3] || ''
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
    const lastRow = sheet.getLastRow();
    const updatedAt = new Date().toISOString();

    let targetRow = -1;
    if (lastRow >= 2) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      targetRow = ids.findIndex(value => value && value.toString() === page.id.toString());
      if (targetRow >= 0) {
        targetRow += 2;
      }
    }

    const rowData = [
      page.id,
      page.title || '無題',
      page.content || '',
      updatedAt
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, 4).setValues([rowData]);
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
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'Page not found' };
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
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

function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.getRange(1, 1, 1, 4).setValues([['ID', 'Title', 'Content', 'UpdatedAt']]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
