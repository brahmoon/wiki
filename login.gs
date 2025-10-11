const CONFIG = {
  SHEET_NAME: 'Accounts',
  HEADER_ROW_INDEX: 1,
  LOGIN_ID_COLUMN: 1,
  USERNAME_COLUMN: 2,
  EMAIL_COLUMN: 3
};

function doPost(e) {
  try {
    const requestData = parseRequest(e);
    if (!requestData.loginId) {
      return buildResponse({
        success: false,
        message: 'ログインIDが指定されていません。'
      });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      return buildResponse({
        success: false,
        message: `シート「${CONFIG.SHEET_NAME}」が見つかりません。`
      });
    }

    const normalizedLoginId = normalizeId(requestData.loginId);
    const record = findAccount(sheet, normalizedLoginId);

    if (!record) {
      return buildResponse({
        success: false,
        message: '指定されたログインIDは登録されていません。'
      });
    }

    return buildResponse({
      success: true,
      message: '認証に成功しました。',
      loginId: record.loginId,
      username: record.username,
      email: record.email
    });
  } catch (error) {
    return buildResponse({
      success: false,
      message: `処理中にエラーが発生しました: ${error.message}`
    });
  }
}

function parseRequest(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }
  try {
    const data = JSON.parse(e.postData.contents);
    return {
      loginId: data.loginId,
      name: data.name
    };
  } catch (error) {
    throw new Error('リクエストの解析に失敗しました。');
  }
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function findAccount(sheet, loginId) {
  const lastRow = sheet.getLastRow();
  const firstDataRow = CONFIG.HEADER_ROW_INDEX + 1;
  if (lastRow < firstDataRow) {
    return null;
  }

  const totalRows = lastRow - CONFIG.HEADER_ROW_INDEX;
  const range = sheet.getRange(firstDataRow, 1, totalRows, sheet.getLastColumn());
  const values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowLoginId = normalizeId(row[CONFIG.LOGIN_ID_COLUMN - 1]);
    if (!rowLoginId) {
      continue;
    }
    if (rowLoginId === loginId) {
      return {
        loginId: row[CONFIG.LOGIN_ID_COLUMN - 1],
        username: row[CONFIG.USERNAME_COLUMN - 1] || '',
        email: row[CONFIG.EMAIL_COLUMN - 1] || ''
      };
    }
  }

  return null;
}

function buildResponse(result) {
  const output = {
    success: Boolean(result.success),
    message: result.message || '',
    loginId: result.loginId || null,
    username: result.username || null,
    email: result.email || null
  };

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
