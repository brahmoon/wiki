(function defineAppsScriptEndpoints(globalObject) {
  if (!globalObject) {
    return;
  }

  const endpoints = Object.freeze({
    WIKI: 'https://script.google.com/macros/s/AKfycbyFiFm2zdtkPhuZ4EOJ-yLEGnw_opM5hxQBb7EE-sSg2mJ9pOU3HTrFoAXgIeb5J2Q91w/exec',
    DRIVE_IMAGE: 'https://script.google.com/macros/s/AKfycbyvK1s6Zs4ccn_yeSh2Xz8MWOa5AO8y_GsqRr8BacITxMU8MhcEFDVm7IT56ZZUvWXE/exec',
    LOGIN: 'https://script.google.com/macros/s/AKfycbw4DPAmRq9f-zikBUH4MLWxfhVPmMI1dJpmMWeiDWkKxQwPKLPZa1wp4pZk3eav2zJ4/exec',
    ADMIN_AUTH: 'https://script.google.com/macros/s/AKfycbxqJEfpYVc3Xtpf_NXdB0j-EUDefyFw04F1ZEtPnandolXMUsxnSAlQUVk8FL5hz0BubA/exec',
    USER_SETTINGS: 'https://script.google.com/macros/s/AKfycbx3fjjyy7ioBSrhQC07zZ4RFdUMVVsWD8OuZvq0kcCwXP7k1FX1_X4L9_MRbAM4OgYmpA/exec',
    TOOLBAR_PLUGIN: 'https://script.google.com/macros/s/AKfycbxqJEfpYVc3Xtpf_NXdB0j-EUDefyFw04F1ZEtPnandolXMUsxnSAlQUVk8FL5hz0BubA/exec',
  });

  globalObject.APPS_SCRIPT_ENDPOINTS = endpoints;

  Object.entries(endpoints).forEach(([key, value]) => {
    const propertyName = `APPS_SCRIPT_ENDPOINT_${key}`;
    globalObject[propertyName] = value;
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : undefined);
