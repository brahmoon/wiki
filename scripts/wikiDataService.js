const DEFAULT_TIMEOUT = 25000;

function toQueryParams(data) {
  const params = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    params.append(key, String(value));
  });
  return params;
}

export class WikiDataService {
  constructor({ endpoint, timeout = DEFAULT_TIMEOUT } = {}) {
    if (!endpoint) {
      throw new Error('WikiDataService requires an endpoint URL');
    }
    this.endpoint = endpoint;
    this.timeout = timeout;
  }

  async getPages() {
    const response = await this.#apiCall('getPages');
    return response.pages || [];
  }

  async getPage(id) {
    if (!id) {
      throw new Error('Page ID is required');
    }
    const response = await this.#apiCall('getPage', { id });
    if (!response.page) {
      throw new Error('Page not found');
    }
    return response.page;
  }

  async savePage(page) {
    if (!page || !page.id) {
      throw new Error('Page payload must include an id');
    }
    return this.#apiCall('savePage', page);
  }

  async #apiCall(action, data = {}) {
    try {
      return await this.#apiCallJSONP(action, data);
    } catch (error) {
      console.warn('JSONP failed, falling back to form submission', error);
      return this.#apiCallForm(action, data);
    }
  }

  #buildJsonpUrl(action, data, callbackName) {
    const params = toQueryParams({ action, callback: callbackName, ...data });
    return `${this.endpoint}?${params.toString()}`;
  }

  async #apiCallJSONP(action, data) {
    return new Promise((resolve, reject) => {
      const callbackName = `wikiJsonp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const script = document.createElement('script');
      script.id = callbackName;
      script.src = this.#buildJsonpUrl(action, data, callbackName);

      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error('JSONP request timeout'));
      }, this.timeout);

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };

      window[callbackName] = response => {
        cleanup();
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.message || 'API call failed'));
        }
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('JSONP script load error'));
      };

      document.head.appendChild(script);
    });
  }

  async #apiCallForm(action, data) {
    return new Promise((resolve, reject) => {
      const formId = `wikiForm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const iframeName = `${formId}_iframe`;

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = this.endpoint;
      form.target = iframeName;
      form.style.display = 'none';

      const formData = { action, ...data };
      Object.entries(formData).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      });

      const iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.style.display = 'none';

      let resolved = false;

      const cleanup = () => {
        window.removeEventListener('message', messageHandler);
        if (form.parentNode) {
          form.parentNode.removeChild(form);
        }
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };

      const finalize = result => {
        resolved = true;
        cleanup();
        if (result?.success) {
          resolve(result);
        } else {
          reject(new Error(result?.message || 'API call failed'));
        }
      };

      const messageHandler = event => {
        if (event.origin === 'https://script.google.com' && event.data?.type === 'FORM_RESPONSE') {
          finalize(event.data.data);
        }
      };

      iframe.onload = () => {
        window.setTimeout(() => {
          if (!resolved) {
            cleanup();
            resolve({ success: true, message: 'Request submitted' });
          }
        }, Math.min(this.timeout, 10000));
      };

      iframe.onerror = () => {
        cleanup();
        reject(new Error('Failed to submit form request'));
      };

      window.addEventListener('message', messageHandler);
      document.body.appendChild(form);
      document.body.appendChild(iframe);
      form.submit();

      window.setTimeout(() => {
        if (!resolved) {
          cleanup();
          resolve({ success: true, message: 'Request submitted (timeout)' });
        }
      }, this.timeout + 5000);
    });
  }
}
