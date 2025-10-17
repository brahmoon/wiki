(function defineAppsScriptEndpoints(globalObject) {
  if (!globalObject) {
    return;
  }

  const endpoints = Object.freeze({
    WIKI: 'https://script.google.com/macros/s/AKfycbyFiFm2zdtkPhuZ4EOJ-yLEGnw_opM5hxQBb7EE-sSg2mJ9pOU3HTrFoAXgIeb5J2Q91w/exec',
    DRIVE_IMAGE: 'https://script.google.com/macros/s/AKfycbxaS2LMlxk5rx-XK6XTkFG2S58NKTkOnBL3smjF_mbyP_QA0PDJJ2hBE0_-PEX7nSO4/exec',
    LOGIN: 'https://script.google.com/macros/s/AKfycbw4DPAmRq9f-zikBUH4MLWxfhVPmMI1dJpmMWeiDWkKxQwPKLPZa1wp4pZk3eav2zJ4/exec',
    ADMIN_AUTH: 'https://script.google.com/macros/s/AKfycbzI-y-5zaqv_rBZVHIzEyMl2PBLkil_MPIFkN4tpbKtb-Lzj91qvY2-S_CuPPeZXdaRrQ/exec',
    USER_SETTINGS: 'https://script.google.com/macros/s/AKfycbzLYkmWzTM7-uu1HeYK7yf8YmOF3hKTr6ddun8Z266SnexD0cUQqs2SORxniltZKUFcQQ/exec',
    TOOLBAR_PLUGIN: 'https://script.google.com/macros/s/AKfycbxqJEfpYVc3Xtpf_NXdB0j-EUDefyFw04F1ZEtPnandolXMUsxnSAlQUVk8FL5hz0BubA/exec',
  });

  globalObject.APPS_SCRIPT_ENDPOINTS = endpoints;

  Object.entries(endpoints).forEach(([key, value]) => {
    const propertyName = `APPS_SCRIPT_ENDPOINT_${key}`;
    globalObject[propertyName] = value;
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : undefined);
