import { Node, mergeAttributes } from 'https://esm.sh/@tiptap/core';

const DEFAULT_CARD_CLASS = 'page-link-card';

function createCardAttributes(nodeAttrs = {}, HTMLAttributes = {}) {
  const { pageId = '', title = '', url = '' } = nodeAttrs;
  const {
    class: className,
    'data-page-link-card': _ignoredDataAttr,
    ...rest
  } = HTMLAttributes;
  const attributes = mergeAttributes(rest, {
    'data-page-link-card': '',
    'data-page-id': pageId,
    'data-page-title': title,
    href: url || '#',
    target: '_blank',
    rel: 'noopener noreferrer',
  });
  attributes.class = [DEFAULT_CARD_CLASS, className].filter(Boolean).join(' ');
  return attributes;
}

export const PageLink = Node.create({
  name: 'pageLinkCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  defining: true,
  addAttributes() {
    return {
      pageId: {
        default: null,
      },
      title: {
        default: null,
      },
      url: {
        default: null,
      },
      description: {
        default: null,
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: `a[data-page-link-card]`,
        getAttrs: dom => {
          if (!(dom instanceof HTMLElement)) {
            return false;
          }
          return {
            pageId: dom.getAttribute('data-page-id') || dom.getAttribute('data-id') || null,
            title: dom.getAttribute('data-page-title') || dom.querySelector('.page-link-card__title')?.textContent || null,
            url: dom.getAttribute('href') || null,
            description: dom.getAttribute('data-page-description') || dom.querySelector('.page-link-card__meta')?.textContent || null,
          };
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const attrs = createCardAttributes(node.attrs, HTMLAttributes);
    if (node.attrs.description) {
      attrs['data-page-description'] = node.attrs.description;
    }
    const children = [
      ['div', { class: 'page-link-card__title' }, node.attrs.title || node.attrs.pageId || '未指定のページ'],
    ];
    const metaText = node.attrs.description || node.attrs.pageId;
    if (metaText) {
      children.push(['div', { class: 'page-link-card__meta' }, metaText]);
    }
    return ['a', attrs, ...children];
  },
  addCommands() {
    return {
      insertPageLinkCard: attrs => ({ chain }) => {
        if (!attrs || !attrs.pageId) {
          return false;
        }
        return chain()
          .focus()
          .insertContent({
            type: this.name,
            attrs: {
              pageId: attrs.pageId,
              title: attrs.title || attrs.pageId,
              url: attrs.url || '#',
              description: attrs.description || null,
            },
          })
          .run();
      },
      updatePageLinkCard: attrs => ({ chain, state }) => {
        if (!attrs || !attrs.pageId) {
          return false;
        }
        const { selection } = state;
        const { $from } = selection;
        const node = selection.node || $from.node($from.depth);
        if (!node || node.type.name !== this.name) {
          return false;
        }
        return chain()
          .focus()
          .updateAttributes(this.name, {
            pageId: attrs.pageId,
            title: attrs.title || attrs.pageId,
            url: attrs.url || '#',
            description: attrs.description || null,
          })
          .run();
      },
    };
  },
});

export default PageLink;
