(function defineAppsScriptEndpoints(globalObject) {
  if (!globalObject) {
    return;
  }

  const endpoints = Object.freeze({
    WIKI: 'https://script.google.com/macros/s/AKfycbxB7AqZnmtGW0aa-KQEHMTJEkA8cIvgpk7C1o0d2cnSL8SNDWx0Sqok_622t2tBttRltQ/exec', // gs/wiki-backend.gs
    DRIVE_IMAGE: 'https://script.google.com/macros/s/AKfycbyiAxaPIz2_E0fAwXFTINUW1SMwQH19Yh3k_3gFEMOiFuCWxOoHaquj1qxLJC3xd1Ow/exec', // extensions/driveImage/DriveImageAppsScript.gs
    LOGIN: 'https://script.google.com/macros/s/AKfycbwHhnYgB02en5yytMZEp37uj6R6sG9avJaI-NiBPtlNOm1hf5KkICOeMqPMrIIIne8k/exec', // gs/login.gs
    ADMIN_AUTH: 'https://script.google.com/macros/s/AKfycbwMdxSp7hBE9cvvoz3BwLgD3J6d6ScSu3JqdEAdD60N8V3_IUMg_TDv5wYlg1ZBR0dw1w/exec', // gs/authorize.gs
    USER_SETTINGS: 'https://script.google.com/macros/s/AKfycbxcXErh3Q-F8ARTpznVQ7hgyLu5-IxWefS_63K_K8AwKmDGcqLa3Fiip44OeF1cMWKGRw/exec', // gs/user-setting.gs
    TOOLBAR_PLUGIN: 'https://script.google.com/macros/s/AKfycbwMdxSp7hBE9cvvoz3BwLgD3J6d6ScSu3JqdEAdD60N8V3_IUMg_TDv5wYlg1ZBR0dw1w/exec', // gs/authorize.gs (toolbar plugin API)
    DATABASE: 'https://script.google.com/macros/s/AKfycbxfVeicDb86KDK6-iYRqx8nt1yL3UawDPnKLh_juRewXkNnVwkMlfUYQK9izZ3fyBMicQ/exec', // gs/database.gs
  });

  globalObject.APPS_SCRIPT_ENDPOINTS = endpoints;

  Object.entries(endpoints).forEach(([key, value]) => {
    const propertyName = `APPS_SCRIPT_ENDPOINT_${key}`;
    globalObject[propertyName] = value;
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : undefined);
