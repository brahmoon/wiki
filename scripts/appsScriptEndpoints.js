(function defineAppsScriptEndpoints(globalObject) {
  if (!globalObject) {
    return;
  }

  const endpoints = Object.freeze({
    WIKI: 'https://script.google.com/macros/s/AKfycbwVzZX57xLz-p-DW15XUASzSeiZcoXugSCZzFSae_Y7vAxljtF2TTmU2DowulsZI65LHg/exec',
    DRIVE_IMAGE: 'https://script.google.com/macros/s/AKfycbxaS2LMlxk5rx-XK6XTkFG2S58NKTkOnBL3smjF_mbyP_QA0PDJJ2hBE0_-PEX7nSO4/exec',
    LOGIN: 'https://script.google.com/macros/s/AKfycbwHhnYgB02en5yytMZEp37uj6R6sG9avJaI-NiBPtlNOm1hf5KkICOeMqPMrIIIne8k/exec',
    ADMIN_AUTH: 'https://script.google.com/macros/s/AKfycbxY_eqIlG2elhiNqtnBi__jUywu7LuanURjT0HA4uI2cOdnLbD9cCEiDGaqFEdz0-BHEA/exec',
    USER_SETTINGS: 'https://script.google.com/macros/s/AKfycbxcXErh3Q-F8ARTpznVQ7hgyLu5-IxWefS_63K_K8AwKmDGcqLa3Fiip44OeF1cMWKGRw/exec',
    TOOLBAR_PLUGIN: 'https://script.google.com/macros/s/AKfycbxY_eqIlG2elhiNqtnBi__jUywu7LuanURjT0HA4uI2cOdnLbD9cCEiDGaqFEdz0-BHEA/exec',
  });

  globalObject.APPS_SCRIPT_ENDPOINTS = endpoints;

  Object.entries(endpoints).forEach(([key, value]) => {
    const propertyName = `APPS_SCRIPT_ENDPOINT_${key}`;
    globalObject[propertyName] = value;
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : undefined);
