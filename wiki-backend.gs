/**
 * Notion風Wikiバックエンド
 * JSONP / フォームPOST両対応
 */
const CONFIG = {
  SHEET_ID: '1ZN1LQdk2TDNmtMOdx6mXBNe3jQjFfM6CXWYc2Z4vXDk',
  SHEET_NAME: 'Wiki_Pages',
  ALLOWED_ORIGINS: ['https://brahmoon.github.io']
};

function doGet(e) {
  try {
    const params = e?.parameter || {};
    const callback = params.callback || 'callback';
    const action = params.action;

    if (!action) {
      return createJsonpResponse({
        success: true,
        message: 'Wiki backend is running',
        timestamp: new Date().toISOString()
      }, callback);
    }

    let result;
    switch (action) {
      case 'getPages':
        result = getPages();
        break;
      case 'getPage':
        result = getPage(params.id);
        break;
      case 'savePage':
        result = savePage({
          id: params.id,
          title: params.title,
          content: params.content
        });
        break;
      default:
        result = { success: false, message: 'Unknown action: ' + action };
        break;
    }

    return createJsonpResponse(result, callback);
  } catch (error) {
    const callback = e?.parameter?.callback || 'callback';
    return createJsonpResponse({
      success: false,
      message: 'Internal server error: ' + error,
    }, callback);
  }
}

function doPost(e) {
  try {
    const params = e?.parameter || {};
    const action = params.action;

    let result;
    switch (action) {
      case 'savePage':
        result = savePage({
          id: params.id,
          title: params.title,
          content: params.content
        });
        break;
      case 'getPages':
        result = getPages();
        break;
      case 'getPage':
        result = getPage(params.id);
        break;
      default:
        result = { success: false, message: 'Unknown action: ' + action };
        break;
    }

    return createHtmlResponse(result);
  } catch (error) {
    return createHtmlResponse({
      success: false,
      message: 'Internal server error: ' + error
    });
  }
}

function createJsonpResponse(data, callback) {
  const jsonp = callback + '(' + JSON.stringify(data) + ');';
  return ContentService
    .createTextOutput(jsonp)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function createHtmlResponse(data) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <div id="response" style="display:none;">${JSON.stringify(data)}</div>
        <script>
          try {
            const responseData = ${JSON.stringify(data)};
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'FORM_RESPONSE',
                data: responseData
              }, '*');
            }
          } catch (error) {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'FORM_RESPONSE',
                data: { success: false, message: 'Response processing failed' }
              }, '*');
            }
          }
        </script>
      </body>
    </html>`;
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
