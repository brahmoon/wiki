import { Node, mergeAttributes } from 'https://esm.sh/@tiptap/core';

const DEFAULT_TITLE = '未指定のページ';

function getTextContent(element, selector) {
    const target = selector ? element.querySelector(selector) : element;
    if (!target) {
        return '';
    }
    return (target.textContent || '').trim();
}

export const PageLinkCard = Node.create({
    name: 'pageLinkCard',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,
    isolating: true,
    addOptions() {
        return {
            HTMLAttributes: {}
        };
    },
    addAttributes() {
        return {
            pageId: {
                default: null
            },
            title: {
                default: null
            },
            description: {
                default: null
            },
            url: {
                default: null
            }
        };
    },
    parseHTML() {
        return [
            {
                tag: 'a[data-page-link-card]',
                priority: 1000,
                getAttrs: dom => {
                    if (!(dom instanceof HTMLElement)) {
                        return false;
                    }
                    const pageId = dom.getAttribute('data-page-id') || dom.getAttribute('pageid') || '';
                    const titleAttr = dom.getAttribute('data-page-title');
                    const descriptionAttr = dom.getAttribute('data-page-description');
                    const titleText = titleAttr || getTextContent(dom, '.page-link-card__title');
                    const descriptionText = descriptionAttr || getTextContent(dom, '.page-link-card__meta');
                    const url = dom.getAttribute('href') || null;
                    return {
                        pageId: pageId || null,
                        title: titleText || null,
                        description: descriptionText || null,
                        url
                    };
                }
            }
        ];
    },
    renderHTML({ HTMLAttributes }) {
        const resolvedUrl = HTMLAttributes.url
            || (HTMLAttributes.pageId ? `./view.html?page=${encodeURIComponent(HTMLAttributes.pageId)}` : '#');
        const attrs = mergeAttributes(
            this.options.HTMLAttributes,
            {
                class: 'page-link-card',
                href: resolvedUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
                'data-page-link-card': ''
            }
        );
        if (HTMLAttributes.pageId) {
            attrs['data-page-id'] = HTMLAttributes.pageId;
        }
        if (HTMLAttributes.title) {
            attrs['data-page-title'] = HTMLAttributes.title;
            attrs.title = HTMLAttributes.title;
        }
        if (HTMLAttributes.description) {
            attrs['data-page-description'] = HTMLAttributes.description;
        }
        const titleText = HTMLAttributes.title || HTMLAttributes.pageId || DEFAULT_TITLE;
        const metaText = HTMLAttributes.description || HTMLAttributes.pageId || '';
        const children = [
            ['div', { class: 'page-link-card__title' }, titleText]
        ];
        if (metaText) {
            children.push(['div', { class: 'page-link-card__meta' }, metaText]);
        }
        return ['a', attrs, ...children];
    },
    addCommands() {
        return {
            insertPageLinkCard: attributes => ({ commands }) => {
                if (!attributes || !attributes.pageId) {
                    return false;
                }
                const pageId = attributes.pageId;
                const title = attributes.title || attributes.pageTitle || pageId;
                const description = attributes.description || attributes.pageDescription || pageId;
                const url = attributes.url
                    || attributes.href
                    || (pageId ? `./view.html?page=${encodeURIComponent(pageId)}` : null);
                return commands.insertContent({
                    type: this.name,
                    attrs: {
                        pageId,
                        title,
                        description,
                        url
                    }
                });
            }
        };
    }
});
