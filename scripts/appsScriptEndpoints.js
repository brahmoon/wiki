(function defineAppsScriptEndpoints(globalObject) {
  if (!globalObject) {
    return;
  }

  const endpoints = Object.freeze({
    WIKI: 'https://script.google.com/macros/s/AKfycbwuuod_05wykqM-8ohXLxZS4H25i9oHpay5NiAsOz5emLiuyNEM_RZxf3mAWZFcE8yy/exec', // gs/wiki-backend.gs
    DRIVE_IMAGE: 'https://script.google.com/macros/s/AKfycbzKDtguBg1e5Iz73KUsl6U4x1hK1cFYzo2jM5RtgJiU76yx9JsfUtPHeJjBJ8ZVWIY9/exec', // extensions/driveImage/DriveImageAppsScript.gs
    LOGIN: 'https://script.google.com/macros/s/AKfycbwFHYiWEqX0L04yW1coeoLIryGXu5oM1jdKirEmd9QC0-nyEC4s7Gc8OA1br474QPF7/exec', // gs/login.gs
    ADMIN_AUTH: 'https://script.google.com/macros/s/AKfycbwSLM8ZGbLNgYlO-ZmVPEc9-DURSz4F2eGOaakJ0ApWAlQemn2qCa05FA3NS84Kz5dprw/exec', // gs/authorize.gs
    USER_SETTINGS: 'https://script.google.com/macros/s/AKfycbw1-GNQ9ey9bbwUlBwQLF8pz7dX2n9Y9f5hxwA29xI8Yf_9oDnzMGNEgIUY9bpMEMgF0w/exec', // gs/user-setting.gs
    TOOLBAR_PLUGIN: 'https://script.google.com/macros/s/AKfycbxEKtDO85fhESn4fyk9aQqCqPC2rBvFqvSG0Kdz8nLUfq_b68WyLmpenuv2R_kG6BL5SA/exec', // gs/authorize.gs (toolbar plugin API)
    DATABASE: 'https://script.google.com/macros/s/AKfycby6L1ug6fc1ZjL3oSE8i7QAblu6l9W3uabyO82zIzMzUoIcfrXLpbZ8tTBPB3xn6ptZ7g/exec', // gs/database.gs
  });

  globalObject.APPS_SCRIPT_ENDPOINTS = endpoints;

  Object.entries(endpoints).forEach(([key, value]) => {
    const propertyName = `APPS_SCRIPT_ENDPOINT_${key}`;
    globalObject[propertyName] = value;
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : undefined);
