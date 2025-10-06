import { Extension } from 'https://esm.sh/@tiptap/core';

const BREAKPOINTS = ['base', 'desktop', 'tablet', 'mobile'];
const BREAKPOINT_LABELS = {
  base: 'Base',
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

const NODE_DEFINITIONS = {
  group: {
    label: 'グループ',
    description: 'レイアウトコンテナ。子要素を並べます。',
    defaultProps: {
      display: 'flex',
      direction: 'row',
      justify: 'flex-start',
      align: 'stretch',
      gap: '16px',
      padding: '16px',
      width: '100%'
    },
    properties: [
      { key: 'direction', label: '配置方向', type: 'select', options: ['row', 'column'] },
      { key: 'justify', label: '水平揃え', type: 'select', options: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'] },
      { key: 'align', label: '垂直揃え', type: 'select', options: ['stretch', 'flex-start', 'center', 'flex-end'] },
      { key: 'gap', label: '要素間隔', type: 'text', placeholder: '16px' },
      { key: 'padding', label: 'パディング', type: 'text', placeholder: '16px 24px' },
      { key: 'background', label: '背景色', type: 'text', placeholder: '#ffffff' },
      { key: 'border', label: '境界線', type: 'text', placeholder: '1px solid #e5e7eb' },
      { key: 'borderRadius', label: '角丸', type: 'text', placeholder: '8px' }
    ],
    allowChildren: ['group', 'text', 'image', 'button', 'divider']
  },
  text: {
    label: 'テキスト',
    description: '文章やタイトルに利用します。',
    defaultProps: {
      tag: 'p',
      content: 'サンプルテキスト',
      fontSize: '16px',
      color: '#1f2937',
      fontWeight: '400',
      lineHeight: '1.6',
      margin: '0',
      bindingKey: 'text'
    },
    properties: [
      { key: 'content', label: '初期テキスト', type: 'textarea' },
      { key: 'bindingKey', label: 'テキスト差替キー', type: 'text', placeholder: 'title' },
      { key: 'tag', label: 'タグ', type: 'select', options: ['p', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'span'] },
      { key: 'fontSize', label: 'フォントサイズ', type: 'text', placeholder: '16px' },
      { key: 'fontWeight', label: '太さ', type: 'text', placeholder: '400' },
      { key: 'color', label: '文字色', type: 'color' },
      { key: 'lineHeight', label: '行間', type: 'text', placeholder: '1.5' },
      { key: 'margin', label: 'マージン', type: 'text', placeholder: '0 0 16px' },
      { key: 'textAlign', label: 'テキスト揃え', type: 'select', options: ['', 'left', 'center', 'right', 'justify'] }
    ],
    allowChildren: []
  },
  image: {
    label: '画像',
    description: 'DriveImageギャラリーと連携可能なプレースホルダ。',
    defaultProps: {
      src: '',
      alt: '',
      width: '100%',
      height: 'auto',
      objectFit: 'cover',
      borderRadius: '12px',
      aspectRatio: '16/9',
      bindingKey: 'image'
    },
    properties: [
      { key: 'bindingKey', label: '画像差替キー', type: 'text', placeholder: 'image' },
      { key: 'src', label: '初期画像URL', type: 'text', placeholder: 'https://...' },
      { key: 'alt', label: '代替テキスト', type: 'text', placeholder: '説明文' },
      { key: 'width', label: '幅', type: 'text', placeholder: '100%' },
      { key: 'height', label: '高さ', type: 'text', placeholder: 'auto' },
      { key: 'aspectRatio', label: 'アスペクト比', type: 'text', placeholder: '16/9' },
      { key: 'objectFit', label: 'object-fit', type: 'select', options: ['cover', 'contain', 'fill', 'none', 'scale-down'] },
      { key: 'borderRadius', label: '角丸', type: 'text', placeholder: '12px' }
    ],
    allowChildren: []
  },
  button: {
    label: 'ボタン',
    description: 'CTAボタン。リンク付きテキスト。',
    defaultProps: {
      content: 'Button',
      href: '#',
      bindingKey: 'buttonLabel',
      justify: 'center',
      padding: '12px 20px',
      background: '#2563eb',
      color: '#ffffff',
      borderRadius: '8px'
    },
    properties: [
      { key: 'content', label: 'ボタン文言', type: 'text', placeholder: '詳細を見る' },
      { key: 'bindingKey', label: 'テキスト差替キー', type: 'text', placeholder: 'buttonLabel' },
      { key: 'href', label: 'リンクURL', type: 'text', placeholder: 'https://example.com' },
      { key: 'background', label: '背景色', type: 'color' },
      { key: 'color', label: '文字色', type: 'color' },
      { key: 'padding', label: 'パディング', type: 'text', placeholder: '12px 20px' },
      { key: 'borderRadius', label: '角丸', type: 'text', placeholder: '8px' },
      { key: 'textAlign', label: '揃え', type: 'select', options: ['', 'left', 'center', 'right'] }
    ],
    allowChildren: []
  },
  divider: {
    label: '区切り線',
    description: '水平線または余白。',
    defaultProps: {
      height: '1px',
      background: 'rgba(148, 163, 184, 0.3)',
      margin: '24px 0'
    },
    properties: [
      { key: 'height', label: '太さ', type: 'text', placeholder: '1px' },
      { key: 'background', label: '色', type: 'color' },
      { key: 'margin', label: '余白', type: 'text', placeholder: '24px 0' }
    ],
    allowChildren: []
  }
};

const RESPONSIVE_MEDIA = {
  desktop: '@media (min-width: 1025px)',
  tablet: '@media (max-width: 1024px) and (min-width: 641px)',
  mobile: '@media (max-width: 640px)'
};

const TEMPLATE_STORAGE_KEY = 'wiki-template-builder-draft';

function randomId(prefix = 'tpl') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function camelToKebab(str) {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function mergeStyles(base, overrides = {}) {
  const result = { ...base };
  Object.keys(overrides || {}).forEach((key) => {
    const value = overrides[key];
    if (value === undefined || value === null || value === '') {
      delete result[key];
    } else {
      result[key] = value;
    }
  });
  return result;
}

function walkNodes(nodes = [], callback) {
  nodes.forEach((node) => {
    callback(node);
    if (Array.isArray(node.children) && node.children.length) {
      walkNodes(node.children, callback);
    }
  });
}

function findNode(nodes, id) {
  let found = null;
  walkNodes(nodes, (node) => {
    if (node.id === id) {
      found = node;
    }
  });
  return found;
}

function removeNode(nodes, id) {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (node.id === id) {
      nodes.splice(i, 1);
      return true;
    }
    if (node.children && node.children.length) {
      const removed = removeNode(node.children, id);
      if (removed) {
        return true;
      }
    }
  }
  return false;
}

function createNode(type) {
  const def = NODE_DEFINITIONS[type];
  if (!def) {
    throw new Error('Unknown node type: ' + type);
  }
  return {
    id: randomId('node'),
    type,
    props: clone(def.defaultProps || {}),
    responsive: {
      desktop: {},
      tablet: {},
      mobile: {}
    },
    children: def.allowChildren && def.allowChildren.length ? [] : undefined
  };
}

function ensureResponsiveObject(node) {
  node.responsive = node.responsive || {};
  BREAKPOINTS.filter((bp) => bp !== 'base').forEach((bp) => {
    node.responsive[bp] = node.responsive[bp] || {};
  });
  return node;
}

function styleObjectToString(style = {}) {
  return Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${camelToKebab(key)}: ${value}`)
    .join('; ');
}

function renderNodeToHTML(node, templateId) {
  const baseStyles = mergeStyles(node.props || {}, {});
  const className = `${templateId}-${node.id}`;
  const nodeAttrs = [`class="${className}"`, `style="${styleObjectToString(baseStyles)}"`, `data-template-node="${node.type}"`, `data-template-node-id="${node.id}"`];
  let innerHTML = '';
  const bindingKey = node.props?.bindingKey || '';
  if (node.type === 'group') {
    const childrenHTML = (node.children || []).map((child) => renderNodeToHTML(child, templateId)).join('');
    innerHTML = childrenHTML;
  } else if (node.type === 'text') {
    const tag = node.props?.tag || 'p';
    const attrs = [...nodeAttrs];
    attrs.push(`data-template-binding="${bindingKey || ''}"`);
    const content = node.props?.content || '';
    return `<${tag} ${attrs.join(' ')}>${content}</${tag}>`;
  } else if (node.type === 'image') {
    const attrs = [...nodeAttrs];
    attrs.push(`data-template-binding="${bindingKey || ''}"`);
    const imgAttrs = [`alt="${node.props?.alt || ''}"`];
    if (node.props?.src) {
      imgAttrs.push(`src="${node.props.src}"`);
    } else {
      imgAttrs.push('src=""');
    }
    if (node.props?.width) {
      imgAttrs.push(`width="${node.props.width}"`);
    }
    if (node.props?.height && node.props.height !== 'auto') {
      imgAttrs.push(`height="${node.props.height}"`);
    }
    return `<figure ${attrs.join(' ')}><img ${imgAttrs.join(' ')} /></figure>`;
  } else if (node.type === 'button') {
    const attrs = [...nodeAttrs];
    attrs.push(`data-template-binding="${bindingKey || ''}"`);
    const href = node.props?.href || '#';
    const content = node.props?.content || 'Button';
    return `<div ${attrs.join(' ')}><a href="${href}" class="${className}__link">${content}</a></div>`;
  } else if (node.type === 'divider') {
    return `<div ${nodeAttrs.join(' ')}></div>`;
  }

  const attrs = [...nodeAttrs];
  if (bindingKey) {
    attrs.push(`data-template-binding="${bindingKey}"`);
  }
  return `<div ${attrs.join(' ')}>${innerHTML}</div>`;
}

function collectResponsiveRules(templateId, nodes) {
  const rules = [];
  walkNodes(nodes || [], (node) => {
    if (!node.responsive) {
      return;
    }
    Object.entries(node.responsive).forEach(([breakpoint, overrides]) => {
      if (!overrides || !Object.keys(overrides).length) {
        return;
      }
      const media = RESPONSIVE_MEDIA[breakpoint];
      if (!media) {
        return;
      }
      const className = `${templateId}-${node.id}`;
      rules.push(`${media} { .${className} { ${styleObjectToString(overrides)} } }`);
    });
  });
  return rules;
}

function generateTemplateHTML(template, options = {}) {
  const templateId = template.id || randomId('template');
  const childrenHTML = (template.children || []).map((node) => renderNodeToHTML(node, templateId)).join('');
  const responsiveCss = collectResponsiveRules(templateId, template.children || []);
  const styleId = `template-style-${templateId}`;
  let styleTag = '';
  if (responsiveCss.length && options.includeStyleTag !== false) {
    styleTag = `<style id="${styleId}">${responsiveCss.join('\n')}</style>`;
  }
  return `${styleTag}<section class="wiki-template" data-template-id="${templateId}" data-template-instance="${randomId('instance')}">${childrenHTML}</section>`;
}

function createEmptyTemplate() {
  return {
    id: randomId('template'),
    name: '新規テンプレート',
    category: 'layout',
    version: '1.0.0',
    description: '',
    thumbnail: '',
    author: '',
    children: [
      {
        ...createNode('group'),
        props: {
          ...NODE_DEFINITIONS.group.defaultProps,
          padding: '32px',
          gap: '24px',
          background: '#ffffff',
          borderRadius: '16px'
        }
      }
    ]
  };
}

class TemplateBuilderUI {
  constructor(options) {
    this.editor = options.editor;
    this.store = options.store;
    this.extension = options.extension;
    this.modalId = options.modalId || 'template-builder-modal';
    this.activeBreakpoint = 'base';
    this.templates = [];
    this.state = {
      template: createEmptyTemplate(),
      selectedNodeId: null,
      isSaving: false,
    };
    this.createModal();
    this.restoreDraft();
    if (this.store) {
      this.loadTemplates();
    }
  }

  createModal() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'template-builder-overlay';
    this.overlay.dataset.visible = 'false';
    this.overlay.innerHTML = `
      <div class="template-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="template-builder-title">
        <header class="template-builder-header">
          <div>
            <h2 id="template-builder-title">UIテンプレートビルダー</h2>
            <p class="template-builder-sub">要素の追加・レスポンシブ設定・保存を行えます。</p>
          </div>
          <div class="template-builder-header-actions">
            <button class="template-builder-close" type="button" aria-label="閉じる">×</button>
          </div>
        </header>
        <div class="template-builder-body">
          <aside class="template-builder-sidebar">
            <div class="template-list-toolbar">
              <button class="tb-refresh" type="button">再読込</button>
              <button class="tb-new" type="button">新規作成</button>
            </div>
            <div class="template-list" data-role="template-list"></div>
          </aside>
          <div class="template-builder-main">
            <div class="template-meta">
              <div class="template-meta-field">
                <label>テンプレート名</label>
                <input type="text" data-role="template-name" placeholder="Two Column Card" />
              </div>
              <div class="template-meta-field">
                <label>カテゴリ</label>
                <input type="text" data-role="template-category" placeholder="card / hero / banner" />
              </div>
              <div class="template-meta-field">
                <label>説明</label>
                <input type="text" data-role="template-description" placeholder="用途をメモ" />
              </div>
              <div class="template-meta-field">
                <label>ブレークポイント</label>
                <div class="breakpoint-toggle" data-role="breakpoints"></div>
              </div>
            </div>
            <div class="template-workspace">
              <div class="template-canvas" data-role="canvas"></div>
              <div class="template-properties">
                <div class="properties-header">
                  <h3>プロパティ</h3>
                  <div class="properties-node-info" data-role="selected-node"></div>
                </div>
                <div class="properties-content" data-role="properties"></div>
                <div class="properties-actions">
                  <button type="button" data-role="delete-node" class="danger">要素を削除</button>
                </div>
              </div>
            </div>
            <div class="template-preview">
              <div class="preview-toolbar">
                <span>プレビュー</span>
                <div class="preview-breakpoints">
                  <button type="button" data-preview="desktop" class="active">PC</button>
                  <button type="button" data-preview="tablet">Tablet</button>
                  <button type="button" data-preview="mobile">Mobile</button>
                </div>
                <button type="button" data-role="insert" class="primary">エディタに挿入</button>
                <button type="button" data-role="save" class="primary">保存</button>
              </div>
              <div class="preview-viewport" data-role="preview"></div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(this.overlay);

    this.overlay.querySelector('.template-builder-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) {
        this.close();
      }
    });

    this.canvasElement = this.overlay.querySelector('[data-role="canvas"]');
    this.propertiesElement = this.overlay.querySelector('[data-role="properties"]');
    this.selectedNodeLabel = this.overlay.querySelector('[data-role="selected-node"]');
    this.previewElement = this.overlay.querySelector('[data-role="preview"]');
    this.templateListElement = this.overlay.querySelector('[data-role="template-list"]');
    this.templateNameInput = this.overlay.querySelector('[data-role="template-name"]');
    this.templateCategoryInput = this.overlay.querySelector('[data-role="template-category"]');
    this.templateDescriptionInput = this.overlay.querySelector('[data-role="template-description"]');
    this.deleteNodeButton = this.overlay.querySelector('[data-role="delete-node"]');
    this.breakpointToggle = this.overlay.querySelector('[data-role="breakpoints"]');
    this.saveButton = this.overlay.querySelector('[data-role="save"]');
    this.insertButton = this.overlay.querySelector('[data-role="insert"]');

    this.templateNameInput.addEventListener('input', () => this.updateTemplateMeta());
    this.templateCategoryInput.addEventListener('input', () => this.updateTemplateMeta());
    this.templateDescriptionInput.addEventListener('input', () => this.updateTemplateMeta());
    this.deleteNodeButton.addEventListener('click', () => this.deleteSelectedNode());
    this.saveButton.addEventListener('click', () => this.handleSave());
    this.insertButton.addEventListener('click', () => this.handleInsert());

    this.overlay.querySelector('.tb-refresh').addEventListener('click', () => this.loadTemplates(true));
    this.overlay.querySelector('.tb-new').addEventListener('click', () => this.createNewTemplate());

    this.overlay.querySelectorAll('.preview-breakpoints button').forEach((button) => {
      button.addEventListener('click', () => {
        this.overlay.querySelectorAll('.preview-breakpoints button').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        this.renderPreview(button.dataset.preview);
      });
    });

    this.renderBreakpointToggle();
  }

  open() {
    this.overlay.dataset.visible = 'true';
    this.render();
    this.renderPreview('desktop');
  }

  close() {
    this.overlay.dataset.visible = 'false';
    this.saveDraft();
  }

  createNewTemplate() {
    this.state.template = createEmptyTemplate();
    this.state.selectedNodeId = this.state.template.children[0].id;
    this.render();
    this.renderPreview('desktop');
  }

  async loadTemplates(forceRefresh = false) {
    if (!this.store) {
      return;
    }
    try {
      this.templates = await this.store.fetchTemplates({ forceRefresh });
      this.renderTemplateList();
    } catch (error) {
      console.error('[TemplateBuilder] Failed to load templates', error);
    }
  }

  async saveDraft() {
    try {
      const payload = {
        template: this.state.template,
        selectedNodeId: this.state.selectedNodeId,
        activeBreakpoint: this.activeBreakpoint,
        timestamp: Date.now(),
      };
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('[TemplateBuilder] Failed to save draft', error);
    }
  }

  restoreDraft() {
    try {
      const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (!raw) {
        this.state.selectedNodeId = this.state.template.children[0].id;
        return;
      }
      const payload = JSON.parse(raw);
      if (payload && payload.template) {
        this.state.template = payload.template;
        walkNodes(this.state.template.children || [], ensureResponsiveObject);
        this.state.selectedNodeId = payload.selectedNodeId || (payload.template.children?.[0]?.id ?? null);
        this.activeBreakpoint = payload.activeBreakpoint || 'base';
      }
    } catch (error) {
      console.warn('[TemplateBuilder] Failed to restore draft', error);
    }
  }

  renderTemplateList() {
    if (!this.templateListElement) {
      return;
    }
    this.templateListElement.innerHTML = '';
    if (!this.templates.length) {
      this.templateListElement.innerHTML = '<p class="template-list-empty">テンプレートがありません。</p>';
      return;
    }
    this.templates.forEach((tpl) => {
      const item = document.createElement('button');
      item.className = 'template-list-item';
      item.type = 'button';
      item.innerHTML = `
        <span class="template-list-title">${tpl.name || '無題テンプレート'}</span>
        <span class="template-list-meta">${tpl.category || ''}</span>`;
      item.addEventListener('click', async () => {
        await this.loadTemplate(tpl.id);
      });
      this.templateListElement.appendChild(item);
    });
  }

  async loadTemplate(id) {
    if (!this.store || !id) {
      return;
    }
    try {
      const result = await this.store.fetchTemplate(id);
      if (!result) {
        return;
      }
      let json;
      try {
        json = typeof result.json === 'string' ? JSON.parse(result.json) : result.json;
      } catch (error) {
        console.error('[TemplateBuilder] Failed to parse template json', error);
        return;
      }
      this.state.template = {
        id: result.id || json.id || randomId('template'),
        name: result.name || json.name || '無題テンプレート',
        category: result.category || json.category || '',
        description: json.description || '',
        version: result.version || json.version || '1.0.0',
        thumbnail: result.thumbnail || json.thumbnail || '',
        author: result.author || json.author || '',
        children: json.children || []
      };
      if (!this.state.template.children.length) {
        this.state.template.children = [createNode('group')];
      }
      walkNodes(this.state.template.children, ensureResponsiveObject);
      this.state.selectedNodeId = this.state.template.children[0].id;
      this.render();
      this.renderPreview('desktop');
    } catch (error) {
      console.error('[TemplateBuilder] Failed to load template', error);
    }
  }

  updateTemplateMeta() {
    this.state.template.name = this.templateNameInput.value;
    this.state.template.category = this.templateCategoryInput.value;
    this.state.template.description = this.templateDescriptionInput.value;
    this.renderPreview();
  }

  render() {
    const template = this.state.template;
    this.templateNameInput.value = template.name || '';
    this.templateCategoryInput.value = template.category || '';
    this.templateDescriptionInput.value = template.description || '';
    this.renderCanvas();
    this.renderProperties();
    this.renderPreview();
    this.renderTemplateList();
    this.renderBreakpointToggle();
  }

  renderCanvas() {
    if (!this.canvasElement) {
      return;
    }
    this.canvasElement.innerHTML = '';
    const rootList = document.createElement('div');
    rootList.className = 'canvas-node-list';
    (this.state.template.children || []).forEach((node) => {
      rootList.appendChild(this.renderCanvasNode(node, null));
    });
    this.canvasElement.appendChild(rootList);
    const addButtons = this.createAddButtons(null);
    addButtons.classList.add('canvas-add-root');
    this.canvasElement.appendChild(addButtons);
  }

  renderCanvasNode(node, parentId) {
    const container = document.createElement('div');
    container.className = 'canvas-node';
    if (node.id === this.state.selectedNodeId) {
      container.classList.add('selected');
    }
    container.dataset.nodeId = node.id;
    const header = document.createElement('div');
    header.className = 'canvas-node-header';
    const title = document.createElement('div');
    title.className = 'canvas-node-title';
    const def = NODE_DEFINITIONS[node.type];
    title.textContent = def ? def.label : node.type;
    header.appendChild(title);
    const actions = document.createElement('div');
    actions.className = 'canvas-node-actions';
    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.textContent = '選択';
    selectBtn.addEventListener('click', () => {
      this.state.selectedNodeId = node.id;
      this.render();
    });
    actions.appendChild(selectBtn);
    if (def && def.allowChildren && def.allowChildren.length) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = '子を追加';
      addBtn.addEventListener('click', () => {
        this.showAddMenu(node.id, addBtn);
      });
      actions.appendChild(addBtn);
    }
    if (parentId) {
      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.textContent = '↑';
      upBtn.addEventListener('click', () => this.moveNode(node.id, parentId, -1));
      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.textContent = '↓';
      downBtn.addEventListener('click', () => this.moveNode(node.id, parentId, 1));
      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
    }
    header.appendChild(actions);
    container.appendChild(header);

    if (node.children && node.children.length) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'canvas-node-children';
      node.children.forEach((child) => {
        childrenContainer.appendChild(this.renderCanvasNode(child, node.id));
      });
      const addButtons = this.createAddButtons(node.id);
      childrenContainer.appendChild(addButtons);
      container.appendChild(childrenContainer);
    } else if (node.children) {
      const addButtons = this.createAddButtons(node.id);
      addButtons.classList.add('canvas-add-empty');
      container.appendChild(addButtons);
    }
    return container;
  }

  createAddButtons(parentId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-add-buttons';
    const allowedTypes = this.getAllowedChildTypes(parentId);
    if (!allowedTypes.length) {
      const empty = document.createElement('p');
      empty.className = 'canvas-add-none';
      empty.textContent = '追加できる要素はありません';
      wrapper.appendChild(empty);
      return wrapper;
    }
    allowedTypes.forEach((type) => {
      const def = NODE_DEFINITIONS[type];
      if (!def) {
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${def.label}を追加`;
      button.addEventListener('click', () => {
        this.addNode(parentId, type);
      });
      wrapper.appendChild(button);
    });
    return wrapper;
  }

  getAllowedChildTypes(parentId) {
    if (!parentId) {
      return ['group'];
    }
    const parentNode = findNode(this.state.template.children, parentId);
    if (!parentNode) {
      return [];
    }
    const parentDef = NODE_DEFINITIONS[parentNode.type];
    if (parentDef && Array.isArray(parentDef.allowChildren) && parentDef.allowChildren.length) {
      return parentDef.allowChildren;
    }
    return [];
  }

  showAddMenu(parentId, anchor) {
    const menu = document.createElement('div');
    menu.className = 'canvas-add-menu';
    const allowedTypes = this.getAllowedChildTypes(parentId);
    if (!allowedTypes.length) {
      const empty = document.createElement('p');
      empty.className = 'canvas-add-none';
      empty.textContent = '追加できる要素はありません';
      menu.appendChild(empty);
    } else {
      allowedTypes.forEach((type) => {
        const def = NODE_DEFINITIONS[type];
        if (!def) {
          return;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = def.label;
        button.addEventListener('click', () => {
          this.addNode(parentId, type);
          menu.remove();
        });
        menu.appendChild(button);
      });
    }
    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    const remove = () => {
      menu.remove();
      document.removeEventListener('click', outsideHandler, true);
    };
    const outsideHandler = (event) => {
      if (!menu.contains(event.target)) {
        remove();
      }
    };
    document.addEventListener('click', outsideHandler, true);
  }

  addNode(parentId, type) {
    const newNode = createNode(type);
    ensureResponsiveObject(newNode);
    if (!parentId) {
      this.state.template.children = this.state.template.children || [];
      this.state.template.children.push(newNode);
    } else {
      const parentNode = findNode(this.state.template.children, parentId);
      if (!parentNode) {
        return;
      }
      parentNode.children = parentNode.children || [];
      parentNode.children.push(newNode);
    }
    this.state.selectedNodeId = newNode.id;
    this.render();
  }

  moveNode(nodeId, parentId, direction) {
    const parentNode = parentId ? findNode(this.state.template.children, parentId) : { children: this.state.template.children };
    if (!parentNode || !Array.isArray(parentNode.children)) {
      return;
    }
    const index = parentNode.children.findIndex((child) => child.id === nodeId);
    if (index === -1) {
      return;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= parentNode.children.length) {
      return;
    }
    const [node] = parentNode.children.splice(index, 1);
    parentNode.children.splice(newIndex, 0, node);
    this.render();
  }

  deleteSelectedNode() {
    const nodeId = this.state.selectedNodeId;
    if (!nodeId) {
      return;
    }
    if (this.state.template.children.length <= 1) {
      alert('最低1つのルート要素が必要です。');
      return;
    }
    removeNode(this.state.template.children, nodeId);
    this.state.selectedNodeId = this.state.template.children[0]?.id || null;
    this.render();
  }

  renderProperties() {
    if (!this.propertiesElement) {
      return;
    }
    const node = findNode(this.state.template.children, this.state.selectedNodeId);
    if (!node) {
      this.propertiesElement.innerHTML = '<p class="properties-empty">要素を選択してください。</p>';
      this.selectedNodeLabel.textContent = '';
      return;
    }
    ensureResponsiveObject(node);
    const def = NODE_DEFINITIONS[node.type];
    this.selectedNodeLabel.textContent = `${def?.label || node.type} / ${node.id}`;
    const activeTarget = this.activeBreakpoint === 'base' ? node.props : node.responsive[this.activeBreakpoint];
    this.propertiesElement.innerHTML = '';

    const form = document.createElement('div');
    form.className = 'properties-form';
    (def?.properties || []).forEach((property) => {
      const field = document.createElement('label');
      field.className = 'property-field';
      const title = document.createElement('span');
      title.textContent = property.label;
      field.appendChild(title);
      let input;
      const currentValue = this.getPropertyValue(node, property.key);
      if (property.type === 'select') {
        input = document.createElement('select');
        (property.options || ['']).forEach((option) => {
          const opt = document.createElement('option');
          opt.value = option;
          opt.textContent = option || '（指定なし）';
          if (currentValue === option) {
            opt.selected = true;
          }
          input.appendChild(opt);
        });
      } else if (property.type === 'textarea') {
        input = document.createElement('textarea');
        input.value = currentValue || '';
      } else if (property.type === 'color') {
        input = document.createElement('input');
        input.type = 'color';
        input.value = currentValue || '#000000';
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue || '';
        if (property.placeholder) {
          input.placeholder = property.placeholder;
        }
      }
      input.addEventListener('input', () => {
        this.setPropertyValue(node, property.key, input.value);
      });
      field.appendChild(input);
      form.appendChild(field);
    });

    const commonProps = ['width', 'height', 'margin', 'padding', 'background'];
    commonProps.forEach((key) => {
      if (def?.properties?.some((prop) => prop.key === key)) {
        return;
      }
      const field = document.createElement('label');
      field.className = 'property-field';
      field.innerHTML = `<span>${key}</span>`;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = this.getPropertyValue(node, key) || '';
      input.addEventListener('input', () => {
        this.setPropertyValue(node, key, input.value);
      });
      field.appendChild(input);
      form.appendChild(field);
    });

    this.propertiesElement.appendChild(form);
  }

  getPropertyValue(node, key) {
    if (!node) {
      return '';
    }
    if (this.activeBreakpoint !== 'base') {
      const overrides = node.responsive?.[this.activeBreakpoint];
      if (overrides && overrides[key] !== undefined) {
        return overrides[key];
      }
    }
    return node.props?.[key] ?? '';
  }

  setPropertyValue(node, key, value) {
    ensureResponsiveObject(node);
    const normalized = typeof value === 'string' ? value.trim() : value ?? '';
    const finalValue = normalized;
    if (this.activeBreakpoint === 'base') {
      if (!node.props) {
        node.props = {};
      }
      if (finalValue === '') {
        delete node.props[key];
      } else {
        node.props[key] = finalValue;
      }
    } else {
      if (finalValue === '') {
        delete node.responsive[this.activeBreakpoint][key];
      } else {
        node.responsive[this.activeBreakpoint][key] = finalValue;
      }
    }
    this.renderPreview();
  }

  renderBreakpointToggle() {
    if (!this.breakpointToggle) {
      return;
    }
    this.breakpointToggle.innerHTML = '';
    BREAKPOINTS.forEach((bp) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = BREAKPOINT_LABELS[bp] || bp;
      if (this.activeBreakpoint === bp) {
        button.classList.add('active');
      }
      button.addEventListener('click', () => {
        this.activeBreakpoint = bp;
        this.renderProperties();
        this.renderBreakpointToggle();
      });
      this.breakpointToggle.appendChild(button);
    });
  }

  renderPreview(mode = 'desktop') {
    if (!this.previewElement) {
      return;
    }
    const template = this.state.template;
    this.previewElement.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = `preview-wrapper preview-${mode}`;
    const html = generateTemplateHTML(template);
    wrapper.innerHTML = html;
    this.previewElement.appendChild(wrapper);
  }

  injectResponsiveStyles() {
    const templateId = this.state.template.id;
    if (!templateId) {
      return;
    }
    const cssRules = collectResponsiveRules(templateId, this.state.template.children || []);
    if (!cssRules.length) {
      return;
    }
    const styleId = `template-style-${templateId}`;
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = cssRules.join('\n');
  }

  async handleSave() {
    if (!this.store) {
      alert('バックエンドが設定されていません。');
      return;
    }
    try {
      this.saveButton.disabled = true;
      const templateId = this.state.template.id || randomId('template');
      this.state.template.id = templateId;
      const payload = {
        id: templateId,
        name: this.state.template.name,
        category: this.state.template.category,
        version: this.state.template.version || '1.0.0',
        thumbnail: this.state.template.thumbnail || '',
        author: this.state.template.author || '',
        json: {
          id: templateId,
          name: this.state.template.name,
          category: this.state.template.category,
          version: this.state.template.version,
          description: this.state.template.description,
          author: this.state.template.author,
          thumbnail: this.state.template.thumbnail,
          children: this.state.template.children,
        },
      };
      await this.store.saveTemplate(payload);
      await this.loadTemplates(true);
      alert('テンプレートを保存しました。');
    } catch (error) {
      console.error('[TemplateBuilder] Failed to save template', error);
      alert('テンプレートの保存に失敗しました: ' + error.message);
    } finally {
      this.saveButton.disabled = false;
    }
  }

  handleInsert() {
    const templateId = this.state.template.id || randomId('template');
    this.state.template.id = templateId;
    this.injectResponsiveStyles();
    const html = generateTemplateHTML(this.state.template, { includeStyleTag: false });
    this.editor.commands.insertContent(html);
    this.close();
  }
}

export const TemplateBuilderExtension = Extension.create({
  name: 'templateBuilder',

  addOptions() {
    return {
      toolbarSelector: '.toolbar',
      buttonClass: 'toolbar-button',
      buttonLabel: 'テンプレート',
      store: null,
      modalId: 'template-builder-modal',
    };
  },

  onCreate() {
    this.ensureBuilder();
    this.addToolbarButton();
  },

  ensureBuilder() {
    if (!this.builder) {
      this.builder = new TemplateBuilderUI({
        editor: this.editor,
        store: this.options.store,
        extension: this,
        modalId: this.options.modalId,
      });
    }
  },

  addToolbarButton() {
    const toolbar = document.querySelector(this.options.toolbarSelector);
    if (!toolbar) {
      console.warn('[TemplateBuilderExtension] Toolbar not found:', this.options.toolbarSelector);
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = this.options.buttonClass;
    button.textContent = this.options.buttonLabel;
    button.addEventListener('click', () => this.editor.commands.openTemplateBuilder());
    toolbar.appendChild(button);
    this.toolbarButton = button;
  },

  addCommands() {
    return {
      openTemplateBuilder: () => () => {
        this.ensureBuilder();
        this.builder.open();
        return true;
      },
      insertTemplate: (template) => ({ editor }) => {
        if (!template) {
          return false;
        }
        const templateId = template.id || randomId('template');
        template.id = templateId;
        const cssRules = collectResponsiveRules(templateId, template.children || []);
        if (cssRules.length) {
          const styleId = `template-style-${templateId}`;
          let styleElement = document.getElementById(styleId);
          if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
          }
          styleElement.textContent = cssRules.join('\n');
        }
        const html = generateTemplateHTML(template, { includeStyleTag: false });
        editor.commands.insertContent(html);
        return true;
      },
    };
  },

  onDestroy() {
    if (this.toolbarButton) {
      this.toolbarButton.remove();
    }
  },
});
