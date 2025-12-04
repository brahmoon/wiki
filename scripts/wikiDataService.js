const DEFAULT_TIMEOUT = 25000;

function fetchWithoutPreflight(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);

    const fetchOptions = {
      mode: 'cors',
      credentials: 'omit',
      ...options,
      headers: {
        'Content-Type': 'text/plain',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    };

    fetch(url, fetchOptions)
      .then(response => {
        window.clearTimeout(timer);
        resolve(response);
      })
      .catch(error => {
        window.clearTimeout(timer);
        if (error.name === 'AbortError') {
          reject(new Error(`Request timeout after ${timeout}ms`));
        } else {
          reject(error);
        }
      });
  });
}

export class WikiDataService {
  constructor({ endpoint, timeout = DEFAULT_TIMEOUT, resolveCredentials = null } = {}) {
    if (!endpoint) {
      throw new Error('WikiDataService requires an endpoint URL');
    }
    this.endpoint = endpoint;
    this.timeout = timeout;
    this.resolveCredentials = typeof resolveCredentials === 'function' ? resolveCredentials : null;
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

  async getPageHistory(id) {
    if (!id) {
      throw new Error('Page ID is required');
    }
    const response = await this.#apiCall('getPageHistory', { id });
    return response.versions || [];
  }

  async savePage(page) {
    if (!page || !page.id) {
      throw new Error('Page payload must include an id');
    }
    return this.#apiCall('savePage', page);
  }

  async renamePageTree({ originalId, newId }) {
    if (!originalId || !newId) {
      throw new Error('Both originalId and newId are required');
    }
    if (originalId === newId) {
      return { success: true, message: 'No changes required' };
    }
    return this.#apiCall('renamePageTree', { originalId, newId });
  }

  async reorderPages({ movedId, targetId = null, position = 'end' } = {}) {
    if (!movedId) {
      throw new Error('movedId is required');
    }
    const payload = {
      movedId,
      position,
    };
    if (targetId) {
      payload.targetId = targetId;
    }
    return this.#apiCall('reorderPages', payload);
  }

  async #apiCall(action, data = {}) {
    let credentials = {};
    if (this.resolveCredentials) {
      try {
        const resolved = this.resolveCredentials() || {};
        if (resolved && typeof resolved === 'object') {
          credentials = resolved;
        }
      } catch (error) {
        console.warn('Failed to resolve WikiDataService credentials:', error);
      }
    }

    const payload = {
      action,
      origin: typeof window !== 'undefined' && window.location ? window.location.origin : '',
      ...credentials,
      ...data,
    };

    let response;
    try {
      response = await fetchWithoutPreflight(
        this.endpoint,
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        this.timeout
      );
    } catch (error) {
      throw new Error(`Failed to reach Apps Script endpoint: ${error.message || error}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? `\n${errorText}` : ''}`);
    }

    let result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('Failed to parse JSON response from Apps Script');
    }

    if (!result?.success) {
      throw new Error(result?.message || 'Apps Script reported an error');
    }

    return result;
  }
}
