export class TemplateStore {
    constructor(options = {}) {
        this.endpoint = options.endpoint || window.TEMPLATE_BACKEND_URL || '';
        this.fetchImpl = options.fetch || window.fetch.bind(window);
        this.cache = {
            templates: null,
            fetchedAt: 0,
        };
        this.defaultTimeout = options.timeout || 15000;
    }

    async fetchTemplates({ forceRefresh = false } = {}) {
        if (!forceRefresh && this.cache.templates && Date.now() - this.cache.fetchedAt < 60_000) {
            return this.cache.templates;
        }
        const payload = { action: 'getTemplates' };
        const response = await this._post(payload);
        if (!response.success) {
            throw new Error(response.message || 'Failed to fetch templates');
        }
        const templates = Array.isArray(response.templates) ? response.templates : [];
        this.cache = {
            templates,
            fetchedAt: Date.now(),
        };
        return templates;
    }

    async fetchTemplate(id) {
        if (!id) {
            throw new Error('Template ID is required');
        }
        const payload = { action: 'getTemplate', id };
        const response = await this._post(payload);
        if (!response.success) {
            throw new Error(response.message || 'Failed to fetch template');
        }
        return response.template || null;
    }

    async saveTemplate(template) {
        if (!template || !template.id) {
            throw new Error('Template payload must include id');
        }
        const payload = {
            action: 'saveTemplate',
            id: template.id,
            name: template.name,
            category: template.category || '',
            json: typeof template.json === 'string' ? template.json : JSON.stringify(template.json || {}),
            thumbnail: template.thumbnail || '',
            author: template.author || '',
            version: template.version || '',
        };
        const response = await this._post(payload);
        if (!response.success) {
            throw new Error(response.message || 'Failed to save template');
        }
        this.cache.fetchedAt = 0; // invalidate cache
        return response;
    }

    async deleteTemplate(id) {
        if (!id) {
            throw new Error('Template ID is required');
        }
        const payload = { action: 'deleteTemplate', id };
        const response = await this._post(payload);
        if (!response.success) {
            throw new Error(response.message || 'Failed to delete template');
        }
        this.cache.fetchedAt = 0;
        return response;
    }

    async _post(body) {
        if (!this.endpoint) {
            throw new Error('Template backend endpoint is not configured');
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
        try {
            const response = await this.fetchImpl(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error('Request failed with status ' + response.status);
            }
            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
