import { Extension } from 'https://esm.sh/@tiptap/core';

const ALIGN_OPTIONS = [
    { value: 'left', label: '左寄せ' },
    { value: 'center', label: '中央寄せ' },
    { value: 'right', label: '右寄せ' }
];

let elementIdCounter = 0;

function createElementId() {
    elementIdCounter += 1;
    return `tpl-el-${Date.now()}-${elementIdCounter}`;
}

function escapeHtml(value) {
    return (value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/\n/g, ' ');
}

function normalizeSpacing(value) {
    const trimmed = (value ?? '').toString().trim();
    return trimmed ? trimmed : '0';
}

function alignToFlex(align) {
    switch (align) {
        case 'center':
            return 'center';
        case 'right':
            return 'flex-end';
        default:
            return 'flex-start';
    }
}

function alignToText(align) {
    if (align === 'center') {
        return 'center';
    }
    if (align === 'right') {
        return 'right';
    }
    return 'left';
}

function cloneElement(element) {
    return {
        id: element.id,
        type: element.type,
        padding: element.padding,
        margin: element.margin,
        align: element.align,
        content: element.content,
        src: element.src,
        children: (element.children || []).map(child => cloneElement(child))
    };
}

function buildElementsMarkup(elements, baseClass, pathPrefix = []) {
    const htmlParts = [];
    const cssParts = [];

    elements.forEach((element, index) => {
        const path = [...pathPrefix, index + 1];
        const type = element.type || 'frame';
        const className = `${baseClass}__${type}-${path.join('-')}`;
        const margin = normalizeSpacing(element.margin);
        const padding = normalizeSpacing(element.padding);
        const align = element.align || 'left';
        if (type === 'frame') {
            const { html: childHtml, css: childCss } = buildElementsMarkup(element.children || [], baseClass, path);
            htmlParts.push(`<div class="${className}">${childHtml}</div>`);
            cssParts.push(`.${className} { display: flex; flex-direction: column; gap: 12px; padding: ${padding}; margin: ${margin}; align-items: ${alignToFlex(align)}; width: 100%; }`);
            if (childCss) {
                cssParts.push(childCss);
            }
        } else if (type === 'image') {
            const src = escapeAttribute(element.src || '');
            htmlParts.push(`<div class="${className}">${src ? `<img src="${src}" alt="" />` : ''}</div>`);
            const alignRule = alignToText(align);
            cssParts.push(`.${className} { padding: ${padding}; margin: ${margin}; text-align: ${alignRule}; }`);
            cssParts.push(`.${className} > img { max-width: 100%; height: auto; display: inline-block; }`);
        } else {
            const content = escapeHtml(element.content || '');
            const alignRule = alignToText(align);
            htmlParts.push(`<div class="${className}">${content.replace(/\n/g, '<br>')}</div>`);
            cssParts.push(`.${className} { padding: ${padding}; margin: ${margin}; text-align: ${alignRule}; white-space: pre-wrap; word-break: break-word; }`);
        }
    });

    return {
        html: htmlParts.join(''),
        css: cssParts.join('\n')
    };
}

function buildTemplateOutput(id, elements) {
    const baseClass = `ui-template-${id}`;
    const { html, css } = buildElementsMarkup(elements, baseClass);
    const htmlOutput = `<div class="ui-template-block ${baseClass}">${html}</div>`;
    const cssOutput = [
        `.ui-template-block.${baseClass} { display: flex; flex-direction: column; gap: 16px; width: 100%; }`,
        css
    ].filter(Boolean).join('\n');
    return { html: htmlOutput, css: cssOutput };
}

function createBaseElement(type = 'text') {
    return {
        id: createElementId(),
        type,
        padding: '',
        margin: '',
        align: 'left',
        content: '',
        src: '',
        children: []
    };
}

export class TemplateManager {
    constructor(options) {
        this.getEditor = options.getEditor;
        this.modal = options.modal;
        this.listView = options.listView;
        this.listContainer = options.listContainer;
        this.openCreatorButton = options.openCreatorButton;
        this.creatorView = options.creatorView;
        this.templateForm = options.templateForm;
        this.templateNameInput = options.templateNameInput;
        this.elementList = options.elementList;
        this.addElementButton = options.addElementButton;
        this.cancelCreateButton = options.cancelCreateButton;
        this.closeButton = options.closeButton;
        this.backdrop = options.backdrop;
        this.templates = [];
        this.currentDraft = null;
        this.styleElement = null;
        this.appliedTemplateIds = new Set();
        this.bindEvents();
        this.renderTemplateList();
    }

    bindEvents() {
        this.openCreatorButton?.addEventListener('click', () => this.startDraft());
        this.addElementButton?.addEventListener('click', () => {
            if (!this.currentDraft) {
                this.startDraft();
            }
            this.currentDraft.elements.push(createBaseElement());
            this.renderCreatorView();
        });
        this.cancelCreateButton?.addEventListener('click', () => {
            this.currentDraft = null;
            this.showListView();
        });
        this.templateForm?.addEventListener('submit', event => {
            event.preventDefault();
            this.saveDraft();
        });
        this.closeButton?.addEventListener('click', () => this.close());
        this.backdrop?.addEventListener('click', () => this.close());
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && this.modal?.classList.contains('visible')) {
                this.close();
            }
        });
    }

    ensureStyleElement() {
        if (this.styleElement) {
            return this.styleElement;
        }
        const style = document.createElement('style');
        style.id = 'ui-template-style-registry';
        document.head.appendChild(style);
        this.styleElement = style;
        return style;
    }

    ensureTemplateStyles(template) {
        if (!template || !template.id || !template.css) {
            return;
        }
        if (this.appliedTemplateIds.has(template.id)) {
            return;
        }
        const style = this.ensureStyleElement();
        style.appendChild(document.createTextNode(`\n/* template:${template.id} */\n${template.css}\n`));
        this.appliedTemplateIds.add(template.id);
    }

    open() {
        if (!this.modal) return;
        this.modal.classList.add('visible');
        this.modal.setAttribute('aria-hidden', 'false');
        this.showListView();
    }

    close() {
        if (!this.modal) return;
        this.modal.classList.remove('visible');
        this.modal.setAttribute('aria-hidden', 'true');
        this.currentDraft = null;
        this.templateNameInput && (this.templateNameInput.value = '');
    }

    showListView() {
        if (this.listView) {
            this.listView.removeAttribute('hidden');
        }
        if (this.creatorView) {
            this.creatorView.setAttribute('hidden', 'true');
        }
        this.renderTemplateList();
    }

    startDraft() {
        this.currentDraft = {
            elements: []
        };
        if (this.templateNameInput) {
            this.templateNameInput.value = '';
        }
        this.showCreatorView();
    }

    showCreatorView() {
        if (this.listView) {
            this.listView.setAttribute('hidden', 'true');
        }
        if (this.creatorView) {
            this.creatorView.removeAttribute('hidden');
        }
        this.renderCreatorView();
    }

    renderTemplateList() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '';
        if (!this.templates.length) {
            const empty = document.createElement('div');
            empty.className = 'template-empty-state';
            empty.textContent = 'テンプレートがまだありません。\n「テンプレート作成」から追加してください。';
            this.listContainer.appendChild(empty);
            return;
        }
        this.templates.forEach(template => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'template-item';
            item.textContent = template.name;
            item.addEventListener('click', () => {
                const editor = this.getEditor?.();
                if (!editor) {
                    return;
                }
                editor.commands.insertTemplate({ template });
                this.close();
            });
            this.listContainer.appendChild(item);
        });
    }

    renderCreatorView() {
        if (!this.elementList) return;
        this.elementList.innerHTML = '';
        if (!this.currentDraft) {
            return;
        }
        const elements = this.currentDraft.elements || [];
        if (!elements.length) {
            const hint = document.createElement('div');
            hint.className = 'template-empty-elements';
            hint.textContent = '「要素を追加」ボタンからフレーム・テキスト・イメージを追加できます。';
            this.elementList.appendChild(hint);
            return;
        }
        elements.forEach((element, index) => {
            const node = this.createElementEditor(element, elements, index, 0);
            this.elementList.appendChild(node);
        });
    }

    createElementEditor(element, siblings, index, depth) {
        const wrapper = document.createElement('div');
        wrapper.className = 'template-element-editor';
        wrapper.style.marginLeft = `${depth * 16}px`;

        const header = document.createElement('div');
        header.className = 'template-element-header';

        const typeSelect = document.createElement('select');
        typeSelect.className = 'template-element-type';
        ['frame', 'text', 'image'].forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type === 'frame' ? 'フレーム' : type === 'text' ? 'テキスト' : 'イメージ';
            if (element.type === type) {
                option.selected = true;
            }
            typeSelect.appendChild(option);
        });
        typeSelect.addEventListener('change', () => {
            element.type = typeSelect.value;
            if (element.type === 'frame') {
                element.children = element.children || [];
            } else {
                element.children = [];
            }
            this.renderCreatorView();
        });

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'template-element-remove';
        removeButton.textContent = '削除';
        removeButton.addEventListener('click', () => {
            siblings.splice(index, 1);
            this.renderCreatorView();
        });

        header.appendChild(typeSelect);
        header.appendChild(removeButton);
        wrapper.appendChild(header);

        const controls = document.createElement('div');
        controls.className = 'template-element-controls';

        const paddingLabel = document.createElement('label');
        paddingLabel.textContent = 'Padding';
        const paddingInput = document.createElement('input');
        paddingInput.type = 'text';
        paddingInput.value = element.padding || '';
        paddingInput.placeholder = '例: 16px 12px';
        paddingInput.addEventListener('input', () => {
            element.padding = paddingInput.value;
        });
        paddingLabel.appendChild(paddingInput);
        controls.appendChild(paddingLabel);

        const marginLabel = document.createElement('label');
        marginLabel.textContent = 'Margin';
        const marginInput = document.createElement('input');
        marginInput.type = 'text';
        marginInput.value = element.margin || '';
        marginInput.placeholder = '例: 8px 0';
        marginInput.addEventListener('input', () => {
            element.margin = marginInput.value;
        });
        marginLabel.appendChild(marginInput);
        controls.appendChild(marginLabel);

        const alignLabel = document.createElement('label');
        alignLabel.textContent = 'Align';
        const alignSelect = document.createElement('select');
        ALIGN_OPTIONS.forEach(optionInfo => {
            const option = document.createElement('option');
            option.value = optionInfo.value;
            option.textContent = optionInfo.label;
            if (element.align === optionInfo.value) {
                option.selected = true;
            }
            alignSelect.appendChild(option);
        });
        alignSelect.addEventListener('change', () => {
            element.align = alignSelect.value;
        });
        alignLabel.appendChild(alignSelect);
        controls.appendChild(alignLabel);

        wrapper.appendChild(controls);

        if (element.type === 'text') {
            const contentLabel = document.createElement('label');
            contentLabel.textContent = 'テキスト内容';
            const textarea = document.createElement('textarea');
            textarea.value = element.content || '';
            textarea.rows = 3;
            textarea.addEventListener('input', () => {
                element.content = textarea.value;
            });
            contentLabel.appendChild(textarea);
            wrapper.appendChild(contentLabel);
        } else if (element.type === 'image') {
            const srcLabel = document.createElement('label');
            srcLabel.textContent = '画像URL';
            const srcInput = document.createElement('input');
            srcInput.type = 'text';
            srcInput.value = element.src || '';
            srcInput.placeholder = 'https://example.com/image.png';
            srcInput.addEventListener('input', () => {
                element.src = srcInput.value;
            });
            srcLabel.appendChild(srcInput);
            wrapper.appendChild(srcLabel);
        } else if (element.type === 'frame') {
            const childContainer = document.createElement('div');
            childContainer.className = 'template-element-children';
            const children = element.children || [];
            if (children.length) {
                children.forEach((child, childIndex) => {
                    const childEditor = this.createElementEditor(child, children, childIndex, depth + 1);
                    childContainer.appendChild(childEditor);
                });
            }
            const addChildButton = document.createElement('button');
            addChildButton.type = 'button';
            addChildButton.className = 'template-add-child';
            addChildButton.textContent = '子要素を追加';
            addChildButton.addEventListener('click', () => {
                children.push(createBaseElement());
                this.renderCreatorView();
            });
            childContainer.appendChild(addChildButton);
            wrapper.appendChild(childContainer);
        }

        return wrapper;
    }

    validateElements(elements) {
        if (!elements || !elements.length) {
            return false;
        }
        for (const element of elements) {
            if (element.type === 'image' && !(element.src || '').trim()) {
                return false;
            }
            if (element.type === 'frame') {
                if (!this.validateElements(element.children || [])) {
                    return false;
                }
            }
        }
        return true;
    }

    saveDraft() {
        if (!this.currentDraft) {
            return;
        }
        const name = (this.templateNameInput?.value || '').trim();
        if (!name) {
            alert('テンプレート名を入力してください。');
            return;
        }
        if (!this.validateElements(this.currentDraft.elements)) {
            alert('テンプレートには少なくとも1つの要素が必要です。\n画像要素にはURLを指定してください。');
            return;
        }
        const id = `tpl-${Date.now()}`;
        const clonedElements = (this.currentDraft.elements || []).map(element => cloneElement(element));
        const { html, css } = buildTemplateOutput(id, clonedElements);
        const template = {
            id,
            name,
            elements: clonedElements,
            html,
            css
        };
        this.templates.push(template);
        this.ensureTemplateStyles(template);
        this.currentDraft = null;
        this.showListView();
    }
}

export const UITemplateExtension = Extension.create({
    name: 'uiTemplate',
    addOptions() {
        return {
            getManager: () => null
        };
    },
    addCommands() {
        return {
            openTemplateManager: () => () => {
                const manager = this.options.getManager?.();
                if (!manager) {
                    return false;
                }
                manager.open();
                return true;
            },
            insertTemplate: options => ({ editor }) => {
                const template = options?.template;
                if (!template?.html) {
                    return false;
                }
                editor.chain().focus().insertContent(template.html).run();
                const manager = this.options.getManager?.();
                manager?.ensureTemplateStyles(template);
                return true;
            }
        };
    }
});
