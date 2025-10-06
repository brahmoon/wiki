/**
 * Template management backend for TipTap UI template builder.
 *
 * This Apps Script Web App stores template definitions inside a Google Sheet.
 * The implementation mirrors wiki-backend.gs but focuses on template data.
 */
const TEMPLATE_CONFIG = {
  SHEET_ID: '1ZN1LQdk2TDNmtMOdx6mXBNe3jQjFfM6CXWYc2Z4vXDk',
  SHEET_NAME: 'Wiki_Templates',
  ALLOWED_ORIGINS: ['https://brahmoon.github.io'],
};

function doGet(e) {
  const origin = getTemplateRequestOrigin(e);
  const data = parseTemplateRequestData(e);

  if (!data.action) {
    return createTemplateJsonOutput({
      success: true,
      message: 'Template backend is running',
      timestamp: new Date().toISOString(),
    }, origin);
  }

  try {
    const result = routeTemplateAction(data);
    return createTemplateJsonOutput(result, origin);
  } catch (error) {
    return createTemplateJsonOutput({
      success: false,
      message: 'Internal server error: ' + error,
    }, origin);
  }
}

function doPost(e) {
  const origin = getTemplateRequestOrigin(e);
  try {
    const data = parseTemplateRequestData(e);
    const result = routeTemplateAction(data);
    return createTemplateJsonOutput(result, origin);
  } catch (error) {
    return createTemplateJsonOutput({
      success: false,
      message: 'Internal server error: ' + error,
    }, origin);
  }
}

function createTemplateJsonOutput(data, requestOrigin) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  const allowedOrigins = (TEMPLATE_CONFIG.ALLOWED_ORIGINS || []).map(function(origin) {
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

function getTemplateRequestOrigin(e) {
  if (!e || !e.headers) {
    return '';
  }
  return e.headers.origin || e.headers.Origin || '';
}

function parseTemplateRequestData(e) {
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
      Logger.log('[TemplateBackend] Failed to parse request body: %s', error);
      data.rawBody = e.postData.contents;
    }
  }

  return data;
}

function routeTemplateAction(data) {
  const action = (data.action || '').toString();

  switch (action) {
    case 'saveTemplate':
      return saveTemplate({
        id: data.id,
        name: data.name,
        category: data.category,
        json: data.json,
        thumbnail: data.thumbnail,
        author: data.author,
        version: data.version,
      });
    case 'getTemplates':
      return getTemplates();
    case 'getTemplate':
      return getTemplateById(data.id);
    case 'deleteTemplate':
      return deleteTemplateById(data.id);
    default:
      return {
        success: false,
        message: 'Unknown action: ' + action,
      };
  }
}

function getTemplateSheet() {
  const spreadsheet = SpreadsheetApp.openById(TEMPLATE_CONFIG.SHEET_ID);
  const sheetName = TEMPLATE_CONFIG.SHEET_NAME || 'Wiki_Templates';
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  ensureTemplateSheetStructure(sheet);
  return sheet;
}

function ensureTemplateSheetStructure(sheet) {
  const headers = ['ID', 'Name', 'Category', 'Json', 'Thumbnail', 'Author', 'UpdatedAt', 'Version'];
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const current = headerRange.getValues()[0];
  let needsUpdate = false;
  for (var i = 0; i < headers.length; i++) {
    if (current[i] !== headers[i]) {
      needsUpdate = true;
      break;
    }
  }
  if (needsUpdate) {
    headerRange.setValues([headers]);
  }
  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
  }
}

function getTemplates() {
  try {
    const sheet = getTemplateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, templates: [] };
    }
    const width = Math.max(sheet.getLastColumn(), 8);
    const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    const templates = values.filter(function(row) {
      return row[0];
    }).map(function(row) {
      return {
        id: row[0],
        name: row[1] || '無題テンプレート',
        category: row[2] || '',
        thumbnail: row[4] || '',
        author: row[5] || '',
        updatedAt: row[6] || '',
        version: row[7] || '',
      };
    });
    return { success: true, templates: templates };
  } catch (error) {
    return { success: false, message: 'Failed to get templates: ' + error };
  }
}

function getTemplateById(id) {
  if (!id) {
    return { success: false, message: 'Template ID is required' };
  }

  try {
    const sheet = getTemplateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'Template not found' };
    }
    const range = sheet.getRange(2, 1, lastRow - 1, 8);
    const values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (row[0] === id) {
        return {
          success: true,
          template: {
            id: row[0],
            name: row[1] || '無題テンプレート',
            category: row[2] || '',
            json: row[3] || '',
            thumbnail: row[4] || '',
            author: row[5] || '',
            updatedAt: row[6] || '',
            version: row[7] || '',
          },
        };
      }
    }
    return { success: false, message: 'Template not found: ' + id };
  } catch (error) {
    return { success: false, message: 'Failed to get template: ' + error };
  }
}

function saveTemplate(template) {
  if (!template || !template.id) {
    return { success: false, message: 'Invalid template payload' };
  }
  const now = new Date().toISOString();
  const sheet = getTemplateSheet();
  const lastRow = sheet.getLastRow();
  const width = Math.max(sheet.getLastColumn(), 8);
  if (lastRow >= 2) {
    const range = sheet.getRange(2, 1, lastRow - 1, width);
    const values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === template.id) {
        range.getCell(i + 1, 1).offset(0, 0, 1, width).setValues([[
          template.id,
          template.name || '無題テンプレート',
          template.category || '',
          template.json || '',
          template.thumbnail || '',
          template.author || '',
          now,
          template.version || '',
        ]]);
        return { success: true, updatedAt: now, id: template.id };
      }
    }
  }
  sheet.appendRow([
    template.id,
    template.name || '無題テンプレート',
    template.category || '',
    template.json || '',
    template.thumbnail || '',
    template.author || '',
    now,
    template.version || '',
  ]);
  return { success: true, createdAt: now, id: template.id };
}

function deleteTemplateById(id) {
  if (!id) {
    return { success: false, message: 'Template ID is required' };
  }

  try {
    const sheet = getTemplateSheet();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: 'Template not found' };
    }
    const range = sheet.getRange(2, 1, lastRow - 1, 1);
    const values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === id) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    return { success: false, message: 'Template not found: ' + id };
  } catch (error) {
    return { success: false, message: 'Failed to delete template: ' + error };
  }
}
