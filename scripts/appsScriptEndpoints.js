(function defineAppsScriptEndpoints(globalObject) {
  if (!globalObject) {
    return;
  }

  const endpoints = Object.freeze({
    WIKI: 'https://script.google.com/macros/s/AKfycbxQM_XIzitekfziLRGw3rGSWXcPgBl4zduVNKL3n77jv4jUyLgJMIR_mC7Uzw4xu4KsEg/exec', // gs/wiki-backend.gs
    DRIVE_IMAGE: 'https://script.google.com/macros/s/AKfycbyiAxaPIz2_E0fAwXFTINUW1SMwQH19Yh3k_3gFEMOiFuCWxOoHaquj1qxLJC3xd1Ow/exec', // extensions/driveImage/DriveImageAppsScript.gs
    LOGIN: 'https://script.google.com/macros/s/AKfycbwHhnYgB02en5yytMZEp37uj6R6sG9avJaI-NiBPtlNOm1hf5KkICOeMqPMrIIIne8k/exec', // gs/login.gs
    ADMIN_AUTH: 'https://script.google.com/macros/s/AKfycbxEKtDO85fhESn4fyk9aQqCqPC2rBvFqvSG0Kdz8nLUfq_b68WyLmpenuv2R_kG6BL5SA/exec', // gs/authorize.gs
    USER_SETTINGS: 'https://script.google.com/macros/s/AKfycbxaDKJFHq8d5JWejiklNvxRTCUCmCbvEds-GdPUcG0Ogl2xjruHoZ8mj9v7GQUq87OCVg/exec', // gs/user-setting.gs
    TOOLBAR_PLUGIN: 'https://script.google.com/macros/s/AKfycbxEKtDO85fhESn4fyk9aQqCqPC2rBvFqvSG0Kdz8nLUfq_b68WyLmpenuv2R_kG6BL5SA/exec', // gs/authorize.gs (toolbar plugin API)
    DATABASE: 'https://script.google.com/macros/s/AKfycbx41yPJxQdH9kP136rmTk9yYn3Ua0CNMKS06Lr85th8WbR_wgCqi6vR4EFI1Qf5BlzAmQ/exec', // gs/database.gs
  });

  globalObject.APPS_SCRIPT_ENDPOINTS = endpoints;

  Object.entries(endpoints).forEach(([key, value]) => {
    const propertyName = `APPS_SCRIPT_ENDPOINT_${key}`;
    globalObject[propertyName] = value;
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : undefined);
